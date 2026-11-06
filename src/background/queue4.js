/*********************************************
 * This file is the Queue Class
 *********************************************/
"use strict";
import { decryptValue } from './crypto.js';

const prefix = 'ss_elem_';  // Id prefix, that matches the listbox
let active, activeID = null;    // Sadly needed due to a race condition when downloading subs

//#region Exported class

export class queue4 {

    constructor() {
        this.queueOrder = [];   // Queue Order
        this.queueData = {};    // Queue metadata
        this.queueRunning = false;  // Queue running?
        this.active = null; // Id from the chrome download queue of the item currently downloading
        this.activeID = null;   // ID from this queue that is currently been downloaded
        this.continue = false;

    }

    getQueueLength() {  // Get the length of the queue
        return this.queueOrder.length;
    }

    getQueue() {    // Return the queue
        return this;
    }

    async newOrder(order){  // Update the queue with a new order
        this.queueOrder = order;
        await this.#saveQueue();
    }

    async enqueue(arrData){   // Add an array of records to the queue
        for (const idx in arrData){
            let item, result;
            switch (arrData[idx]['type']) {
                case 'movie':
                    item = new itemMovie();
                    break;
                case 'subtitle':
                    item = new itemSub();
                    break;
                case 'episode':
                    item = new itemEpisode();
                    break;
            }
            result = item.add(arrData[idx]);
            if (!this.queueOrder.includes(result['id'])) {  // Only add item to queue if not already there
                this.queueData[result['id']] = JSON.parse(JSON.stringify(result))
                this.queueOrder.push(result['id']);
            }
        }
       await this.#saveQueue();
    }

    async deleteQueue4() {
        this.queueData = {};
        this.queueOrder = [];
        this.queueRunning = false;
        this.active = null;
        await this.#saveQueue();
    }

    async toggleQueue() {   // Toggle queueRunning
        this.queueRunning = !this.queueRunning;
        await this.#saveQueue();
        if (this.queueRunning) {
            this.#download();
            this.continue = true;
        }
    }

    async updateFromStorage() {  //Update from  extention.storage.local
        const keys = await browser.storage.local.getKeys();
        if (keys.includes('queue4')) {
            let tmpQueue = (await browser.storage.local.get('queue4'))['queue4'];
            this.queueData = tmpQueue['queueData'];
            this.queueOrder = tmpQueue['queueOrder'];
            this.queueRunning = tmpQueue['queueRunning'];
        }
        return this;
    }

