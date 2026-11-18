/************************************
 * Contents script for the showJSON page
 ************************************/
"use strict";

addEventListener("DOMContentLoaded", (event) => {   // Fires when the DOM is ready
    chrome.runtime.sendMessage({event: 'jsonPageReady'});
});

// Requests allowed
const validRequestsJSON = ['updateJSONPage'];
const returnVal = [];   //Requests where we want to return something from

browser.runtime.onMessage.addListener((request, sender) => {
  if (sender.id === chrome.runtime.id && validRequestsJSON.includes(request.event)){  // Only accept if it came from us and is a valid request
    fillInfo(request);
  }
});

function fillInfo(request) { // Populate the html with url and JSON info
    // URL info
    const elUrl = document.getElementById('url');
    let elA = document.createElement('a')
    elA.setAttribute('href',request.prefs.url);
    elA.innerHTML = request.prefs.url;
    elUrl.appendChild(elA)
    // JSON info
    const elJSON = document.getElementById('json');
    const elJSONHTML = renderjson
        .set_show_to_level("all")
        .set_icons('+', '-')
        (JSON.parse(request.prefs.data)
    )
    elJSON.appendChild(elJSONHTML);
}
