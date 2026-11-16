"use strict";

//(async () => {await browser.storage.local.clear()})();  // Clear all storage

const validTypes = ["movie", "episode"];
var user = {};      // Plex user
var header = {};
var mediaType;
var SharedServers = {}; // Shared servers
var pageType;
const manifest = chrome.runtime.getManifest();  // Get the manifest info
let elTitle = null;


//#region Event Listners and handlers

// Requests allowed
const validRequests = ['gotMedia'];
// Message listner
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id === chrome.runtime.id && validRequests.includes(request.event)){  // Only accept if it came from us and is a valid request
        handleListener(request).then(sendResponse);
        return true; // return true to indicate you want to send a response asynchronously
    } else {
        console.error("Ged 3-3 unauthorized request", request.event)
    }
});

// Handle events
async function handleListener(request){
    let result = null;
    const { event, prefs } = request;
    switch (event) {
        case 'gotMedia':
            gotMedia(request);
            break;
        default:
            break;
    }
    return result;
}

//#endregion

main();

// Main entry point
async function main(){
    if (!user.hasOwnProperty("id")){    //Need to get user info from the cookie
        user = await getPlexCookie("https://app.plex.tv", "plex_tv_auth");
    }
    header = await setHeader();    //Set the web requests header
    getSharedServers();
}

//#region Internal functions

// Returns a server machine ID from an url
function getIDFromURL(url){
    return url.substring(getPosition(url, "/", 6)+1,getPosition(url, "/", 7))
}

// Returns a media key from the current url
function getKeyFromUrl(){
    let key = document.URL.slice(document.URL.indexOf("metadata%2F") + 11);
    if (key.indexOf("&") > -1){
        return key.slice(0, key.indexOf("&"));
    } else {
        return key;
    }
}

// Returns index of n'th orcurrence of a substring in a string
function getPosition(string, subString, index) {
  return string.split(subString, index).join(subString).length;
}

// A delay function
const delay = millis => new Promise((resolve, reject) => {
  setTimeout(_ => resolve(), millis)
});