    // The actual download
    async #download() {
        while (this.queueRunning) { // As long as the queue is set to run
            if (this.queueOrder.length > 0){    // We have something in the queue
                if (!this.active) { // Only one at the time
                    // Get top item
                    const rec = this.queueData[this.queueOrder[0]];
                    const secret = (await browser.storage.local.get('serverInfo'))['serverInfo'];
                    const serversInfo = JSON.parse(await decryptValue(secret));
                    const srv = serversInfo[rec['srvID']];
                    const url = `${srv['address']}${rec['key']}?download=1` // Url to download from
                    const header = await this.#getHeader(srv['accessToken'])
                    const prefs = {}
                    prefs['headers'] = header;
                    prefs['filename'] = rec['fileName'];
                    prefs['url'] = url;
                    prefs['saveAs'] = false;
                    if (rec['type'] === 'subtitle') {   // A sub is downloaded so fast we can't even detect it, so simply nuke from the queue
                        const idx = this.queueOrder.indexOf(rec['id']);
                        this.queueOrder.splice(idx, 1); // Remove entry from the order array
                        delete this.queueData[rec['id']];    // Remove record from the metadata JSON
                        await chrome.downloads.download(prefs);   // Start the download of a subtitle
                        await delay(2000);  // Wait 1000 msec due to race condition
                        await this.#saveQueue();  // Update storage
                    } else {    // Media download
                        this.activeID = rec['id'];
                        activeID = this.activeID;
                        this.active = await chrome.downloads.download(prefs);   // Start the download of a media
                        active = this.active;
                        await this.#saveQueue();  // Update storage with the download ID
                        await this.onDownloadComplete(this.active); // Wait for the download to finish
                        const idx = this.queueOrder.indexOf(this.activeID);
                        this.queueOrder.splice(idx, 1); // Remove entry from the order array
                        delete this.queueData[this.activeID];    // Remove record from the metadata JSON
                        this.active = null;
                        this.activeID = null;
                        await this.#saveQueue();  // Update storage
                    }
                   // this.queueRunning = false // Stop while testing
                }
            } else {
                this.queueRunning = false;
                await this.#saveQueue();
            }
        }
    }

    // Returns an array for the header
    async #getHeader(token) {
        const result = [];
        const header = await browser.storage.local.get('header');
        header.header['X-Plex-Token'] = token  // Add token for the server to the header
        delete header.header['Accept']; // Remove accept header, since we will download other mime types
        const keys = Object.keys(header['header']);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key != 'Accept'){
                let entry = {};
                entry["name"] = key;
                entry["value"] = header['header'][key];
                result.push(entry);
            }
        }
        return result;
    }

    // Save the queue to extention.storage.local
    async #saveQueue() {
        await browser.storage.local.set({ queue4: this });
        chrome.runtime.sendMessage({ event: 'update', prefs: this}).catch(() => {});
    }

    onDownloadComplete(itemId) {    // Event listen for the download to complete
    return new Promise(resolve => {
        chrome.downloads.onChanged.addListener(function onChanged({id, state}) {
            if (id === itemId && state && state.current !== 'in_progress') {
                chrome.downloads.onChanged.removeListener(onChanged);
                resolve(state.current === 'complete');
            }
            });
        });
    }
}

//#endregion

//#region Internal functions

// A delay function
const delay = millis => new Promise((resolve, reject) => {
  setTimeout(_ => resolve(), millis)
});

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
}

class itemSub {
    constructor() {
        this.type = 'subtitle';
        this.title = null;
        this.srvID = null;
        this.key = null;
        this.fileName = null;
        this.displayTitle = null;
        this.id = null;
        this.showTitle = null;  // Only set if sub is for an episode
        this.se = null; //SxxEyy
    }

    add (data) {
        this.title = data.title;
        this.srvID = data.srvID;
        this.key = data.key;
        this.fileName = data.fileName;
        this.displayTitle = data.displayTitle;
        // Generate the ID
        const arrKey = data['key'].split('/');
        if ( data.hasOwnProperty('episode')) {  // Sub is for an episode
            this.showTitle = data.showTitle;
            this.se = `S${data["season"].toString().padStart(2, "0")}E${data["episode"].toString().padStart(2, "0")}`;
            this.id = `${prefix}${this.srvID}-${arrKey[3]}`;
        } else {    // Sub is for a movie
            this.id = `${prefix}${this.srvID}-${arrKey[3]}`;
        }
        return this;
    }
}

class itemEpisode {
    constructor() {
        this.type = 'episode';
        this.title = null;
        this.summary = null;
        this.srvID = null;
        this.showTitle = null;
        this.key = null;
        this.id = null;
        this.fileName = null;
        this.displayTitle = null;
        this.se = null;
    }

    add (data) {
        this.title = data.title;
        this.summary = data.summary;
        this.srvID = data.srvID;
        this.showTitle = data.showTitle;
        this.key = data.key;
        this.id = (() => {
            const keys = this.key.split('/');
            return `${prefix}${keys[3]}-${keys[4]}`
        })();
        this.fileName = data.fileName;
        this.displayTitle = data.displayTitle;
        this.se = `S${data["season"].toString().padStart(2, "0")}E${data["episode"].toString().padStart(2, "0")}`;
        return this;
    }
}
//#endregion