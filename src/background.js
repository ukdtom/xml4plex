"use strict";

// Global vars
var servers = [];
var product;
var urlName = {};


//#region  Event Listners

// Message listner
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleListener(request).then(sendResponse);
    return true; // return true to indicate you want to send a response asynchronously
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
//#endregion


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
        case 'download':
            download(prefs);
            break;
        case 'setGlobalVars':
            servers = prefs["servers"];
            product = prefs["product"];
            break;
        default:
            break;
    }
    return result;
}

//#region  Internal functions

// Get Media prefs
async function getMedia(prefs){
    if (prefs["changeInfo"]["url"].indexOf("key=%2Flibrary%2Fmetadata%2F") > 0){    //Only react when watching a media
        if (servers.includes(getIDFromURL(prefs["changeInfo"]["url"]))){    //Only react if this is a shared server
            const message = {"event": "gotMedia", "url": prefs["changeInfo"]["url"]};
            chrome.tabs.sendMessage(prefs["tabId"], message);
        }
    }
}

// Download a media
function download(prefs) {
    chrome.downloads.download(prefs);
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
