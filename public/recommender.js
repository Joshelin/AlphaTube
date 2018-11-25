
/* L'api di youtube fa schifo. Anche specificando type: "video", il furbone ritorna comunque
dei channel con struttura items[i].id.channelId inveche che items[i].id.videoId
Probabilmente per Marketing? Non lo so, non mi interessa.
Questa funzione risolve i problemi creati da youtube.
E' pesante da reiterare ad ogni nuova ricerca...
Spostare sul server? WIP.
*/
function removeChannels(data){
	var index = data.items.length - 1;
	while (index >= 0){
        if(data.items[index].id.kind == 'youtube#channel'){
        	data.items.splice(index,1);
        }
        index--;  
    }
}

// Usato per ArtistSimilarity, rimuove la canzone sul player dalla lista ArtistSimilarity.
function removeSameSong(data){
	var index = data.items.length - 1;
	var songOnPlayer = videoNamespace.getCurrentPlayerSong();
	while(index >= 0){
		if(data.items[index].snippet.title.includes(songOnPlayer)){
			data.items.splice(index,1);
		}
		index--;
	}
}

//Lancia una semplice query usando relatedToVideoId di YT.
function setRelated(){
	$.get('/related',{
		id: videoNamespace.getCurrentPlayerId()
	}).done((data)=>{
		data = JSON.parse(data);
		removeChannels(data);
		createListOfThumbnails(data,"Related");
	})
}

//Riempe il div dei video recentemente visualizzati.
function setRecent(){
	createListOfThumbnails(videoNamespace.getRecentVideos(), "Recent")
}

//carica lista iniziale
function setListaIniziale(){
	$.get('/firstList').done(function(data){
		data = JSON.parse(data);
		var splitData = splitArray(data.map(array => array.videoID),50);
		splitData.forEach(function(value,index){
			$.get('/search',{
				q: value.join(',')
			}).done(function(data){
				data = JSON.parse(data);
				listaInizialeNamespace.add(data.items);
				if(listaInizialeNamespace.done()){
					createListOfThumbnails(listaInizialeNamespace.get(),"FirstList");
				}
			})
		})		
	})
}

function randomDate(start, end) {
		//Math.random() returns a float number between 0 and 1
		//returns random Date between start and end
    	return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// Splitta array, in size.
function splitArray(array, size){
	var groups = [],i;
	for(i = 0; i < array.length; i += size){
		groups.push(array.slice(i,i + size));
	}
	return groups;
}

function setRandom(){
	var data1 = randomDate(new Date(2005, 4, 25), new Date());
	var data2 = new Date(data1);
	data2.setMonth(data1.getMonth()+1);
	$.get('/random',{
		lessRecentDate: data1.toISOString(),
		mostRecentDate: data2.toISOString(),
		//videoCategoryId: '10',
		//type:'video',
		//maxResults: 30
	}).done((data)=>{
		data = JSON.parse(data);
		removeChannels(data);
		createListOfThumbnails(data,"Random");
	})
}

function sparqlQueryforMusicGenre(res){
	let resource = "<http://dbpedia.org/resource/" + res + ">";
	return ("PREFIX dbo: <http://dbpedia.org/ontology/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>"+ 
    " SELECT ?lab WHERE { "+ resource + 
    " dbo:genre ?genre. ?genre rdfs:label ?lab FILTER langMatches(lang(?lab),'en') }") ;
}

//Video dello stesso channel o ricerca per artista?
function setArtistSimilarity(){
	$.get('/channel',{
		id: videoNamespace.getCurrentPlayerVideoChannelId()
		}).done((data)=>{
			data = JSON.parse(data);
			removeSameSong(data);
			removeChannels(data);
			createListOfThumbnails(data,"ArtistSimilarity");
		})
}

function setGenreSimilarity(){

	function getGenreResults(bindings){
		$.get("/similarity_genre",{
			genre: bindings
		}).done((data)=>{
			data = JSON.parse(data);
			//andrebbe anche controllato se nella lista ci sono video dello stesso artista
			//removeChannels(data); Forse serve?
			createListOfThumbnails(data,"GenreSimilarity");
		});
	}

	function noThumbnailFound(){
		$(".GenreSimilarity > img").attr("alt","Non è stato possibile trovare video simili per genere");
	}

	artist = videoNamespace.getCurrentPlayerArtist();
	title = videoNamespace.getCurrentPlayerSong();
	if (title){	
		queriesToDBPedia(true,title,artist,sparqlQueryforMusicGenre,getGenreResults,noThumbnailFound);
	}
	else{
		noThumbnailFound();
	}
}


function setAbsoluteLocalPopularity(){
	$.get("/localPopularity").done((data)=>{
		if (data.length){
			$.get("/search",{
				q: (data.map(a => Object.keys(a).toString())).join(',') 
			}).done((data)=>{
				data = JSON.parse(data);
				createListOfThumbnails(data,"AbsoluteLocalPopularity");
			});
		}
		else{
			//non è stato ancora visualizzato nulla
		}
	});
}

function setRelativeLocalPopularity(){
	$.get("/relativePopularity",{
		id: videoNamespace.getCurrentPlayerId()
	}).done((data1)=>{
		if(data1.length){
			console.log('Query to youtube for RelativeLocalPopularity', data)
			$.get("/search",{
				q: (data1.map(array => array.id)).join(',')
			}).done((data2)=>{
				data2 = JSON.parse(data2);
				createListOfThumbnails(data2,"RelativeLocalPopularity");
				//Do something with data1 prevalentReason
			})
		}else{
			console.log('Nessuna relazione');
		}
	})
}

//Crea cookie.
function saveSessionCookie(){
	Cookies.set('lastVideo',videoNamespace.getCurrentPlayerVideo(),{
		expires: 30
	});
	Cookies.set('lastCurrentTime', Math.round(player.getCurrentTime()),{
		expires: 30
	});
	Cookies.set('recentVideos', videoNamespace.getRecentVideos(),{
		expires: 30
	});
}

// Carica video nel player e setta i vari box.
function setVideo(data, startTime = 0){
	videoNamespace.updateWatchTime();
	timerNamespace.resetTimer();
	videoNamespace.setCurrentPlayerVideo(data)
	player.loadVideoById({
		videoId: videoNamespace.getCurrentPlayerId(),
		startSeconds: startTime,
		suggestedQuality: 'large'
	});
	setComments();
	setRelated();
	setDescription();
	setRecent();
    setRandom();
	setArtistSimilarity();
	setAbsoluteLocalPopularity(); 
	setRelativeLocalPopularity();
}