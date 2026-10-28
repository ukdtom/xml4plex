/*****************
*  This is the queue for xml4Plex
*
* It use an array for the order, and a JSON object for the metadata
* Also when one of above is updated, it automaticly updates the local storage
*
* We only export the queue function, that takes a prefs json obj looking like:
* {
*   action: 'add'
*   data: some_meta_data_as_a_json
* }
******************/



//#region Samples sent to the queue
// For subtitles the ID is generated like `${prefix}${srvID}-${key stream id}`
// For a movie or episode, the ID is generated like `${prefix}${key stream number1}-${key stream number2}`

/* Sample queue entry for a movie
{
    displayTitle: "Bear Island (movie)"
    fileName: "Bear Island (1979) {imdb-tt0078836}/Bear Island (1979) {imdb-tt0078836} [720p.x265].mkv"
    id: "ss_elem_389601-1792103068"
    key: "/library/parts/389601/1792103068/file.mkv"
    srvID: "5a4ec274c78097651059d234a38193ce3ea5fe4b"
    summary: "On the remote Norwegian Bear Island, used as a submarine base by the Germans during World War II, U.N. scientist Larsen sends a distress signal using an emergency N.A.T.O. frequency, and is received by scientific vessel Morning Rose."
    title: "Bear Island"
    type: "movie"
}
*/

/* Sample entry for a movie subtitle
{
    displayTitle: "Bear Island Danish (SRT External)"
    fileName: "Bear Island (1979) {imdb-tt0078836}/Bear Island (1979) {imdb-tt0078836} [720p.x265].da.srt"
    id: "ss_elem_5a4ec274c78097651059d234a38193ce3ea5fe4b-1306651"
    key: "/library/streams/1306651"
    srvID: "5a4ec274c78097651059d234a38193ce3ea5fe4b"
    title: "Bear Island"
    type: "subtitle"
}
*/

/* Sample queue entry for an episode
{
    displayTitle: "The Rabbit Hole (episode)"
    episode: 1
    fileName: "11.22.63 (2016) {tmdb-64464}/Season 01/11.22.63 (2016) {tmdb-64464} -S01E01- [720p.HDTV.X265-DIMENSION ettv].mkv"
    id: "ss_elem_318696-1678112413"
    key: "/library/parts/318696/1678112413/file.mkv"
    season: 1
    showTitle: "11.22.63"
    srvID: "5a4ec274c78097651059d234a38193ce3ea5fe4b"
    summary: "A small-town English teacher, Jake Epping, learns from a friend that there is a portal that leads from the present back to 1960. Jake's friend asks him to help him stop John F. Kennedy's assassination by going back in time and finding out who really killed Kennedy... and killing them."
    title: "The Rabbit Hole"
    type: "episode"
}
*/

/* Sample queue entry for an episode subtitle
{
    displayTitle: "The Rabbit Hole Danish (SRT External)"
    episode: 1
    fileName: "11.22.63 (2016) {tmdb-64464}/Season 01/11.22.63 (2016) {tmdb-64464} -S01E01- [720p.HDTV.X265-DIMENSION ettv].da.srt"
    id: "ss_elem_5a4ec274c78097651059d234a38193ce3ea5fe4b-1016095"
    key: "/library/streams/1016095"
    season: 1
    showTitle: "11.22.63"
    srvID: "5a4ec274c78097651059d234a38193ce3ea5fe4b"
    title: "The Rabbit Hole"
    type: "subtitle"
}
*/

//#endregion

"use strict";

var arrQueueOrder = [];  // The array that holds the order of the queue
var objQueue = {};  // The metadata for the queue elements
var arrQueueObj;
const prefix = 'ss_elem_';  //Prefix in front of every ID, taken from the aria listbox prefix used on the gui
var stack = [];     // A simple stack that we process the data from
var bStackRunning = false;  // Stack been processed?

//#region Exported functions

// Main switch for aueue actions
export function queue(prefs){
    console.log("Ged 15 queue prefs", prefs)
    stack.push(prefs);
    console.log("Ged 11 stack", JSON.parse(JSON.stringify(stack)))
    processStack();
    /*
    const { action, data } = prefs;
    switch (action) {
        case 'add':
            add(data);
            break;
    }
            */
}


//#endregion

//#region Internal functions

