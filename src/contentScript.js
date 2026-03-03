"use strict";

const validTypes = ["movie", "episode"];

var user = {};      // Plex user
var header = {};
var mediaType;

// Message listner
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Remove footer if already present
    const elFooter = document.getElementById(`${header["X-Plex-Product"]}ModalFooter`);
    if (elFooter){
        elFooter.remove(); // Removes the footer from the modal again
    }
    if (request["event"] == "gotMedia"){
        gotMedia(request);
    }
});

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

async function injectFooter(ratingKey, mediaPrefs){
    if ( validTypes.includes(JSON.parse(JSON.stringify(mediaType)))){
        let modalContent = document.getElementsByClassName("modal-content");
        if (modalContent.length > 0){
            // Create modal footer, but if there already remove it first
            let footer = document.getElementById(`${header["X-Plex-Product"]}ModalFooter`);
            if (footer){
                footer.remove();
            }
            let divModalFooter = document.createElement("div");
            divModalFooter.id = `${header["X-Plex-Product"]}ModalFooter`;
            divModalFooter.className = "modal-footer";
            let divBottom = document.createElement("div");
            divBottom.className = "pull-left";
            // XML button
            // Need to get info for media
            let url = `${mediaPrefs["server"]["address"].slice(0,-16)}/library/metadata/${ratingKey}?checkFiles=1&includeAllConcerts=1&includeBandwidths=1&includeChapters=1&includeChildren=1&includeConcerts=1&includeExtras=1&includeFields=1&includeGeolocation=1&includeLoudnessRamps=1&includeMarkers=1&includeOnDeck=1&includePopularLeaves=1&includePreferences=1&includeRelated=1&includeRelatedCount=1&includeReviews=1&includeStations=1&X-Plex-Token=${mediaPrefs["server"]["accessToken"]}`;
            let aXML = document.createElement("a");
            aXML.id = "aXML";
            aXML.target = "_blank";
            aXML.innerText = "View XML";
            aXML.href = url;
            aXML.style.marginRight = "5px";
            divBottom.appendChild(aXML);
            divModalFooter.appendChild(aXML);
            // Add download button if we are allowed to download
            if (mediaPrefs["server"]["allowSync"]){
                let dwnBotton = document.createElement("button");
                dwnBotton.id = "dwnButton";
                dwnBotton.innerText = "Download";
                dwnBotton.onclick = function() {  download(mediaPrefs); };
                divBottom.appendChild(dwnBotton);
            }
            divModalFooter.appendChild(divBottom);
            modalContent[0].appendChild(divModalFooter);
            // And let's remove our modal if present
            let el = document.getElementById(`${header["X-Plex-Product"]}-fileSelectModal`);
            if (el){
                el.remove();
            }
        }
    }
}

// Returns a server machine ID from an url
function getIDFromURL(url){
    return url.substring(getPosition(url, "/", 6)+1,getPosition(url, "/", 7))
}

// Returns a media key from the current url
function getKeyFromUrl(){
    let key = document.URL.slice(document.URL.indexOf("metadata%2F") + 11);
    return key.slice(0, key.indexOf("&"));
}

// Returns index of n'th orcurrence of a substring in a string
function getPosition(string, subString, index) {
  return string.split(subString, index).join(subString).length;
}

function watchForModal(mediaPrefs){
    const targetNode = document.body;
    // Options for the observer (which mutations to observe)
    const config = { attributes: true, childList: true, subtree: true };
    // Callback function to execute when mutations are observed
    const callback = (mutationList) => {
        for (const mutation of mutationList) {
            if (mutation.type === "attributes" && mutation.attributeName === "data-popper-placement"){
                if (document.URL.startsWith("https://app.plex.tv/desktop/#!/server")){
                    let srvID = getIDFromURL(document.URL);
                    if (mediaPrefs["servers"].includes(srvID)){    //Only for shared servers
                        let modalContent = document.getElementsByClassName("modal-content");
                        if (modalContent.length > 0){ // We have the modal opened
                            injectFooter(mediaPrefs["key"], mediaPrefs);
                        }
                    }
                }
            }
        }
    };
    // Create an observer instance linked to the callback function
    const modalObserver = new MutationObserver(callback);
    // Start observing the target node for configured mutations
    modalObserver.observe(targetNode, config);
}

