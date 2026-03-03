"use strict";

// Global vars
var servers = {};
var header = null;
var urlName = {};


//#region  Event Listners

// Message listner
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleListener(request).then(sendResponse);
    return true; // return true to indicate you want to send a response asynchronously
});


//Download filename listner
chrome.downloads.onDeterminingFilename.addListener(function(item, __suggest) {
    if (item["byExtensionName"] === header["X-Plex-Product"]){
        __suggest({filename: urlName[item["url"]]});
    } else {
         __suggest(null);
    }
    return true;
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
        case 'getPlexSharedServers':
            await getPlexSharedServers(prefs);
            break;
        case 'download':
            download(prefs);
            break;
        default:
            break;
    }
    return result;
}

//#region  Internal functions

// Returns the authentication_token from the cookies

// Get Media prefs
async function getMedia(prefs){
    let idxSrvEnd = prefs["changeInfo"]["url"].indexOf("/details");
    let machine_identifier = prefs["changeInfo"]["url"].substring(38, idxSrvEnd);
    if (servers.hasOwnProperty(machine_identifier)){
        if (!servers[machine_identifier].hasOwnProperty("address")){
            await (testcon(header, machine_identifier, servers[machine_identifier]));
        }
        let idxKeyStart = prefs["changeInfo"]["url"].indexOf("metadata%2F")+11;
        let idxKeyEnd = prefs["changeInfo"]["url"].indexOf("&context=");
        let key = prefs["changeInfo"]["url"].substring(idxKeyStart, idxKeyEnd);
        let mediaPrefs = {};
        mediaPrefs["key"] = key;
        mediaPrefs["server"] = servers[machine_identifier];
        mediaPrefs["servers"] = Object.keys(servers);
        const message = {"event": "gotMedia", "mediaPrefs": mediaPrefs};
        chrome.tabs.sendMessage(prefs["tabId"], message);
    }
}

// Download a media
function download(prefs) {
    chrome.downloads.download(prefs, function(downloadId) {
        if (prefs["filename"].endsWith("srt")){
            urlName[prefs["url"]] = `${prefs["filename"]}.srt`;
        } else {
            urlName[prefs["url"]] = prefs["filename"];
        }
        if (downloadId) {
          const msg = `Downloaded file: "${prefs.filename}" ok`;
          console.log(msg);
        } else {
          var error = chrome.runtime.lastError.toString();
          if (error.indexOf('Download canceled by the user') >= 0) {
            const msg = `Save canceled`;
            console.log(msg);
          } else {
            const msg = `We had an error: "${error}"`;
            console.log(msg);
          }
        }
    });
}

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

// Get shared servers
async function getPlexSharedServers(prefs){
    let url = "https://plex.tv/api/v2/resources?includeHttps=1&includeRelay=1";
    // Get the shared servers
    let result = {};
    let resources = null;
    try {
        await fetch(url, {headers: prefs["header"]}).then( async response => {
            if (response.ok){
                resources = await response.json();
                // Now only add needed info
                for (var i = 0; i < resources.length; i++){
                    if (!resources[i]["owned"] && resources[i]["product"] === "Plex Media Server"){
                        // Fill out the gaps
                        let value = {};
                        value["name"] = resources[i]["name"];
                        value["accessToken"] = resources[i]["accessToken"];
                        value["connections"] = resources[i]["connections"];
                        servers[resources[i]["clientIdentifier"]] = value;
                    }
                }
            } else {
                console.error(`Status ${response.status} happened for url: ${url}`)
                console.error(`Status TXT ${response.statusText} happened for url: ${url}`)
                return null;
            }
        });
    } catch (error) {
        console.error(`Getting url: ${url} failed with error ${JSON.stringify(error)}`);
        result = null;
    }
    getConAndInfo(prefs);
}

// Get connection address and more info
function getConAndInfo(prefs){
    header = prefs["header"];
    for (var key in servers){   // Get info for each shared server
        testcon(header, key, servers[key]);
    }
}

// Fetch with a default timeout with a default of 8000 millisec
async function fetchWithTimeout(uri, options = {}) {
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(uri, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(timer);
    return response;
}

// Returns JSON if we found a PMS, else null
async function testcon(header, key, entry){
    let myHeader = JSON.parse(JSON.stringify(header));
    myHeader["X-Plex-Token"] = entry["accessToken"];
    for (var i=0; i < entry["connections"].length; i++){
        if (!entry["connections"][i]["local"] && !entry["connections"][i]["relay"]){
            try {
                let url = `${entry["connections"][i]["uri"]}/media/providers`;
                const response = await fetchWithTimeout(url, { headers: myHeader, timeout: 6000});
                const data = await response.json();
                servers[key]["machine_identifier"] = data["MediaContainer"]["machineIdentifier"];
                servers[key]["plexPass"] = data["MediaContainer"]["myPlexSubscription"];
                servers[key]["allowSync"] = data["MediaContainer"]["allowSync"];
                servers[key]["address"] = url;
                break;
            } catch (error) {
                // Catches timeout errors if the request takes longer than 6 seconds
                console.log(error.name === 'AbortError');
            }
        }
    }
}

//#endregion
