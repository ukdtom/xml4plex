/*****************************************
 * This defines the classes used for medias and subs
 * Used by backend Queue and Contents script
 *****************************************/

'use strict';

const prefix = 'ss_elem_';  // Id prefix, that matches the listbox

export class itemMovie {   // Movie class
    constructor() {
        this.type = 'movie';
        this.title = null;
        this.summary = null;
        this.srvID = null;
        this.key = null;
        this.id = null;
        this.fileName = null;
        this.displayTitle = null;
    }

    add (data) {
        this.title = data.title;
        this.summary = data.summary;
        this.srvID = data.srvID;
        this.key = data.key;
        this.id = (() => {
            const keys = this.key.split('/');
            return `${prefix}${keys[3]}-${keys[4]}`
        })();
        this.fileName = data.fileName;
        this.displayTitle = data.displayTitle;
        return this;
    }
}

export class itemSub { // Subtitle class
    constructor() {
        this.type = 'subtitle';
        this.title = null;
        this.srvID = null;
        this.key = null;
        this.fileName = null;
        this.displayTitle = null;
        this.id = null;
        this.showTitle = null;  // Only set if sub is for an episode
        this.se = null; //SxxEyy
    }

    add (data) {
        this.title = data.title;
        this.srvID = data.srvID;
        this.key = data.key;
        this.fileName = data.fileName;
        this.displayTitle = data.displayTitle;
        // Generate the ID
        const arrKey = data['key'].split('/');
        if ( data.hasOwnProperty('episode')) {  // Sub is for an episode
            this.showTitle = data.showTitle;
            this.se = `S${data["season"].toString().padStart(2, "0")}E${data["episode"].toString().padStart(2, "0")}`;
            this.id = `${prefix}${this.srvID}-${arrKey[3]}`;
        } else {    // Sub is for a movie
            this.id = `${prefix}${this.srvID}-${arrKey[3]}`;
        }
        return this;
    }
}

export class itemEpisode { // Episode class
    constructor() {
        this.type = 'episode';
        this.title = null;
        this.summary = null;
        this.srvID = null;
        this.showTitle = null;
        this.key = null;
        this.id = null;
        this.fileName = null;
        this.displayTitle = null;
        this.se = null;
    }

    add (data) {
        this.title = data.title;
        this.summary = data.summary;
        this.srvID = data.srvID;
        this.showTitle = data.showTitle;
        this.key = data.key;
        this.id = (() => {
            const keys = this.key.split('/');
            return `${prefix}${keys[3]}-${keys[4]}`
        })();
        this.fileName = data.fileName;
        this.displayTitle = data.displayTitle;
        this.se = `S${data["season"].toString().padStart(2, "0")}E${data["episode"].toString().padStart(2, "0")}`;
        return this;
    }
}