//gotMedia
async function gotMedia(request){
    // Lookup the media to check if this is a movie or an episode
    let address = request["mediaPrefs"]["server"]["address"].slice(0,-16);
    // Get key from url
    let key = getKeyFromUrl();
    let url = `${address}/library/metadata/${key}`;
    request["mediaPrefs"]["key"] = key;
    let myHeader = JSON.parse(JSON.stringify(header));
    myHeader["X-Plex-Token"] = request["mediaPrefs"]["server"]["accessToken"];
    let jsonResponse;
    try {
        await fetch(url, {headers: myHeader}).then( async response => {
            if (response.ok){
                jsonResponse = await response.json();
            }
        });
    } catch(error) {
        alert(`JSON download failed for url: ${url} with the error: ${error}`);
    }
    mediaType = JSON.parse(JSON.stringify(jsonResponse["MediaContainer"]["Metadata"][0]["type"]));
    if (validTypes.includes(mediaType)){
        watchForModal(request["mediaPrefs"]);
    } else {
        request = null;
    }
}

// Start fetching shared servers in the backend
function getSharedServers(){
    let myHeader = JSON.parse(JSON.stringify(header));
    myHeader["X-Plex-Token"] = user["authentication_token"];
    const prefs = {"header": myHeader};
    chrome.runtime.sendMessage({ event: 'getPlexSharedServers', prefs: prefs });
}

// Get a list of files/streams to present to the user
async function getMediaList(mediaPrefs){
    let url = `${mediaPrefs["server"]["address"].slice(0,-16)}/library/metadata/${mediaPrefs["key"]}`;
    // Start by getting the media info
    let infoHeader = JSON.parse(JSON.stringify(header));
    infoHeader["X-Plex-Token"] = mediaPrefs["server"]["accessToken"];
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
    let files = {};
    let metadata = jsonResponse["MediaContainer"]["Metadata"];
    for (let i = 0; i < metadata.length; i++){    // Walk Metadata array
        files[i] = {};
        files[i]["title"] = metadata[i]["title"];
        files[i]["type"] = metadata[i]["type"];
        files[i]["files"] = [];
        let file = {};
        let medias = metadata[i]["Media"];
        for (let x = 0; x < medias.length; x++){    // Walk Media array
            let parts = metadata[i]["Media"][x]["Part"];
            //medias["Part"] = {};
            for (let y = 0; y < parts.length; y++){    // Walk Part array
                let filename = medias[x]["Part"][y]["file"].replace(/^.*[\\/]/, '');
                file = {};
                file["filename"] = filename
                file["key"] = medias[x]["Part"][y]["key"];
                file["type"] = metadata[i]["type"];
                files[i]["files"].push(file);
                for (let z = 0; z < medias[x]["Part"][y]["Stream"].length; z++){    // Walk streams array
                    let stream = medias[x]["Part"][y]["Stream"][z];
                    if (stream.hasOwnProperty("key") && stream["streamType"] == 3 ){
                        file = {};
                        file["filename"] = `${filename.replace(/\.[^/.]+$/, "")}.${stream["languageTag"]}.${stream["format"]}`;
                        file["key"] = stream["key"];
                        file["type"] = stream["extendedDisplayTitle"];
                        files[i]["files"].push(file);
                    }
                }
            }
        }
    }
    return files;
}

// Hide modal
function fileSelectModalClose(){
    let modal = document.getElementById(`${header["X-Plex-Product"]}-fileSelectModal`);
    modal.style.display = "none";
}

