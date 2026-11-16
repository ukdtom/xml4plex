/*********************************
 * This is a hidden page that creates a blob and get the url to it for an external subtitle
 *********************************/

"use strict";

//#region Event Listners and handlers
// Requests allowed
const validRequests = ['getObjectURL'];
const returnVal = ['getObjectURL'];   //Requests where we want to return something from

// Message listner
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id === chrome.runtime.id && validRequests.includes(request.event)){  // Only accept if it came from us and is a valid request
        handleListener(request).then(sendResponse);
        if (returnVal.includes(request.event)){
            return true; // return true to indicate you want to send a response asynchronously
        }
    }
});

// Handle events
async function handleListener(request){
    let result = null;
    const { event, prefs } = request;
    switch (event) {
        case 'getObjectURL':
            result = await getObjectURL(prefs);
            break;
        default:
            break;
    }
    return result;
}
//#endregion

async function getObjectURL(prefs){ //Create the blob and grap an url to it we can return to the backend
    let blob = new Blob([prefs], {
            type: 'text/srt'
        });
    let url = window.URL.createObjectURL(blob);
    return url;
}
