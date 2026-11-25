/*********************************************
 * This file is the background Queue Class
 *********************************************/

"use strict";
import { decryptValue } from '../shared/crypto.js';




let active, activeID = null;    // Sadly needed due to a race condition when downloading subs
let creating; // A global promise to avoid concurrency issues
const keepAlive = setInterval(chrome.runtime.getPlatformInfo, 25 * 1000);   // Never let backend sleep

//#region Exported class

export class queue4 {

    constructor() {
        this.queueOrder = [];   // Queue Order
        this.queueData = {};    // Queue metadata
        this.queueRunning = false;  // Queue running?
        this.active = null; // Id from the chrome download queue of the item currently downloading
        this.activeID = null;   // ID from this queue that is currently been downloaded
        this.continue = false;
        this.currentlyDownloading = ""; //Filename of current download
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
            let result = arrData[idx];
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

    async deleteQueueItem(item) {
        delete this.queueData[item[0]]; // Remove metadata
        const idx = this.queueOrder.indexOf(item[0]);
        this.queueOrder.splice(idx, 1);
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

    async #setupOffscreenDocument(path) {    // Create a temp offscreen document to handle blobs
        /* Check all windows controlled by the service worker to see if one
        of them is the offscreen document with the given path */
        const offscreenUrl = browser.runtime.getURL(path);
        const existingContexts = await browser.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [offscreenUrl]
        });

        if (existingContexts.length > 0) {
            return;
        }

        // create offscreen document
        if (creating) {
            await creating;
        } else {
            creating = browser.offscreen.createDocument({
            url: path,
            reasons: ['BLOBS'],
            justification: 'Needed to create an objectURL from backend',
            });
            await creating;
            creating = null;
        }
    }

    // Download a file to download folder
    async #startDownloadOfTextToFile(fileContents, fileName) {
        // Open a new tab offscreen so we can get the objectURL and the blob
        await this.#setupOffscreenDocument('background/createObjectURL.html')
        // Send message to offscreen document to get the url
        let url = await browser.runtime.sendMessage({
            event: 'getObjectURL',
            target: 'offscreen',
            prefs: fileContents
        });
        let prefs = {
            filename: fileName,
            url: url
        };
        try {await chrome.downloads.download(prefs); } catch {}; // Download the subtitle
        try {await browser.offscreen.closeDocument(); } catch {}; // Close the offscreen document again
    }

    /****************
     * If we download the subtitle using normal chrome API, it sadly has a mimetype on the PMS as html,
     * meaning the extention of the saved file will be .htm
     * so we need to use fetch, save it to a variable, convert to a blob, and then once more download the blob from
     * this extention
     */
    async #getsub(prefs, token) {
        let sub;
        const header = (await browser.storage.local.get("header")).header;
        header['X-Plex-Token'] = token;
        const fileName = prefs.filename;
        const url = prefs.url;
        await fetch(url, {
                headers: header
            }).then( async response => {
                if (response.ok){
                    sub = await response.text();
                }
            }
        );
        this.#startDownloadOfTextToFile(sub, fileName)
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
                    this.currentlyDownloading = rec['displayTitle'];
                    await this.#saveQueue();
                    if (rec['type'] === 'subtitle' || rec['type'] === 'lyrics') {   // A non media is downloaded so fast we can't even detect it, so simply nuke from the queue
                        console.log("Ged Rec", rec)
                        const idx = this.queueOrder.indexOf(rec['id']);
                        this.queueOrder.splice(idx, 1); // Remove entry from the order array
                        delete this.queueData[rec['id']];    // Remove record from the metadata JSON
                        await this.#getsub(prefs, srv.accessToken); // Download the subtitle stream
                        this.currentlyDownloading = '';
                        await this.#saveQueue();  // Update storage
                    } else {    // Media download
                        this.activeID = rec['id'];
                        activeID = this.activeID;
                        this.active = await chrome.downloads.download(prefs);   // Start the download of a media
                        active = this.active;
                        await this.#saveQueue();  // Update storage with the download ID
                        // Prevent serviceworker to go into idle mode
                        await this.#onDownloadComplete(this.active); // Wait for the download to finish
                        const idx = this.queueOrder.indexOf(this.activeID);
                        this.queueOrder.splice(idx, 1); // Remove entry from the order array
                        delete this.queueData[this.activeID];    // Remove record from the metadata JSON
                        this.active = null;
                        this.activeID = null;
                        this.currentlyDownloading = '';
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


    #onDownloadComplete(itemId) {    // Event listen for the download to complete
        return new Promise(resolve => {
            browser.downloads.onChanged.addListener(function onChanged({id, state}) {
                if (id === itemId && state && state.current !== 'in_progress') {
                    browser.downloads.onChanged.removeListener(onChanged);
                    resolve(state.current === 'complete');
                }
                });
            });
        }
    }

//#endregion
