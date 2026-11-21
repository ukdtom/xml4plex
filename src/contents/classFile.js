/*********************************************
 * This file contains classes for the frontend contents scripts
 *********************************************/

"use strict";

const prefix = 'ss_elem_';  // Id prefix, that matches the listbox

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
    }

    async add(jsonResponse, libPath) {
        const metadataLength = jsonResponse["MediaContainer"]["Metadata"].length;
        let arrFiles = [];
        for (let idxMetadata = 0; idxMetadata < metadataLength; idxMetadata++) {
            let extras = [];
            const mediaLength = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"].length;
            const mediaTitle = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["title"];
            for (let idxMedia = 0; idxMedia < mediaLength; idxMedia++){
                if (jsonResponse["MediaContainer"]["Metadata"][idxMetadata].hasOwnProperty('Extras')) {  //Extras found
                    extras = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]['Extras']['Metadata'];
                    console.log("Ged 66 extras", extras)
                    for (let idxExtra = 0; idxExtra < extras.length; idxExtra++) {  // Let's walk the extras and see if they are local
                        const extra = extras[idxExtra];
                        if (extra['guid'].startsWith('file')) { // We found a local Extra
                            console.log("Ged 67 extra", extra)
                            let file = new fileItem();
                            let extraRec = file.#addExtra(extra, libPath, mediaTitle);
                            console.log("Ged 55 extraRec", extraRec)



                        }

                    }

                }
                const partLength = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"].length;
                for (let idxPart = 0; idxPart < partLength; idxPart++){
                    const streamLength = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["Stream"].length;
                    for (let idxStream = 0; idxStream < streamLength; idxStream++) {
                        let file = new fileItem();
                        file = file.#add(jsonResponse, idxMetadata, idxMedia, idxPart, idxStream, libPath);
                        if (file) {
                            arrFiles.push(file);
                        }
                    }
                }
            }
        }
        // Now look for local extras and add those as well

        return arrFiles;
    }

    #addExtra(jsonResponse, libPath, mediaTitle) {  // Adds an extra record
        console.log("Ged 99 extra", jsonResponse)
        this.title = jsonResponse['title'];
        this.type = 'Extra';
        this.videoResolution = jsonResponse['Media'][0]['videoResolution'];
        this.resolution = this.videoResolution;
        this.key = jsonResponse['Media'][0]['Part'][0]['key'];
        this.displayTitle = `${mediaTitle} - ${this.title} (${this.type})`;
        this.srvID = getIDFromURL(document.URL);
        const arrKey = this.key.split('/');
        this.id = `${prefix}-${this.srvID}-${arrKey[3]}-${this.type}`;
        //File Name
        const extraFile = jsonResponse['Media'][0]['Part'][0]['file'];
        console.log("Ged 78 extraFileName", extraFile)
        for (let idx = 0; idx < libPath.length; idx++) {
            if (extraFile.startsWith(libPath[idx]) && ((extraFile[libPath[idx].length] == '/') || (extraFile[libPath[idx].length] == '\\'))) {
                this.fileName = extraFile.slice(libPath[idx].length + 1);
                mediaName = this.fileName.replace(/^.*[\\/]/, '');
                mediaDir = this.fileName.replace(this.fileName.replace(/^.*[\\/]/, ''), '');
                break;
            }
        }



        return this;
    }

    #add(jsonResponse, idxMetadata, idxMedia, idxPart, idxStream, libPath){
        // Get the media type
        const streamType = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["Stream"][idxStream]["streamType"];
        this.srvID = getIDFromURL(document.URL);
        this.title = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["title"];
        if ([1,3].includes(streamType)) {   // Only for subs and video
            switch (streamType) {
                case 1: // Video
                    this.type = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["type"];
                    this.resolution = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["videoResolution"];
                    this.key = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["key"];
                    this.title = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["title"];
                    this.displayTitle = `${this.title} ${jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["Stream"][idxStream]["extendedDisplayTitle"]} (${this.type})`
                    this.summary = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]['summary'];
                    break;
                case 3: // Subs
                    this.type = 'subtitle';
                    this.key = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["Stream"][idxStream]["key"];
                    if (!this.key) {    // Internal subtitle
                        return null;
                    }
                    this.languageTag = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["Stream"][idxStream]["languageTag"];
                    this.displayTitle = `${this.title} ${jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["Stream"][0]["extendedDisplayTitle"]} ${jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["Stream"][idxStream]["extendedDisplayTitle"]}`;
                    break;
            }
            const arrKey = this.key.split('/');
            if (arrKey.includes('parts')) { //We have a video
                this.id = `${prefix}${arrKey[3]}-${arrKey[4]}`;
                // Filename
                const videoFileName = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["file"];
                for (let idx = 0; idx < libPath.length; idx++) {
                    if (videoFileName.startsWith(libPath[idx]) && ((videoFileName[libPath[idx].length] == '/') || (videoFileName[libPath[idx].length] == '\\'))) {
                        this.fileName = videoFileName.slice(libPath[idx].length + 1);
                        mediaName = this.fileName.replace(/^.*[\\/]/, '');
                        mediaDir = this.fileName.replace(this.fileName.replace(/^.*[\\/]/, ''), '');
                        break;
                    }
                }
            } else {    //We have a subtitle
                this.id = `${prefix}${this.srvID}-${arrKey[3]}`
                const lastDot = mediaName.lastIndexOf('.');
                this.fileName = `${mediaDir}${mediaName.substring(0, lastDot)}.${jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["Stream"][idxStream]["languageTag"]}.${jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["Media"][idxMedia]["Part"][idxPart]["Stream"][idxStream]["format"]}`;
            }
            if (jsonResponse["MediaContainer"]["Metadata"][idxMetadata].hasOwnProperty("grandparentTitle")) {  //We have an episode
                this.showTitle = jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["grandparentTitle"];
                this.se = `S${jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["parentIndex"].toString().padStart(2, "0")}E${jsonResponse["MediaContainer"]["Metadata"][idxMetadata]["index"].toString().padStart(2, "0")}`;
            }
            return this;
        }
        return null;
    }
}
