/*****************************************
 * This is used by the option page
 *****************************************/

'use strict';

import { langCodes } from './../shared/langCodes.js'
import { MultiSelect } from  '../shared/Multiselect/MultiSelect.js'

// Get the save button and add a click event listener
const btnSave = document.getElementById('btnSave');
btnSave.addEventListener("click", saveOptions);

// Create the multiselect for subtitle languages
const subs = new MultiSelect('#subs', {
    placeholder: 'Click to select',
    search: true,
    selectAll: true,
    data: []
});

window.addEventListener('DOMContentLoaded', function () {   // Load the options when the DOM is loaded
  loadOptions();
});

async function saveOptions() {
    const selected = subs.options.data.filter(obj => {
        return obj.selected === true;
    })
    const arrSelected = selected.map(obj => obj.value);
    await browser.storage.local.set({'selectSubs': arrSelected});
    alert("Options saved!");
}

async function loadOptions() {  // Load the options from storage and populate the multiselect
    const arrSelectedSubs = (await browser.storage.local.get('selectSubs')).selectSubs || [];  // Get the selected subs from storage
    const data = [];
    for (const idx in langCodes) {
        let option = langCodes[idx];
        if (arrSelectedSubs.includes(option.value)) {
            option.selected = true;
        }
        data.push(option);
    }
    subs.data = data;
    subs.refresh();
}