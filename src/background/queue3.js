"use strict";

/*
enqueue
dequeue
startQueue
stopQueue
getQueue
*/


// Global vars
let queueOrder = null; // The order of the queue as an array
let queueData = null;  // Queue items in a JSON object
const prefix = 'ss_elem_';
const nameOrder = 'arrQueue3Order';
const nameData = 'objQueueData';


//#region Exported functions

// Add an array of items to the queue
export async function enqueue(arrData){
    console.log("Ged 6-3 arrData", arrData)
    await getCurrent(); // First get the current queue
    console.log("Ged 6-5 queueOrder, queueData", JSON.parse(JSON.stringify(queueOrder)), JSON.parse(JSON.stringify(queueData)))
    for (const idx in arrData){
        console.log("Ged 6-7-3 type", arrData[idx]['type'])
        switch (arrData[idx]['type']) {
            case 'movie':
                const item = new itemMovie();
                const result = item.add(arrData[idx]);
                console.log("Ged 334455 result", result)
                queueData[result['id']] = JSON.parse(JSON.stringify(result))
                console.log("Ged 667788334455 queueData", queueData)
                queueOrder.push(result['id']);
                break;
        }
    }
    /*
    console.log("Ged 6-13 queueData", queueData)

    //await browser.storage.local.set({'Tommy1': true});

    //await browser.storage.local.set({'objQueue3Data': queueData});
    await browser.storage.local.set({'objQueue3Data': {'test': true}});
    //await browser.storage.local.set({'Ged': queueData});
    setTimeout(() => {
  console.log("Ged we waited 2s to run this code, oh boy wowwoowee!");
}, 2000);
    await browser.storage.local.set({'Tommy2-1': queueData});

    await browser.storage.local.set({'queueOrder': queueOrder});
    console.log("Ged 6-13-2 queueOrder", queueOrder)
    */
   await saveQueues();

}

//#endregion


//#region Internal functions

// Get the current queue and order from storage, or init vars in not present
async function getCurrent(){
    const keys = await browser.storage.local.getKeys();
    console.log("Ged 2-1 current queueOrder, queueData", queueOrder, queueData)
    if (!queueOrder) {
        queueOrder = keys.includes('arrQueue3Order') ? await browser.storage.local.get('queueData') : [];
    }
    if (!queueData) {
        queueData = keys.includes('objQueue3Data') ? await browser.storage.local.get('queueOrder') : {};
    }
}

// Save cached queues to storage
async function saveQueues(){
    console.log("Ged 6-13 queueData", queueData)
    try {
    const value = {}
    value['test1'] = 1
    value['test2'] = true
    await browser.storage.local.set({'test': value})
    /*
    await browser.storage.local.set({'queueData': queueData});
    await browser.storage.local.set({'queueOrder': queueOrder});
    */
    console.log("Ged 6-13-2 queueOrder", queueOrder)
    }
    catch (error){
        console.error('Ged 6-13-21 error', error)
    }

}

//#endregion

//#region Internal classes

class itemMovie {
    constructor() {
        this.type = 'movie';
        this.title = null;
        this.summary = null;
        this.srvID = null;
        this.key = null;
        this.id = null;
        this.fileName = null;
        this.displayTitle = null;
    }

    add (data) {
        this.title = data.title;
        this.summary = data.summary;
        this.srvID = data.srvID;
        this.key = data.key;
        this.id = (() => {
            const keys = this.key.split('/');
            return `${prefix}${keys[3]}-${keys[4]}`
        })();
        this.fileName = data.fileName;
        this.displayTitle = data.displayTitle;
        return this;
    }

    /*
    displayTitle: "Bear Island (movie)"
    fileName: "Bear Island (1979) {imdb-tt0078836}/Bear Island (1979) {imdb-tt0078836} [720p.x265].mkv"
    id: "ss_elem_389601-1792103068"
    key: "/library/parts/389601/1792103068/file.mkv"
    srvID: "5a4ec274c78097651059d234a38193ce3ea5fe4b"
    summary: "On the remote Norwegian Bear Island, used as a submarine base by the Germans during World War II, U.N. scientist Larsen sends a distress signal using an emergency N.A.T.O. frequency, and is received by scientific vessel Morning Rose."
    title: "Bear Island"
    type: "movie"
    */
}

//#endregion