// Create a modal file selector for downloads
async function createFileSelect(files, mediaPrefs){
    // Remove if it already exists
    let el = document.getElementById(`${header["X-Plex-Product"]}-fileSelectModal`);
    if (el){
        el.remove();
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
    fileSelectModalBody.innerHTML = `<p>Select items to dowwnload</p><p>Note: when downloading a subtitle, remove the .htm extention when saving</p>`;
    if (files[0]["files"].length > -1){    // We got some files
        var fileSelectModalBodyMedia = document.createElement("div");
        let fileSelectModalBodyMediaCBMedia = document.createElement("input");
        fileSelectModalBodyMediaCBMedia.type = "checkbox";
        fileSelectModalBodyMediaCBMedia.id = `item0`;
        fileSelectModalBodyMediaCBMedia.style.marginRight = "5px";
        fileSelectModalBodyMediaCBMedia.value = files[0]["files"][0]["key"];
        fileSelectModalBodyMedia.appendChild(fileSelectModalBodyMediaCBMedia);
        let fileSelectModalBodyMediaCBMediaLbl = document.createElement("label");
        fileSelectModalBodyMediaCBMediaLbl.setAttribute("for", "item0");
        fileSelectModalBodyMediaCBMediaLbl.innerText = `  ${files[0]["files"][0]["filename"]}`;
        fileSelectModalBodyMedia.appendChild(fileSelectModalBodyMediaCBMediaLbl);
        if (files[0]["files"].length > -0){ // We got subtitles as well
            for (let i = 1; i < files[0]["files"].length; i++){    // Add subs to array
                let newSub = document.createElement('div');
                let newSubCBSub = document.createElement("input");
                newSubCBSub.type = "checkbox";
                newSubCBSub.id = `item${i.toString()}`;
                newSubCBSub.style.marginRight = "5px";
                newSubCBSub.value = files[0]["files"][i]["key"];
                newSub.appendChild(newSubCBSub);
                let newSubCBSubLbl = document.createElement("label");
                newSubCBSubLbl.setAttribute("for", `item${i.toString()}`);
                newSubCBSubLbl.innerText = `  ${files[0]["files"][i]["type"]}`;
                newSub.appendChild(newSubCBSubLbl);
                fileSelectModalBodyMedia.appendChild(newSub);
            }
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
    fileSelectModalFooterContentsBtnDwn.onclick = function() { downloadItems(files, mediaPrefs); };
    fileSelectModalFooterContents.appendChild(fileSelectModalFooterContentsBtnDwn);
    fileSelectModalFooter.appendChild(fileSelectModalFooterContents);
    fileSelectModalContent.appendChild(fileSelectModalFooter);
}

// Initiate the download
async function downloadItems(files, mediaPrefs){
    fileSelectModalClose();
    let itemsDwn = [];
    for (let i = 0; i < files[0]["files"].length; i++){
        let el = document.getElementById(`item${i.toString()}`);
        if (el.checked){
            const item = Object.values(files[0]["files"]).filter(item => item.key === el.value)
            itemsDwn.push(item[0]);
        }
    }
    if (itemsDwn.length > 0){
        // Make the prefs
        let prefs = {};
        prefs["saveAs"] = false;
        let dwnHeader = [];
        let entry = {};
        const keys = Object.keys(header);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (key != 'Accept'){
                let entry = {};
                entry["name"] = key;
                entry["value"] = header[key];
                dwnHeader.push(entry);
            }
        }
        prefs["headers"] = dwnHeader;
        let token = {};
        token["name"] = "X-Plex-Token";
        token["value"] = mediaPrefs["server"]["accessToken"];
        prefs["headers"].push(token);
        for (let i = 0; i < itemsDwn.length; i++){
            prefs["url"] = `${mediaPrefs["server"]["address"].slice(0, -16)}${itemsDwn[i]["key"]}?download=1`;
            prefs["filename"] = itemsDwn[i]["filename"];
            chrome.runtime.sendMessage({ event: 'download', prefs: prefs });
        }
    } else {
        alert("Nothing selected for download")
    }
}

async function download(mediaPrefs){
    let files = await getMediaList(mediaPrefs);
    createFileSelect(files, mediaPrefs);
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
        let manifest = chrome.runtime.getManifest();
        header["Accept"] = "application/json";
        header["X-Plex-Product"] = manifest["name"];
        header["X-Plex-Version"] = manifest["version"];
        try {
            header["X-Plex-Client-Identifier"] = await getStoredKey("cID");
        } catch {   // Not found, so we need to set one
            let cID = `${(user["thumb"]).split("=")[1]}${user["uuid"]}`;
            await chrome.storage.sync.set(    // Store the new cID
                { cID: cID }
            );
            header["X-Plex-Client-Identifier"] = cID;
        }
    }
    return header;
}

// Get stored value from synced storage
const getStoredKey = async (key) => {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([key], function (result) {
        if (result[key] === undefined) {
            reject(false);
        } else {
            resolve(result[key]);
        }
      });
    });
};

//#endregion