/*********************************************
 * This will open a new tab with JSON info
 *********************************************/
"use strict";

async function openJSONTab(srvID, key) {
    const urlJSON = `${SharedServers[srvID]["address"]}/library/metadata/${key}?checkFiles=1&includeAllConcerts=1&includeBandwidths=1&includeChapters=1&includeChildren=1&includeConcerts=1&includeExtras=1&includeFields=1&includeGeolocation=1&includeLoudnessRamps=1&includeMarkers=1&includeOnDeck=1&includePopularLeaves=1&includePreferences=1&includeRelated=1&includeRelatedCount=1&includeReviews=1&includeStations=1&X-Plex-Token=${SharedServers[srvID]["accessToken"]}`;
    let resJSON = null
    await fetch(urlJSON, {
        method: 'GET',
        headers: header
        })
        .then(function(response) { return response.json(); })
        .then(function(json) {
            // use the json
            resJSON = JSON.stringify(json, null, 2)
        });
    const prefs = {};
    prefs['url'] = urlJSON;
    prefs['data'] = resJSON;
    chrome.runtime.sendMessage({ event: 'showJSON', prefs: JSON.parse(JSON.stringify(prefs))}).catch(() => {});
}
