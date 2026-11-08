/*****************************************
 * This is used by the option page
 *****************************************/

'use strict';

import { langCodes } from './../shared/langCodes.js'
import { MultiSelect } from  '../shared/Multiselect/MultiSelect.js'

console.log("Ged 11 langCodes", langCodes)



const subs = new MultiSelect('#subs', {
    placeholder: 'Click to select',
    search: true,
    selectAll: true,
    data: langCodes
});


//subs.selectedItems

//asyncSelect.addItems(langCodes);