//gotMedia event triggered
async function gotMedia(request){
    if (request["url"] === document.URL){   //Make sure we still is on the right page
        let el = null;
        while (true) {  // Wait for the title element to be available
            el = document.querySelector('[data-testid="metadata-title"]');
            if (el) {
                break;
            } else {
                // Wait for a short period before checking again
                const waitTime = 100;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        // Now we have the title element, inject the XML and download icons
        const divXML4Plex = await getIconsDiv();
        el.after(divXML4Plex);
    }
}

async function getIconsDiv(){   // Function to create and return a div containing the XML and download icons
    const server = SharedServers[getIDFromURL(document.URL)];
    const divXML4Plex = document.createElement("div");
    divXML4Plex.id = `divXML4Plex`;
    divXML4Plex.className = "divXML4Plex";
    divXML4Plex.appendChild(await getXMLImg());
    divXML4Plex.appendChild(await getJSONImg());
    if (server["allowSync"] && server["plexPass"]){    // Only if we are allowed to download
        divXML4Plex.appendChild(await getdownImg());
    }
    return divXML4Plex;
}

async function getdownImg() {   // Function to create and return the down arrow image element
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/down-arrow.png");
    img.alt = "Down Arrow";
    img.style.width = "20px";
    img.title = "Download";
    img.onclick = function() {  clickDownIcon(); };
    return img;
}

async function getJSONImg() {   // Function to create and return the JSON image element
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/json.png");
    img.alt = "JSON";
    img.style.width = "20px";
    img.title = "View JSON";
    img.onclick = function() {  clickJSONIcon(); };
    return img;
}

async function clickJSONIcon(){   // Function to handle the click event on the JSON icon
    const srvID = getIDFromURL(document.URL);
    const key = getKeyFromUrl(document.URL);
    const urlJSON = `${SharedServers[srvID]["address"]}/library/metadata/${key}?checkFiles=1&includeAllConcerts=1&includeBandwidths=1&includeChapters=1&includeChildren=1&includeConcerts=1&includeExtras=1&includeFields=1&includeGeolocation=1&includeLoudnessRamps=1&includeMarkers=1&includeOnDeck=1&includePopularLeaves=1&includePreferences=1&includeRelated=1&includeRelatedCount=1&includeReviews=1&includeStations=1&X-Plex-Token=${SharedServers[srvID]["accessToken"]}`;
    const blob = await fetch(urlJSON, {headers: header}).then((res) => res.blob());
    var _url = window.URL.createObjectURL(blob);
    window.open(_url, "_blank").focus();
}

async function getXMLImg() {   // Function to create and return the XML image element
    const srvID = getIDFromURL(document.URL);
    const key = getKeyFromUrl(document.URL);
    const urlXML = `${SharedServers[srvID]["address"]}/library/metadata/${key}?checkFiles=1&includeAllConcerts=1&includeBandwidths=1&includeChapters=1&includeChildren=1&includeConcerts=1&includeExtras=1&includeFields=1&includeGeolocation=1&includeLoudnessRamps=1&includeMarkers=1&includeOnDeck=1&includePopularLeaves=1&includePreferences=1&includeRelated=1&includeRelatedCount=1&includeReviews=1&includeStations=1&X-Plex-Token=${SharedServers[srvID]["accessToken"]}`;
    const aXML = document.createElement("a");
    aXML.href = urlXML;
    aXML.target = "_blank";
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/xml.png");
    img.alt = "XML";
    img.style.width = "20px";
    img.title = "View XML";
    aXML.appendChild(img);
    return aXML;
}

function clickDownIcon(){   // Function to handle the click event on the download icon
    const srvID = getIDFromURL(document.URL);
    download(SharedServers[srvID]["address"], getKeyFromUrl(document.URL));
}

// Start fetching shared servers in the backend
async function getSharedServers(){
    let myHeader = JSON.parse(JSON.stringify(header));
    myHeader["X-Plex-Token"] = user["authentication_token"];
    const prefs = {"header": myHeader};
    //chrome.runtime.sendMessage({ event: 'getPlexSharedServers', prefs: prefs });
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
                        value["machine_identifier"] = resources[i]["clientIdentifier"];
                        SharedServers[resources[i]["clientIdentifier"]] = value;
                        getAddressAndInfo(SharedServers[resources[i]["clientIdentifier"]], JSON.parse(JSON.stringify(header)));
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
    setGlobalVars();
}

// Get connection address and more info and update the var SharedServers
async function getAddressAndInfo(srvInfo, myHeader){
    myHeader["X-Plex-Token"] = srvInfo["accessToken"];
    for (var i=0; i < srvInfo["connections"].length; i++){
        if (!srvInfo["connections"][i]["local"] && !srvInfo["connections"][i]["relay"]){
            try {
                let url = `${srvInfo["connections"][i]["uri"]}/media/providers`;
                const response = await fetchWithTimeout(url, {headers: myHeader, timeout: 6000});
                const data = await response.json();
                srvInfo["plexPass"] = data["MediaContainer"]["myPlexSubscription"];
                srvInfo["allowSync"] = data["MediaContainer"]["allowSync"];
                srvInfo["address"] = srvInfo["connections"][i]["uri"];
                SharedServers[srvInfo["machine_identifier"]] = srvInfo;
                delete SharedServers[srvInfo["machine_identifier"]]["connections"];
                break;

            } catch (error) {
                // Catches timeout errors if the request takes longer than 6 seconds
                console.log(error.name === 'AbortError');
            }
        }
    }
    chrome.runtime.sendMessage({ event: 'sharedServers', prefs: SharedServers});
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

function getMediaType(objJSON){ // Returns the media type from a JSON object, or null if not found
    if (objJSON.hasOwnProperty("MediaContainer")){
        if (objJSON["MediaContainer"].hasOwnProperty("Metadata")){
            if (objJSON["MediaContainer"]["Metadata"].length > 0){
                return objJSON["MediaContainer"]["Metadata"][0]["type"];
            }
        }
    }
    return null;
}

function getMediaResolution(objJSON){   // Returns the resolution of the media, or null if not found
    if (objJSON.hasOwnProperty("MediaContainer")){
        if (objJSON["MediaContainer"].hasOwnProperty("Metadata")){
            if (objJSON["MediaContainer"]["Metadata"].length > 0){
                if (objJSON["MediaContainer"]["Metadata"][0].hasOwnProperty("Media")){
                    if (objJSON["MediaContainer"]["Metadata"][0]["Media"].length > 0){
                        return objJSON["MediaContainer"]["Metadata"][0]["Media"][0]["videoResolution"];
                    }
                }
            }
        }
    }
    return null;
}

// Get a list of files/streams to present to the user
async function getMediaList(srvAddress, key){
    const url = `${srvAddress}/library/metadata/${key}?checkFiles=1`;
    const srvID = getIDFromURL(document.URL);
    // Start by getting the media info
    let infoHeader = JSON.parse(JSON.stringify(header));
    infoHeader["X-Plex-Token"] = SharedServers[srvID]["accessToken"];
    let jsonResponse;
    try {
        await fetch(url, {headers: infoHeader}).then( async response => {
            if (response.ok){
                jsonResponse = await response.json();
            }
        });
    } catch(error) {
        alert(`Download failed: ${error}`);
    }
    const mediaType = getMediaType(jsonResponse);
    const mediaResolution = getMediaResolution(jsonResponse);
    if (!validTypes.includes(mediaType)){
        alert(`Media type ${mediaType} is not supported for download`);
        return null;
    }
    let files = {};
    let metadata = jsonResponse["MediaContainer"]["Metadata"];
    const libPath = await getSectionPath(srvAddress, metadata[0]["librarySectionID"], srvID);
    for (let i = 0; i < metadata.length; i++){    // Walk Metadata array
        files[i] = {};
        files[i]["title"] = metadata[i]["title"];
        files[i]["type"] = metadata[i]["type"];
        files[i]["streams"] = [];
        if (metadata[i].hasOwnProperty("grandparentTitle")){
            files[i]["showTitle"] = metadata[i]["grandparentTitle"];
        }
        if (metadata[i].hasOwnProperty("parentIndex")){
            files[i]["season"] = metadata[i]["parentIndex"];
        }
        if (metadata[i].hasOwnProperty("index")){
            files[i]["episode"] = metadata[i]["index"];
        }
        if (metadata[i].hasOwnProperty("summary")){
            files[i]["summary"] = metadata[i]["summary"];
        }
        let medias = metadata[i]["Media"];
        for (let x = 0; x < medias.length; x++){    // Walk Media array
            let media = {};
            media["resolution"] = medias[x]["videoResolution"];
            media["Part"] = [];
            if (medias[x]["Part"][0]["accessible"] && medias[x]["Part"][0]["exists"]){  //Only if file exists and can be accessed
                for (let y = 0; y < medias[x]["Part"].length; y++){ //Walk the parts
                    let filename, filedir;
                    for (let z = 0; z < medias[x]["Part"][y]["Stream"].length; z++){   //Walk the streams
                        let file = {};
                        switch (medias[x]["Part"][y]["Stream"][z]["streamType"]){
                            case 1: // Media file
                                file["title"] = `${files[i]["title"]} (${medias[x]["Part"][y]["Stream"][z]["displayTitle"]})`;
                                file["key"] = medias[x]["Part"][y]["key"];
                                // Get filedir and filename
                                filename = medias[x]["Part"][y]["file"];
                                file["filename"] = filename.split('\\').pop().split('/').pop();
                                for (let n=0; n < libPath.length; n++){ //Walk defined library paths
                                    if ((filename.startsWith(libPath[n])) && ((filename[libPath[n].length] == '/') || (filename[libPath[n].length] == '\\'))) {
                                        file["fileDir"] = filename.slice(libPath[n].length+1).slice(0, -file["filename"].length);
                                        if (file["fileDir"].endsWith("/") || file["fileDir"].endsWith("\\")){
                                            file["fileDir"] = file["fileDir"].slice(0, -1);
                                        }
                                        filedir = file["fileDir"];
                                        break;
                                    }
                                }
                                filename = file["filename"];
                                file["type"] = "media";
                                file["mediaResolution"] = mediaResolution;
                                files[i]["streams"].push(file);
                                break;
                            case 3: // Subtitle
                                if (medias[x]["Part"][y]["Stream"][z].hasOwnProperty("key")){   //Got an external sub?
                                    file["key"] = medias[x]["Part"][y]["Stream"][z]["key"];
                                    file["title"] = medias[x]["Part"][y]["Stream"][z]["extendedDisplayTitle"];
                                    file["filename"] = `${filename.replace(/\.[^/.]+$/, "")}.${medias[x]["Part"][y]["Stream"][z]["languageTag"]}.${medias[x]["Part"][y]["Stream"][z]["format"]}.htm`;
                                    file["fileDir"] = filedir;
                                    file["language"] = medias[x]["Part"][y]["Stream"][z]["language"];
                                    file["type"] = "subtitle";
                                    file["languageTag"] = medias[x]["Part"][y]["Stream"][z]["languageTag"];
                                    files[i]["streams"].push(file);
                                    break;
                                }
                        }
                    }
                }
            }
        }

    }
    return files;
}

// Returns an array of Library paths defined
async function getSectionPath(srvAddress, libID, srvID){
    let result = [];
    // Start by getting the media info
    let infoHeader = JSON.parse(JSON.stringify(header));
    let url = `${srvAddress}/library/sections`;
    infoHeader["X-Plex-Token"] = SharedServers[srvID]["accessToken"];
    let jsonResponse;
    try {
        await fetch(url, {headers: infoHeader}).then( async response => {
            if (response.ok){
                jsonResponse = await response.json();
            }
        });
    } catch(error) {
        alert(`Download failed: ${error}`);
    }
    const directories = jsonResponse["MediaContainer"]["Directory"];
    for (let i = 0; i < directories.length; i++){
        if (directories[i]["key"] == libID.toString()){    // Found the correct library
            for (let x = 0; x < directories[i]["Location"].length; x++){    // add paths to result
                result.push(directories[i]["Location"][x]["path"]);
            }
            break;
        }
    }
    return result;
}

// Hide modal
function fileSelectModalClose(){
    let modal = document.getElementById(`${header["X-Plex-Product"]}-fileSelectModal`);
    modal.style.display = "none";
    modal.remove();
}

// Create a modal file selector for downloads
async function createFileSelect(files){
    const options = (await browser.storage.local.get("options"))["options"] || null;   // Get options to autoselct
    let selectSubs, selectRes
    if (options) {
        selectSubs = options.selectSubs;
        selectRes = options.selectRes;
    } else {
        selectRes = 0;
        selectSubs = [];
    }
    // Main div
    let fileSelectModal = document.createElement("div");
    fileSelectModal.id = `${header["X-Plex-Product"]}-fileSelectModal`;
    fileSelectModal.classList = "media-info-modal modal modal-lg fade in";
    fileSelectModal.ariaHidden = "false";
    fileSelectModal.style = "display: block; show: true";
    document.body.appendChild(fileSelectModal); // Add the modal to the document
    // Modal Dialog
    let fileSelectModalDialog = document.createElement("div");
    fileSelectModalDialog.className = "modal-dialog";
    fileSelectModal.appendChild(fileSelectModalDialog);
    // Modal Content
    let fileSelectModalContent = document.createElement("div");
    fileSelectModalContent.className = "modal-content";
    fileSelectModalDialog.appendChild(fileSelectModalContent);
    // Modal Header
    let fileSelectModalHeader = document.createElement("div");
    fileSelectModalHeader.className = "modal-header";
    let fileSelectModalbtnClose = document.createElement("button");
    fileSelectModalbtnClose.type = "button";
    fileSelectModalbtnClose.className = "close";
    fileSelectModalbtnClose.onclick = function() {  fileSelectModalClose(); };
    // ************ Missing below pic on the modal??? ****************
    let pic = document.createElement("i");
    pic.classList = "glyphicon remove-2";
    fileSelectModalbtnClose.appendChild(pic);
    fileSelectModalHeader.appendChild(fileSelectModalbtnClose);
    let title = document.createElement("h4");
    title.className = "modal-title";
    let titlePic = document.createElement("i");
    titlePic.classList = "modal-icon glyphicon circle-info";
    title.appendChild(titlePic);
    title.innerText = ` ${files[0]["title"]} (Type: ${files[0]["type"]})`;
    fileSelectModalHeader.appendChild(title);
    fileSelectModalContent.appendChild(fileSelectModalHeader);
    // Modal body
    let fileSelectModalBody = document.createElement("div");
    fileSelectModalBody.classList = "modal-body modal-body-scroll dark-scrollbar";
    fileSelectModalBody.innerHTML = `<p>Select items to dowwnload</p>`;
    let fileSelectModalBodyMedia = document.createElement("div");
    if (files[0]["streams"].length > -1){    // We got some files
        for (let i = 0; i < files[0]["streams"].length; i++){    // Add items to the modal selection
            let item = document.createElement('div');
            let itemCB = document.createElement("input");
            itemCB.type = "checkbox";
            itemCB.id = `item${i.toString()}`;
            itemCB.style.marginRight = "5px";
            //itemCB.value = files[0]["streams"][i]["key"];
            itemCB.value = i;
            item.appendChild(itemCB);
            let itemCBLbl = document.createElement("label");
            itemCBLbl.setAttribute("for", `item${i.toString()}`);
            itemCBLbl.innerText = `  ${files[0]["streams"][i]["title"]}`;
            if (files[0]["streams"][i]["type"] === "subtitle" && selectSubs && selectSubs.includes(files[0]["streams"][i]["languageTag"])){
                itemCB.checked = true;
            } else {
                if (files[0]["streams"][i]["mediaResolution"] === selectRes) {
                    itemCB.checked = true;
                }
            }
            item.appendChild(itemCBLbl);
            fileSelectModalBodyMedia.appendChild(item);
        }
    }
    fileSelectModalBody.appendChild(fileSelectModalBodyMedia);
    fileSelectModalContent.appendChild(fileSelectModalBody);
    // Modal footer
    let fileSelectModalFooter = document.createElement("div");
    fileSelectModalFooter.className = "modal-footer";
    let fileSelectModalFooterContents = document.createElement("div");
    fileSelectModalFooterContents.className = "pull-left";
    // Download button
    let fileSelectModalFooterContentsBtnDwn = document.createElement("button");
    fileSelectModalFooterContentsBtnDwn.type = "button";
    fileSelectModalFooterContentsBtnDwn.innerText = "Download";
    fileSelectModalFooterContentsBtnDwn.onclick = function() { downloadItems(files); };
    fileSelectModalFooterContents.appendChild(fileSelectModalFooterContentsBtnDwn);
    fileSelectModalFooter.appendChild(fileSelectModalFooterContents);
    fileSelectModalContent.appendChild(fileSelectModalFooter);
}

// Initiate the download selection view, and send an array of selected items to the queue
async function downloadItems(files){
    const srvID = getIDFromURL(document.URL);
    let itemsDwn = [];
    let arrItemsDwn = [];   // Used by the Queue
    for (let i = 0; i < files[0]["streams"].length; i++){
        let el = document.getElementById(`item${i.toString()}`);
        if (el.checked){
            itemsDwn.push(i);
        }
    }
    fileSelectModalClose();
    if (itemsDwn.length > 0){   // User selected items to download
        for (let i = 0; i < itemsDwn.length; i++){
            let stream = JSON.parse(JSON.stringify(files[0]["streams"][itemsDwn[i]]));
            let queueItem = {};
            queueItem["title"] = files[0]["title"];
            queueItem["type"] = files[0]["type"];
            queueItem["srvID"] = srvID;
            queueItem["key"] = stream["key"];
            if (files[0].hasOwnProperty("showTitle")){
                queueItem["showTitle"] = files[0]["showTitle"];
            }
            if (files[0].hasOwnProperty("season")){
                queueItem["season"] = files[0]["season"];
            }
            if (files[0].hasOwnProperty("episode")){
                queueItem["episode"] = files[0]["episode"];
            }
            queueItem["fileName"] = `${stream["fileDir"]}/${stream["filename"]}`;
            if (queueItem["fileName"].endsWith(".htm")){    // Subtitle file
                queueItem["displayTitle"] = `${files[0]["title"]} ${stream["title"]}`;
                queueItem["type"] = "subtitle";
                queueItem["fileName"] = queueItem["fileName"].slice(0, -4);  // Remove the .htm extension
            } else
            {
                queueItem["displayTitle"] = `${files[0]["title"]} (${queueItem["type"]})`;
                if (files[0].hasOwnProperty("summary")){
                    queueItem["summary"] = files[0]["summary"];
                }
            }
            arrItemsDwn.push(queueItem);
        }
        await chrome.runtime.sendMessage({ event: 'enqueue', prefs: arrItemsDwn});
    } else {
        alert("Nothing selected for download")
    }
}

async function download(srvAddress, key){
    let files = await getMediaList(srvAddress, key);
    if (files && files[0]["streams"].length > 0){    // We got some files
        createFileSelect(files);
    }
}

//Send list of shared servers to the backend
async function setGlobalVars() {
    const prefs = {"servers": Object.keys(SharedServers)};
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ event: 'setGlobalVars', prefs: prefs }, senderResponse => {
            if (senderResponse){
                resolve(senderResponse);
            } else {
                reject();
            }
        });
    });
}

