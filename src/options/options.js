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
    const options = {};
    options.selectSubs = arrSelected;
    let elRes = document.getElementById("resolution");
    console.log("Selected resolution: " + elRes.value);
    options.selectRes = elRes.value;
    let elResMax = document.getElementById("resolutionMax");
    options.selectResMax = elResMax.value;
    let elResMin = document.getElementById("resolutionMin");
    options.selectResMin = elResMin.value;
    await browser.storage.local.set({'options': options});
    alert("Options saved!");
}

async function loadOptions() {  // Load the options from storage and populate the multiselect
    let options = (await browser.storage.local.get('options')).options;
    // Subs
    const arrSelectedSubs = options.selectSubs || [];  // Get the selected subs from storage
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
    // Res
    let elRes = document.getElementById("resolution");
    elRes.value = options.selectRes;
    let elResMax = document.getElementById("resolutionMax");
    elResMax.value = options.selectResMax;
    let elResMin = document.getElementById("resolutionMin");
    elResMin.value = options.selectResMin;
}