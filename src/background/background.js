"use strict";
import {encryptValue, decryptValue} from './crypto.js';
//import {queue} from './queue.js';
//import {QueueDwn} from './queue2.js';
import {enqueue} from './queue3.js';

// Global vars
var servers = [];
var serversInfo = [];
var bQueueRunning = false;
var arrQueue = [];
const manifest = chrome.runtime.getManifest();
var dID;    // Current download ID
//const QueueDown = new QueueDwn();

//#region Event Listners and handlers

// Requests allowed
const validRequests = ['downloadQueue', 'getPlexCookie', 'setGlobalVars', 'sharedServers', 'queueAdd', 'queue', 'enqueue'];
const returnVal = ['sharedServers', 'getPlexCookie'];   //Requests where we want to return something from

// Message listner
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id === chrome.runtime.id && validRequests.includes(request.event)){  // Only accept if it came from us and is a valid request
        handleListener(request).then(sendResponse);
        if (returnVal.includes(request.event)){
            return true; // return true to indicate you want to send a response asynchronously
        }
    } else {
        console.error("Ged 3-3 unauthorized request", request.event)
    }
});

// URL Update listner
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.url) {
      // Check if it came from app.plex.tv and on a detail page
      if (changeInfo.url.startsWith("https://app.plex.tv/desktop/#!/server/") && changeInfo.url.indexOf("details?key=")>0){
        handleListener({"event": "getMedia", "prefs": {tabId, changeInfo, tab}});
      }
    }
  }
);

// Download listner
chrome.downloads.onChanged.addListener((downloadDelta) => {
    if (dID === downloadDelta.id){  // Only act if the download was started by us
        //dwnWatch(downloadDelta);
    }
})

// Handle events
async function handleListener(request){
    console.log("Ged 1 handleListener", request)
    let result = null;
    const { event, prefs } = request;
    switch (event) {
        case 'getMedia':
            result = await getMedia(prefs);
            break;
        case 'getPlexCookie':
            result = await getPlexCookie(prefs);
            break;
        case 'downloadQueue':
            break
            /*
            downloadQueue(prefs)
            break;
            */
        case 'setGlobalVars':
            servers = prefs["servers"];
            break;
        case 'sharedServers':
           serversInfo = prefs;
           setServerInfo(serversInfo);
           break;
        case 'queue':
            console.log("Ged 45 queue prefs", prefs)
            break
            /*
            queue(prefs);
            QueueDown.enqueue(prefs)
            break;
            */
        case 'enqueue':
            await enqueue(prefs);
            break;
        default:
            break;
    }
    return result;
}
//#endregion


//#region  Internal functions

// Event function for downloads
async function dwnWatch(downloadDelta){
    if (downloadDelta.hasOwnProperty('state')){
        if (downloadDelta['state'].hasOwnProperty('current')){
            if (downloadDelta['state']['current'] === 'complete'){  //Download succeded
                let dItem = await chrome.downloads.search({id: downloadDelta.id})  //Only above
                let url = dItem[0]['url']
                for (const idx in arrQueue){
                    if (url.includes(arrQueue[idx]['key'])){
                        arrQueue.splice(idx,1);  //Remove from queue
                        //await browser.storage.local.set({'arrQueue': arrQueue})
                        break;
                    }
                }
                if (arrQueue.length < 1){
                    bQueueRunning = false;
                    await browser.storage.local.set({'queueRunning': false})
                    let updatePrefs = {};
                    updatePrefs['currentFile'] = await activeDownload(dID);
                    updatePrefs['queueRunning'] = bQueueRunning;
                    updatePrefs['queue'] = arrQueue;
                    chrome.runtime.sendMessage({ event: 'update', prefs: updatePrefs});
                } else {
                    downloadQueue(true)
                }
            }
        }
    }
}

async function setServerInfo(serverInfo){
    const secret = await encryptValue(JSON.stringify(serversInfo))
    await browser.storage.local.set({'serverInfo': secret})
}

// Get Media prefs
async function getMedia(prefs){
    if (prefs["changeInfo"]["url"].indexOf("key=%2Flibrary%2Fmetadata%2F") > 0){    //Only react when watching a media
        if (servers.includes(getIDFromURL(prefs["changeInfo"]["url"]))){    //Only react if this is a shared server
            const message = {"event": "gotMedia", "url": prefs["changeInfo"]["url"]};
            chrome.tabs.sendMessage(prefs["tabId"], message);
        }
    }
}

