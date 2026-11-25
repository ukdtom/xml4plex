"use strict";
import {encryptValue, decryptValue} from '../shared/crypto.js';
import { queue4 } from './queue4.js';

// Init the queue
let queue45 = new queue4;
queue45.updateFromStorage();

// Global vars
var servers = [];
var serversInfo = [];
const manifest = chrome.runtime.getManifest();  // Get the manifest.json for this extention
let messageJSON = null; // Plaseholder for showJSON info

//#region Event Listners and handlers

// Requests allowed
const validRequests = ['getPlexCookie', 'setGlobalVars', 'sharedServers', 'enqueue', 'deleteQueue', 'getQueue', 'deleteQueueItem', 'newOrder', 'toggleQueue', 'showJSON', 'jsonPageReady', 'getOptions'];
const returnVal = ['sharedServers', 'getPlexCookie', 'getQueue', 'getOptions'];   //Requests where we want to return something from

// Message listner
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id === chrome.runtime.id && validRequests.includes(request.event)){  // Only accept if it came from us and is a valid request
        handleListener(request).then(sendResponse);
        if (returnVal.includes(request.event)){
            return true; // return true to indicate you want to send a response asynchronously
        }
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

// Handle events
async function handleListener(request){
    let result = null;
    const { event, prefs } = request;
    switch (event) {
        case 'getMedia':
            result = await getMedia(prefs);
            break;
        case 'getPlexCookie':
            result = await getPlexCookie(prefs);
            break;
        case 'setGlobalVars':
            servers = prefs["servers"];
            break;
        case 'sharedServers':
           serversInfo = prefs;
           setServerInfo();
           break;
        case 'enqueue':
            await queue45.enqueue(prefs);
            break;
        case 'deleteQueue':
            await queue45.deleteQueue4();
            break;
        case 'getQueue':
            queue45 = await queue45.updateFromStorage();
            result = queue45;
            break;
        case 'deleteQueueItem':
            await queue45.deleteQueueItem(prefs);
            break;
        case 'newOrder':
            queue45.newOrder(prefs);
            break;
        case 'toggleQueue':
            queue45.toggleQueue();
            break;
        case 'showJSON':
            showJSON(prefs);
            break;
        case 'jsonPageReady':
            jsonPageReady();
            break;
        case 'getOptions':
            result = await getOptions();
        default:
            break;
    }
    return result;
}
//#endregion


//#region  Internal functions

async function getOptions() {   // Return the options
    return (await browser.storage.local.get('options')).options;
}

async function jsonPageReady() {  // send info to the showJSON tab
    await browser.tabs.sendMessage(
        messageJSON.tabID,
        messageJSON
    )
    messageJSON = null;
}

async function showJSON(prefs) {    // Open the showJSON page in a new tab
    let tabID = (await chrome.tabs.create({ url: chrome.runtime.getURL("screens/json/json.html") })).id;
    messageJSON = { tabID: tabID, event: 'updateJSONPage', prefs: prefs};
}

async function setServerInfo(){
    const secret = await encryptValue(JSON.stringify(serversInfo))
    await browser.storage.local.set({'serverInfo': secret})
}

// Get Media prefs
async function getMedia(prefs){
    if (prefs["tab"]["url"].indexOf("key=%2Flibrary%2Fmetadata%2F") > 0){    //Only react when watching a media
        if (servers.includes(getIDFromURL(prefs["changeInfo"]["url"]))){    //Only react if this is a shared server
            const message = {"event": "gotMedia", "url": prefs["changeInfo"]["url"]};
            chrome.tabs.sendMessage(prefs["tabId"], message);
        }
    }
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
