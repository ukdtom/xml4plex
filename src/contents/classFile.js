/*********************************************
 * This file contains classes for the frontend contents scripts
 *********************************************/

"use strict";

const prefix = 'ss_elem_';  // Id prefix, that matches the listbox
const additionalParam = 'excludeElements=Producer,Role,Writer,Rating,Director,Image,Guid,UltraBlurColors,Genre,Country,CommonSenseMedia&excludeFields=viewCount,identifier,mediaTagPrefix,librarySectionUUID,grandparentSlug,mediaTagVersion,librarySectionKey,librarySectionTitle,parentRatingKey,grandparentRatingKey,parentGuid,grandparentGuid,grandparentKey,parentKey,titleSort,contentRating,audienceRating,thumb,parentThumb,grandparentThumb,art,grandparentArt,lastViewedAt,grandparentTheme,year,duration,originallyAvailableAt,addedAt,updatedAt,audienceRatingImage,hasVoiceActivity,videoProfile,videoFrameRate,container,videoCodec,audioCodec,audioChannels,aspectRatio,height,width,bitrate,id,size,codec,default,bitDepth,chromaLocation,chromaSubsampling,codedHeight,codedWidth,colorPrimaries,colorRange,colorSpace,colorTrc,frameRate,level,profile,refFrames,canNormalizeLoudness,channels,audioChannelLayout,samplingRate,canAutoSync,slug,studio,primaryExtraKey,contentRatingAge,originalTitle&includeExtras=1';

class fileItem {
    constructor() {
        this.type = null;
        this.title = null;
        this.srvID = null;
        this.key = null;
        this.fileName = null;
        this.displayTitle = null;
        this.id = null;
        this.languageTag = null;
        this.showTitle = null;  // Only set if sub is for an episode
        this.se = null; // SxxEyy and only for an episode
        this.resolution = null; // Only for a video
        this.summary = null;
        this.albumTitle = null;
        this.artist = null;
        this.trackNo = null;
    }

    async add(response, libPath, type, srvAddress) {
        switch (type) {
            case 'movie':
                return await this.#addMovie(response, libPath);
            case 'episode':
                return await this.#addEpisode(response, libPath);
            case 'show':
                return await this.#addShow(response, libPath, srvAddress);
            case 'season':
                return await this.#addSeason(response, libPath, srvAddress);
            case 'album':
                return await this.#addAlbum(response, libPath, srvAddress);
            default:
                return [];
        }
    }