// A delay function
const delay = millis => new Promise((resolve, reject) => {
  setTimeout(_ => resolve(), millis)
});

async function processStack(){
    console.log("Ged 99-3 stack length", stack.length)
    if (stack.length === 0){
        bStackRunning = false;
    } else {
        console.log("Ged 99-3 starting stack")
        bStackRunning = true;
        for (const item of stack) {
            //await processItem(item); // Waits for each item to finish before moving to the next
            console.log("Ged 99-7 process", item)
            const { action, data } = item;
            switch (action) {
                case 'add':
                    await add(data);
                    
                    break;
            }
            await delay(1000);
            stack.shift();
        }
        console.log("Ged 99-9 stack", JSON.parse(JSON.stringify(stack)))
        processStack();
    }
}

async function add(data){
    if (data['type'] === 'subtitle'){
        await addSub(data);
    } else {
        await addMedia(data);
    }
}

async function addMedia(data){
    console.log("Ged 66 Add media", data)
    await getCurrent();
    const entry = {};   //Matadata
    // Generate the ID
    const arrKey = data['key'].split('/');
    let id;
    if (data.hasOwnProperty('episode')){ // We have an episode
        id = `${prefix}${data['srvID']}-${arrKey[3]}`;
        entry['se'] = `S${data["season"].toString().padStart(2, "0")}E${data["episode"].toString().padStart(2, "0")}`;
        entry['showTitle'] = data['showTitle'];
    } else {  // We have a movie
        console.log("Ged 66-3 arrKey", arrKey)
        id = `${prefix}${arrKey[3]}-${arrKey[4]}`;
    }
    console.log("Ged 11-3 id", id)
    // Common entries
    entry['displayTitle'] = data['displayTitle'];
    entry['fileName'] = data['fileName'];
    entry['key'] = data['key'];
    entry['srvID'] = data['srvID'];
    entry['title'] = data['title'];
    entry['type'] = data['type'];
    entry['summary'] = data['summary'];
    arrQueueObj[id] = entry;
    await browser.storage.local.set({'arrQueueObj': arrQueueObj});  // Set in store to make it persistent
    arrQueueOrder.push(id);
    await browser.storage.local.set({'arrQueueOrder': arrQueueOrder});  // Set in store to make it persistent
}

// Get Current info or init if not existing
async function getCurrent(){
    arrQueueOrder = (await browser.storage.local.get('arrQueueOrder')).arrQueueOrder;
    if (!arrQueueOrder){
        arrQueueOrder = [];
        await browser.storage.local.set({'arrQueueOrder': arrQueueOrder});  // Set in store to make it persistent
    }
    arrQueueObj = (await browser.storage.local.get('arrQueueObj')).arrQueueObj;
    if (!arrQueueObj){
        arrQueueObj = {};
        await browser.storage.local.set({'arrQueueObj': arrQueueObj});  // Set in store to make it persistent
    }
    console.log("Ged 13-3 arrQueueOrder", JSON.parse(JSON.stringify(arrQueueOrder)))
    console.log("Ged 13-5 arrQueueObj", JSON.parse(JSON.stringify(arrQueueObj)))
}

// Add a subtitle to the queue
async function addSub(data){
    await getCurrent();
    const entry = {};   // Metadata
    // Generate the ID
    const arrKey = data['key'].split('/');
    let id;
    if (data.hasOwnProperty('episode')){ // We have an episode
        id = `${prefix}${data['srvID']}-${arrKey[3]}`;
        entry['se'] = `S${data["season"].toString().padStart(2, "0")}E${data["episode"].toString().padStart(2, "0")}`;
        entry['showTitle'] = data['showTitle'];
    } else {  // We have a movie
        id = `${prefix}${data['srvID']}-${arrKey[3]}`;
    }
    // Common entries
    entry['displayTitle'] = data['displayTitle'];
    entry['fileName'] = data['fileName'];
    entry['key'] = data['key'];
    entry['srvID'] = data['srvID'];
    entry['title'] = data['title'];
    entry['type'] = data['type'];
    arrQueueObj[id] = entry;
    await browser.storage.local.set({'arrQueueObj': arrQueueObj});  // Set in store to make it persistent
    arrQueueOrder.push(id);
    await browser.storage.local.set({'arrQueueOrder': arrQueueOrder});  // Set in store to make it persistent
}

//#endregion