async function getQueue(){
    arrQueue = (await browser.storage.local.get(["arrQueue"]))["arrQueue"];
}

// Download an item
//  from the Queue. Prefs is a boolean for start/stop
async function downloadQueue(prefs){
    if (prefs){
            const secret = (await browser.storage.local.get('serverInfo'))['serverInfo'];
            serversInfo = JSON.parse(await decryptValue(secret));
            await getQueue();
            //const srvID = arrQueue[0]['srvID']
            downloadQueueMedia();
    } else {
    }
    bQueueRunning = prefs;
    console.log("Ged 150 bQueueRunning", bQueueRunning)
}

//Download a media from the queue
async function downloadQueueMedia(){
    dID = await getActiveDownloads();
    if (!dID){   // Nothing is currently been downloaded, so let's start
        // Get first item to download
        const item = arrQueue[0];
        const srvID = item['srvID'];
        const srvInfo = serversInfo[srvID];
        const header = await browser.storage.local.get('header');
        header.header['X-Plex-Token'] = srvInfo['accessToken']  // Add token for the server
        delete header.header['Accept']; // Remove accept header, since we will download other mime types
        let dwnHeader = [];
        let entry = {};
        const keys = Object.keys(header['header']);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key != 'Accept'){
                let entry = {};
                entry["name"] = key;
                entry["value"] = header['header'][key];
                dwnHeader.push(entry);
            }
        }
        const prefs = {}
        prefs['headers'] = dwnHeader;
        prefs['filename'] = item['fileName'];
        prefs['url'] = `${srvInfo['address']}${item['key']}?download=1`;
        prefs['saveAs'] = false;
        dID = await chrome.downloads.download(prefs);   // Start the download
        await browser.storage.local.set({'dID': dID});  // Set in store to make it persistent
        activeDownload(dID);
    }
    let updatePrefs = {};
    //updatePrefs['dID'] = dID;
    updatePrefs['currentFile'] = await activeDownload(dID);
    updatePrefs['queueRunning'] = bQueueRunning;
    updatePrefs['queue'] = arrQueue;
    chrome.runtime.sendMessage({ event: 'update', prefs: updatePrefs});

}

// Extract info about the current download, and sends it to the queue window GUI
async function activeDownload(dID){
    let txt = 'No active downloads';
    if (dID){   // We have an active download
        // Get the download item from the download queue
        let dItem = await chrome.downloads.search({id:dID});
        for (const idx in arrQueue){
            if (dItem[0]['url'].includes(arrQueue[idx]['key'])){
                let fileName = arrQueue[idx]['fileName'].toString().replaceAll('\\', '/');  //So we also handles Linux and Mac filesystems
                let arrFileName = fileName.split('/');
                txt = `<b>Processing:</b> "${arrFileName[arrFileName.length-1]}"`;
                break;
            }
        }
    }
    chrome.runtime.sendMessage({ event: 'downloadStatus', prefs: txt});
    return txt;
}

//Checks downloads and return either null if we are not downloading anything, or the id of the item we download
async function getActiveDownloads(){
    let retval = null;  // Return value
    let arrDItem = await chrome.downloads.search({orderBy: ['-startTime'], limit: 50})   //All
    for (const idx in arrDItem){
        const dItem = arrDItem[idx];
        if ((dItem['byExtensionName'] === manifest.name) && (dItem['state'] === 'in_progress')){
            retval = dItem['id'];
            break;
        }
    }
    return retval
}

// Returns the authentication_token from the cookies
async function getPlexCookie(prefs){
    return new Promise((resolve, reject) => {
        let result = null;
        chrome.cookies.get({ url: prefs.url, name: prefs.name}, cookie => {
            if (!chrome.runtime.lastError) {
                // Return the token
                resolve(JSON.parse(decodeURIComponent(cookie['value'])));
            } else {
                reject();
            }
        });
    });
}

// Returns index of n'th orcurrence of a substring in a string
function getPosition(string, subString, index) {
  return string.split(subString, index).join(subString).length;
}

// Returns a server machine ID from an url
function getIDFromURL(url){
    return url.substring(getPosition(url, "/", 6)+1,getPosition(url, "/", 7))
}

//#endregion