// Get User Info, and return a JSON with the info, or null if failed
async function getPlexCookie(domain, name, callback) {
    const prefs = {"url": domain, "name": name};
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ event: 'getPlexCookie', prefs: prefs }, senderResponse => {
            if (senderResponse){
                resolve(senderResponse);
            } else {
                reject();
            }
        });
    });
}

//Set the header used for web requests, but don't set the token
async function setHeader(){
    if (!header.hasOwnProperty("Accept")){  // We need to set the header
        header["Accept"] = "application/json";
        header["X-Plex-Product"] = manifest["name"];
        header["X-Plex-Version"] = manifest["version"];
        try {
            header["X-Plex-Client-Identifier"] = await getStoredKey("cID");
        } catch {   // Not found, so we need to set one
            let cID = `${(user["thumb"]).split("=")[1]}${user["uuid"]}`;
            await chrome.storage.local.set(    // Store the new cID
                { cID: cID }
            );
            header["X-Plex-Client-Identifier"] = cID;
        }
    }
    chrome.storage.local.set({header: header})
    return header;
}

// Get stored value from synced storage
const getStoredKey = async (key) => {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], function (result) {
        if (result[key] === undefined) {
            reject(false);
        } else {
            resolve(result[key]);
        }
      });
    });
};

//#endregion