     async #addAlbum(response, libPath, srvAddress) {   // Add an album
        const options = await chrome.runtime.sendMessage({ event: 'getOptions', prefs: null });
        const lyrics = options? options.lyrics : false;
        let result = [];
        let trackUrls = []; // Placeholder for real track urls
        let images = [];
        let imagePath = null;
        const srvID = getIDFromURL(document.URL);
        for (let idxMetadata=0; idxMetadata < response.MediaContainer.Metadata.length; idxMetadata++) {
            const key = response.MediaContainer.Metadata[idxMetadata].key;
            const url = `${srvAddress}${key}?${additionalParam}`;
            const tracks = await fetchUrl(url, srvID);
            if (response.MediaContainer.Metadata[idxMetadata].hasOwnProperty('Image')) {
                images.push(response.MediaContainer.Metadata[idxMetadata].Image)
            }
            for (let idxTrack=0; idxTrack < tracks.MediaContainer.Metadata.length; idxTrack++) {    // Walk the tracks
                const track = tracks.MediaContainer.Metadata[idxTrack];
                let item = new fileItem();
                item.title = track.title;
                item.type = track.type;
                item.summary = track.summary;
                item.srvID = srvID;
                item.albumTitle = track.parentTitle;
                item.artist = track.grandparentTitle;
                item.displayTitle = `${item.artist} - ${item.albumTitle} - ${item.title} (${item.type})`;
                item.trackNo = track.index;
                for (let idxMedia=0; idxMedia < track.Media.length; idxMedia++) {
                    const media = track.Media[idxMedia];
                    for (let idxPart=0; idxPart < media.Part.length; idxPart++) {
                        const part = media.Part[idxPart];
                        item.key = part.key;
                        const arrKey = item.key.split('/');
                        item.id = `${prefix}-${arrKey[3]}-${arrKey[4]}`;
                        // File
                        const fileName = part.file;
                        for (let idx = 0; idx < libPath.length; idx++) {
                            if (fileName.startsWith(libPath[idx]) && ((fileName[libPath[idx].length] == '/') || (fileName[libPath[idx].length] == '\\'))) {
                                item.fileName = fileName.slice(libPath[idx].length + 1);
                                break;
                            }
                        }
                        result.push(item);
                        imagePath = item.fileName.slice(0, item.fileName.lastIndexOf('\\'));
                    }
                }
                if (lyrics) {   // Lyrics selected, so we sadly needs to get the real track as well
                    trackUrls.push( `${srvAddress}${track.key}?${additionalParam}`);
                }
            }
        }
        if (trackUrls.length > 0) {
            for (let idx=0; idx < trackUrls.length; idx++) { // Get the real track info
                const track = await fetchUrl(trackUrls[idx], srvID);
                for (let idxMetadata=0; idxMetadata < track.MediaContainer.Metadata.length; idxMetadata++) {
                    const metadata = track.MediaContainer.Metadata[idxMetadata];
                    for (let idxMedia=0; idxMedia < metadata.Media.length; idxMedia++) {
                        const media = metadata.Media[idxMedia];
                        for (let idxPart=0; idxPart < media.Part.length; idxPart++) {
                            const part = media.Part[idxPart];
                            for (let idxStream=0; idxStream < part.Stream.length; idxStream++) {
                                const stream = part.Stream[idxStream];
                                if (stream.streamType === 4 && stream.provider === 'com.plexapp.agents.localmedia') {  // We found local Lyrics
                                    const item = new fileItem();
                                    item.srvID = srvID;
                                    item.albumTitle = metadata.parentTitle;
                                    item.title = metadata.title;
                                    item.artist = metadata.grandparentTitle;
                                    item.key = stream.key;
                                    item.type = 'lyrics';
                                    item.displayTitle = `${item.artist} - ${item.albumTitle} - ${item.title} - ${stream.extendedDisplayTitle} (${item.type})`;
                                    const arrKey = item.key.split('/');
                                    item.id = `${prefix}-${srvID}-${arrKey[3]}`
                                    let fileName = part.file;
                                    for (let idx = 0; idx < libPath.length; idx++) {
                                        if (fileName.startsWith(libPath[idx]) && ((fileName[libPath[idx].length] == '/') || (fileName[libPath[idx].length] == '\\'))) {
                                            fileName = fileName.slice(libPath[idx].length + 1);
                                            break;
                                        }
                                    }
                                    const lastDot = fileName.lastIndexOf('.');
                                    item.fileName = `${fileName.slice(0, lastDot)}.${stream.format}`;
                                    result.push(item);
                                }
                            }
                        }
                    }
                }

            }

        }
        if (images.length > 0) { // We got Images to add as well
            for (let idx=0; idx < images[0].length; idx++) {
                const image = images[0][idx];
                let item = new fileItem();
                item.srvID = srvID;
                item.key = image.url;
                const arrKeys = item.key.split('/');
                item.type = 'poster'
                if (image.type === 'coverPoster') {
                    item.title = 'cover';
                } else {
                    item.title = image.type;
                }
                item.id = `${prefix}${arrKeys[3]}-${arrKeys[5]}-${item.title}`;
                item.displayTitle = `${image.alt} - ${item.title} (${item.type})`;
                // Filename
                item.fileName = `${imagePath}\\${item.title}.jpg`
                result.push(item);
            }
        }
        return result;
    }

    async #addSeason(response, libPath, srvAddress) { // Add a season
        let result = [];
        const seasons = [];
        const srvID = getIDFromURL(document.URL);
        for (let idxSeason = 0; idxSeason < response.MediaContainer.Metadata.length; idxSeason++) { // Walk the metaData
            const season = response.MediaContainer.Metadata[idxSeason];
            const title = `${response.MediaContainer.Metadata[idxSeason].parentTitle} - ${response.MediaContainer.Metadata[idxSeason].title}`;
            // Extras
            if (season.hasOwnProperty('Extras')) {
                if (season.Extras.hasOwnProperty('Metadata')) {
                    if (season.Extras.Metadata.length > 0) {
                    for (let idxExtras = 0; idxExtras < season.Extras.Metadata.length; idxExtras++) {
                        const extraSeason = season.Extras.Metadata[idxExtras];
                        if (extraSeason.guid.startsWith('file://')) { // We got a local extra
                            const extra = await this.#addExtraItem(extraSeason, libPath, title);
                            result.push(extra);
                        }
                    }
                }
                }
            }
            // Episodes
            const urlEpisodes = `${srvAddress}${season.key}?${additionalParam}`;
            const episodes = await fetchUrl(urlEpisodes, srvID);
            const Metadata = episodes.MediaContainer.Metadata;
            for (let idxMetadata = 0; idxMetadata < episodes.MediaContainer.Metadata.length; idxMetadata++) {
                const episodeMetadata = episodes.MediaContainer.Metadata[idxMetadata];
                const urlEpisode = `${srvAddress}${episodeMetadata.key}?checkFiles=1&${additionalParam}`;
                const episodeSeason = await fetchUrl(urlEpisode, srvID);
                const results = await this.#addEpisode(episodeSeason, libPath);
                for (let idxResult = 0; idxResult < results.length; idxResult++) {
                    result.push(results[idxResult]);
                }
            }
        }
        return result;
    }

    async #addShow(response, libPath, srvAddress) {  // Add a whole show
        let result = [];
        let key = null;
        // Start to check if we have an extras for the show
        for (let idxMetadata = 0; idxMetadata < response.MediaContainer.Metadata.length; idxMetadata++) {   // Walk the metadata
            const metaData = response.MediaContainer.Metadata[idxMetadata];
            key = metaData.key.split('/')[3];   // Key for the show
            if (metaData.hasOwnProperty('Extras')) {
                if (metaData.Extras.hasOwnProperty('Metadata')) {
                    for (let idxExtra = 0; idxExtra < metaData.Extras.Metadata.length; idxExtra++) {    // Walk the extras
                        const extra = metaData.Extras.Metadata[idxExtra];
                        if (extra.guid.startsWith('file://')) { // We found a local extra
                            result.push(await this.#addExtraItem(extra, libPath, metaData.title));
                        }
                    }
                }
            }
        }
        // Now we need the seasons
        const url = `${srvAddress}/library/metadata/${key}/children?${additionalParam}`;
        const srvID = getIDFromURL(document.URL);
        const showResponse = await fetchUrl(url, srvID);
        for (let idxMetadata=0; idxMetadata < showResponse.MediaContainer.Metadata.length; idxMetadata++) {
            const seasonURL = `${srvAddress}/library/metadata/${showResponse.MediaContainer.Metadata[idxMetadata].ratingKey}?${additionalParam}`;
            const season = await fetchUrl(seasonURL, srvID);
            const seasonItems = await this.#addSeason(season, libPath, srvAddress);
            for (let idx=0; idx < seasonItems.length; idx++) {
                result.push(seasonItems[idx]);
            }
        }
        return result;
    }

    async #addEpisode(response, libPath) {
        let result = [];
        let fileName = null;    // placeholder for filename without extention
        for (let idxMetadata= 0; idxMetadata < response.MediaContainer.Metadata.length; idxMetadata++) {
            const metaData = response.MediaContainer.Metadata[idxMetadata];
            if (metaData.hasOwnProperty('Extras')) {    // Potential extras
                if (metaData.Extras.hasOwnProperty('Metadata')) {
                    for (let idxExtras = 0; idxExtras < metaData.Extras.Metadata.length; idxExtras++) {
                        result.push(await this.#addExtraItem(metaData.Extras.Metadata[idxExtras], libPath, metaData.title));
                    }
                }
            }
            const item = new fileItem();
            item.showTitle = metaData.grandparentTitle;
            item.srvID = await getIDFromURL(document.URL);
            item.summary = metaData.summary;
            item.title = metaData.title;
            item.se = `S${(metaData.parentIndex).toString().padStart(2, "0")}E${(metaData.index).toString().padStart(2, "0")}`;
            if (metaData.parentIndex === 0) {
                item.type = 'special'
            } else {
                item.type = metaData.type;
            }
            for (let idxMedia = 0; idxMedia < metaData.Media.length; idxMedia++) {
                const media = metaData.Media[idxMedia];
                item.resolution = media.videoResolution;
                for (let idxPart = 0; idxPart < media.Part.length; idxPart++) { // Walk the parts
                    const part = media.Part[idxPart];
                    if (!part.accessible) { // Not avail, so we must abort this part
                        continue;
                    }
                    // File
                    const videoFileName = part.file;
                    for (let idx = 0; idx < libPath.length; idx++) {
                        if (videoFileName.startsWith(libPath[idx]) && ((videoFileName[libPath[idx].length] == '/') || (videoFileName[libPath[idx].length] == '\\'))) {
                            item.fileName = videoFileName.slice(libPath[idx].length + 1);
                            const idxDot = item.fileName.lastIndexOf('.');
                            fileName = item.fileName.substr(0, idxDot); // store video filename without the ext so we can reuse it for subs
                            break;
                        }
                    }
                    for (let idxStream = 0; idxStream < part.Stream.length; idxStream++) {  // Walk the streams
                        const stream = part.Stream[idxStream];
                        switch (stream.streamType) {
                            case 1: // We have a video stream
                                item.displayTitle = `${item.title} ${stream.extendedDisplayTitle}`;
                                if (item.type === 'special') {
                                    item.displayTitle = `${item.displayTitle} (Special)`;
                                } else {
                                    item.displayTitle = `${item.displayTitle} (Episode)`;
                                }
                                item.key = part.key;
                                const arrKey = item.key.split('/');
                                item.id = `${prefix}-${arrKey[3]}-${arrKey[4]}`;
                                result.push(item);
                                break;
                            case 3: // We have a subtitle
                                if (stream.hasOwnProperty('key')) { // It's an external subtitle
                                    let itemSrt = JSON.parse(JSON.stringify(item));
                                    itemSrt.key = stream.key;
                                    itemSrt.type = 'subtitle';
                                    const arrKey = itemSrt.key.split('/');
                                    itemSrt.id = `${prefix}-${itemSrt.srvID}-${arrKey[3]}`;
                                    itemSrt.displayTitle =  `${item.displayTitle} ${stream.extendedDisplayTitle}`;
                                    itemSrt.languageTag = stream.languageTag;
                                    itemSrt.fileName = `${fileName}.${itemSrt.languageTag}.${stream.format}`;
                                    result.push(itemSrt);
                                }
                                break;
                        }
                    }
                }
            }
        }


        return result;
    }

    async #addMovie(response, libPath) {
        let arrItems = [];
        arrItems = arrItems.concat(await this.#addExtraMovie(response, libPath));
        arrItems = arrItems.concat(await this.#addMovieItems(response, libPath));
        return arrItems;
    }

    async #addExtraMovie(response, libPath) { // Add extras for a movie
        const result = [];
        for (let idxMetadata = 0; idxMetadata < response['MediaContainer']['Metadata'].length; idxMetadata++) {
            if (response['MediaContainer']['Metadata'][idxMetadata].hasOwnProperty('Extras')) { //We found some extras
                for (let idxExtras = 0; idxExtras < response['MediaContainer']['Metadata'][idxMetadata]['Extras']['Metadata'].length; idxExtras++) {    // Walk the extras and find local candidates
                    const extra = response['MediaContainer']['Metadata'][idxMetadata]['Extras']['Metadata'][idxExtras];
                    if (extra['guid'].startsWith('file://')) {  //Local extra
                        result.push(await this.#addExtraItem(extra, libPath, response['MediaContainer']['Metadata'][idxMetadata]['title']));
                    }
                }
            }
        }
        return result;
    }

    async #addExtraItem(extra, libPath, title) { // Add the extra item
        // ********** TODO Only if extras are present ********
        const item = new fileItem();
        item.title = extra.title;
        item.type = 'extra';
        item.key = extra.Media[0].Part[0].key;
        item.displayTitle = `${title} - ${item.title} (Extra)`;
        item.srvID = await getIDFromURL(document.URL);
        item.resolution = extra.Media[0].videoResolution;
        const arrKey = item.key.split('/');
        item.id = `${prefix}${arrKey[3]}-${arrKey[4]}`;
        //fileName
        const videoFileName = extra.Media[0].Part[0].file;
        for (let idx = 0; idx < libPath.length; idx++) {
            if (videoFileName.startsWith(libPath[idx]) && ((videoFileName[libPath[idx].length] == '/') || (videoFileName[libPath[idx].length] == '\\'))) {
                item.fileName = videoFileName.slice(libPath[idx].length + 1);
                break;
            }
        }
        return item;
    }

    async #addMovieItems(response, libPath) { // Add a movie
        let result = [];
        for (let idxMetadata = 0; idxMetadata < response.MediaContainer.Metadata.length; idxMetadata++) { // Walk the Metadata
            const item = new fileItem();
            const entry = response.MediaContainer.Metadata[idxMetadata];
            item.title = entry.title;
            item.type = entry.type;
            item.srvID = await getIDFromURL(document.URL);
            item.summary = entry.summary;
            for (let idxMedia = 0; idxMedia < entry.Media.length; idxMedia++) {  // Walk the medias
                const media = entry.Media[idxMedia];
                item.resolution = media.videoResolution;
                for (let idxParts = 0; idxParts < media.Part.length; idxParts++) {  // Walk the parts
                    const part = media.Part[idxParts];
                    if (!part.accessible) { // Item can not be reached
                        continue;
                    }
                    item.key = part.key;
                    const arrKey = item.key.split('/');
                    item.id = `${prefix}${arrKey[3]}-${arrKey[4]}`;
                    // File Name
                    const videoFileName = part.file;
                    for (let idx = 0; idx < libPath.length; idx++) {
                        if (videoFileName.startsWith(libPath[idx]) && ((videoFileName[libPath[idx].length] == '/') || (videoFileName[libPath[idx].length] == '\\'))) {
                            item.fileName = videoFileName.slice(libPath[idx].length + 1);
                            break;
                        }
                    }
                    for (let idxStream = 0; idxStream < part.Stream.length; idxStream++) {  // Walk the streams
                        let stream = part.Stream[idxStream];
                        switch (stream.streamType) {
                            case 1: // Media
                                const newItem = JSON.parse(JSON.stringify(item));
                                newItem.displayTitle = `${item.title} ${stream.extendedDisplayTitle} (${item.type})`;
                                item.displayTitle = newItem.displayTitle;
                                if (newItem.key) { // We found a key for the item, so it's okay to add
                                    result.push(newItem);
                                }
                                break;
                            case 3: // Subtitle
                                if (stream.hasOwnProperty('key')) { // We found an external subtitle
                                    const newItem = JSON.parse(JSON.stringify(item));
                                    newItem.type = stream.format;
                                    newItem.displayTitle = `${item.displayTitle} ${stream.displayTitle} (External ${newItem.type})`;
                                    newItem.key = stream.key;
                                    const arrKey = newItem.key.split('/');
                                    newItem.id = `${prefix}-${item.srvID}-${arrKey[3]}`;
                                    // File
                                    newItem.fileName = `${newItem.fileName.replace(/\.[^/.]+$/, "")}.${stream.languageTag}.${stream.format}`;
                                    result.push(newItem);
                                    break;
                                }
                        }
                    }
                }
            }
        }
        return result;
    }
}
