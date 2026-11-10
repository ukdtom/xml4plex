/*
* This file containa both code from w3 as well as code specific to xml4Plex
* Code specific to this is kept in a region named xml4Plex
* Injection points are maked with a comment saying `Injected xml4Plex`
*/

/*
 *   This content is licensed according to the W3C Software License at
 *   https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
 */

'use strict';

/**
 * @namespace aria
 * @description
 * The aria namespace is used to support sharing class definitions between example files
 * without causing eslint errors for undefined classes
 */
var aria = aria || {};

// #region xml4Plex

// #region Message listner and handler

// Requests allowed
const validRequests = ['downloadStatus', 'update'];
const returnVal = [];   //Requests where we want to return something from

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.id === chrome.runtime.id){ // Only accept if it came from us
      if (validRequests.includes(request.event)){ // Only accept if it is a valid request
        handleListener(request).then(sendResponse);
        if (returnVal.includes(request.event)){
            return true; // return true to indicate you want to send a response asynchronously
        }
      }
    } else {
        console.error("Ged 3-3 unauthorized request", request.event)
    }
});

// Handle events
async function handleListener(request){
    let result = null;
    const { event, prefs } = request;
    switch (event) {
        case 'downloadStatus':
            result = setdownloadStatus(prefs);
            break;
        case 'update':
            update(prefs);
            break;
        default:
            break;
    }
    return result;
}

// #endregion

let queue;

var arrQueue = [];
var elList = document.getElementById('ss_imp_list');
var bQueueRunning;
const manifest = chrome.runtime.getManifest();

/*
* Updates the Queue window with queue status
* Set the txt and enable/disable for queue button
* Set the txt for what is currently been downloaded
* Update the queue list
*/
async function update(queueNew){
    queue = queueNew;       // Update cache with new info
    setQueueStatus(queue['queueRunning']);  // Show if queue is running or not
    setQueueButton(queue['queueRunning'], (queue['queueOrder'].length > 0));  // Set txt on queue start/stop button and enable/disable if needed
    setListBox();    // Update the listbox from the queue
}

function setListBox() { // Update the listbox from the queue
    // Lets start by clearing the listbox
    const elList = document.getElementById('ss_imp_list');
    const selID = elList.ariaActiveDescendantElement ? elList.ariaActiveDescendantElement['id'] : null;   // Selected element
    const el = document.querySelectorAll('li');
    el.forEach(function(node) {
        let id = node.id;
        let item = document.getElementById(id);
        if (item){
            item.remove();
        }
    });
    if (queue['queueOrder'].length > 0) {    //Queue has contents, so lets show it
        for (let idx in queue['queueOrder']){
            try {
            const listItem = document.createElement('li');
            listItem.setAttribute('role', 'option');
            listItem.setAttribute('id', queue['queueOrder'][idx]);
            listItem.textContent = queue['queueData'][queue['queueOrder'][idx]]["displayTitle"];
            const span = document.createElement('span');
            span.setAttribute('class', 'checkmark');
            span.setAttribute('aria-hidden', 'true');
            listItem.appendChild(span);
            elList.appendChild(listItem);
            } catch(e) {
                continue;
            }
        }
        if (selID) { //Something was selected before
            showInfo(selID);    //Show selected items info
            try {
            elList.setAttribute('aria-activedescendant', selID);    //Select item again
            elList.activeDescendant = selID;
            const el = document.getElementById(selID);
            el.classList.add('focused');
            el.setAttribute('aria-selected', 'true');
            el.setAttribute('aria-hidden', 'false');
            } catch(e) {}
        } else {
            showInfo('click');
        }
    } else {
        showInfo(null);
    }
}

function setQueueButton(status, QueuePresent) { // Set txt on queue start/stop button and enable/disable if needed
    const btnQueue = document.getElementById('btnQueue');
    const btnTxt = !status? 'Start Queue': 'Stop Queue';
    btnQueue.innerText = btnTxt;
    btnQueue.setAttribute('aria-disabled', !QueuePresent.toString());
    btnQueue.disabled = !QueuePresent;
}

function setQueueStatus(status) {   // Show if queue is running or not
    const queueStatus = document.getElementById('queueStatus');
    const htmlTxt = status? `<b>Queue:</b> Running`: "<b>Queue:</b> Stopped";
    queueStatus.innerHTML = htmlTxt;
}

// Show what is currently been downloaded
function setdownloadStatus(prefs){
    const currentDwn = document.getElementById('currentDwn');
    currentDwn.innerHTML = prefs;
}

// Show info for the selected item
async function showInfo(id){
    if (!queue['queueData'].hasOwnProperty(id)) {   // Only show info if item still exists
        id = 'click'
    }
    let txt = '';
    let info = document.getElementById("info");
    switch (id){
        case null:
            txt = 'The queue is empty!';
            break;
        case 'click':
            txt = 'Click on an item to show info';
            break;
        default:
            const item = queue['queueData'][id];
            txt = `<b>Title:</b> ${item["displayTitle"]}<b>Type:</b> ${item["type"]}<b>Server:</b> ${item["srvID"]}<br><b>Key:</b> ${item["key"]}`;
            if (item['se']) {
                txt = `<b>Show Title:</b> ${item["showTitle"]}<br>${txt}`;
                txt += `<br><b>SeasonEpisode:</b> ${item["se"]}`;
            }
            if (["movie", "episode"].includes(item["type"])){
                txt += `<br><b>Summary:</b> ${item["summary"]}`;
            }
            break;
    }
    info.innerHTML = txt;
}

async function populateQueue() {    // Populate the listbox with the download queue
    queue = await chrome.runtime.sendMessage({ event: 'getQueue', prefs: null });   // Get the queue and cache it as well
    await update(queue);    //Update the GUI
    addButtons();
    // Set focus on the listbox
    elList.focus();
}

// Toogle queue status
async function toggleQueue(){
    console.log("Ged 13 TODO *******************************")
    //if (bQueueRunning){
    /*
    if (queue['queueRunning']){
        alert('Existing download will continue until done');
    }
        */
    chrome.runtime.sendMessage({ event: 'toggleQueue' });
}

async function addButtons(){
    // Queue Clear All botton
    let clearButton = document.getElementById('ex1-clear')
    clearButton.addEventListener("click", clearAll);
    if (queue['queueOrder'].length > 0){
        clearButton.setAttribute('aria-disabled', 'false');
    } else {
        clearButton.setAttribute('aria-disabled', 'true');
    }
    // Queue button
    const btnQueue = document.getElementById('btnQueue');
    btnQueue.addEventListener("click", toggleQueue);
}

async function clearAll(){
    await chrome.runtime.sendMessage({ event: 'deleteQueue', prefs: null });
}

async function arraymove(arr, fromIndex, toIndex) {
    var element = arr[fromIndex];
    arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, element);
}

async function saveListBox(clearInfo){
    let id, idx;
    switch (clearInfo.action) {
        case 'delete':
            const itemsToDelete = [];   // tmp array to send to the backend
            for (let idx in clearInfo['id']) {
                id = clearInfo['id'][idx].id;
                itemsToDelete.push(id);
                // Now local cache
                const index = queue['queueOrder'].indexOf(id);
                if (index > -1) { // only splice array when item is found
                    queue['queueOrder'].splice(index, 1); // 2nd parameter means remove one item only
                }
                // Remove from data
                delete queue['queueData'][id];
            }
            chrome.runtime.sendMessage({ event: 'deleteQueueItem', prefs: itemsToDelete })
            break;
        case 'down':
            id = clearInfo['id'][0].id;
            idx = queue['queueOrder'].indexOf(id);
            if (idx < queue['queueOrder'].length){  // Okay to move down
                await arraymove(queue['queueOrder'], idx, idx+1);
                await chrome.runtime.sendMessage({ event: 'newOrder', prefs: queue['queueOrder'] });
            }
            break;
        case 'up':
            id = clearInfo['id'][0].id;
            idx = queue['queueOrder'].indexOf(id);
            if (idx > 0){  // Okay to move up
                await arraymove(queue['queueOrder'], idx, idx-1);
                await chrome.runtime.sendMessage({ event: 'newOrder', prefs: queue['queueOrder'] });
            }
            break;
    }
}

// #endregion


/**
 * @class
 * @description
 *  Listbox object representing the state and interactions for a listbox widget
 * @param listboxNode
 *  The DOM node pointing to the listbox
 */

aria.Listbox = class Listbox {
  constructor(listboxNode) {
    this.listboxNode = listboxNode;
    this.activeDescendant = this.listboxNode.getAttribute(
      'aria-activedescendant'
    );
    this.multiselectable = this.listboxNode.hasAttribute(
      'aria-multiselectable'
    );
    this.moveUpDownEnabled = false;
    this.siblingList = null;
    this.startRangeIndex = 0;
    this.upButton = null;
    this.downButton = null;
    this.moveButton = null;
    this.clearButton = null;    // Injected xml4Plex
    this.keysSoFar = '';
    this.handleFocusChange = function () {};
    this.handleItemChange = function () {};
    this.registerEvents();
  }

  registerEvents() {
    this.listboxNode.addEventListener('focus', this.setupFocus.bind(this));
    this.listboxNode.addEventListener('keydown', this.checkKeyPress.bind(this));
    this.listboxNode.addEventListener('click', this.checkClickItem.bind(this));

    if (this.multiselectable) {
      this.listboxNode.addEventListener(
        'mousedown',
        this.checkMouseDown.bind(this)
      );
    }
  }

  setupFocus() {
    if (this.activeDescendant) {
      const listitem = document.getElementById(this.activeDescendant);
      if (listitem){    //Injected xml4Plex
        listitem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    } else {
      this.focusFirstItem();
    }
  }

  focusFirstItem() {
    var firstItem = this.listboxNode.querySelector('[role="option"]');

    if (firstItem) {
      this.focusItem(firstItem);
    }
  }

  focusLastItem() {
    const itemList = this.listboxNode.querySelectorAll('[role="option"]');

    if (itemList.length) {
      this.focusItem(itemList[itemList.length - 1]);
    }
  }

  checkKeyPress(evt) {
    const lastActiveId = this.activeDescendant;
    const allOptions = this.listboxNode.querySelectorAll('[role="option"]');
    const currentItem =
      document.getElementById(this.activeDescendant) || allOptions[0];
    let nextItem = currentItem;

    if (!currentItem) {
      return;
    }

    switch (evt.key) {
      case 'PageUp':
      case 'PageDown':
        evt.preventDefault();
        if (this.moveUpDownEnabled) {
          if (evt.key === 'PageUp') {
            this.moveUpItems();
          } else {
            this.moveDownItems();
          }
        }

        break;
      case 'ArrowUp':
      case 'ArrowDown':
        evt.preventDefault();
        if (!this.activeDescendant) {
          // focus first option if no option was previously focused, and perform no other actions
          this.focusItem(currentItem);
          break;
        }

        if (this.moveUpDownEnabled && evt.altKey) {
          evt.preventDefault();
          if (evt.key === 'ArrowUp') {
            this.moveUpItems();
          } else {
            this.moveDownItems();
          }
          this.updateScroll();
          return;
        }

        if (evt.key === 'ArrowUp') {
          nextItem = this.findPreviousOption(currentItem);
        } else {
          nextItem = this.findNextOption(currentItem);
        }

        if (nextItem && this.multiselectable && event.shiftKey) {
          this.selectRange(this.startRangeIndex, nextItem);
        }

        if (nextItem) {
          this.focusItem(nextItem);
        }

        break;

      case 'Home':
        evt.preventDefault();
        this.focusFirstItem();

        if (this.multiselectable && evt.shiftKey && evt.ctrlKey) {
          this.selectRange(this.startRangeIndex, 0);
        }
        break;

      case 'End':
        evt.preventDefault();
        this.focusLastItem();

        if (this.multiselectable && evt.shiftKey && evt.ctrlKey) {
          this.selectRange(this.startRangeIndex, allOptions.length - 1);
        }
        break;

      case 'Shift':
        this.startRangeIndex = this.getElementIndex(currentItem, allOptions);
        break;

      case ' ':
        evt.preventDefault();
        this.toggleSelectItem(nextItem);
        break;

      case 'Backspace':
      case 'Delete':
      case 'Enter':
        if (!this.moveButton) {
          return;
        }

        var keyshortcuts = this.moveButton.getAttribute('aria-keyshortcuts');
        if (evt.key === 'Enter' && keyshortcuts.indexOf('Enter') === -1) {
          return;
        }
        if (
          (evt.key === 'Backspace' || evt.key === 'Delete') &&
          keyshortcuts.indexOf('Delete') === -1
        ) {
          return;
        }

        evt.preventDefault();

        var nextUnselected = nextItem.nextElementSibling;
        while (nextUnselected) {
          if (nextUnselected.getAttribute('aria-selected') != 'true') {
            break;
          }
          nextUnselected = nextUnselected.nextElementSibling;
        }
        if (!nextUnselected) {
          nextUnselected = nextItem.previousElementSibling;
          while (nextUnselected) {
            if (nextUnselected.getAttribute('aria-selected') != 'true') {
              break;
            }
            nextUnselected = nextUnselected.previousElementSibling;
          }
        }

        this.moveItems();

        if (!this.activeDescendant && nextUnselected) {
          this.focusItem(nextUnselected);
        }
        break;

      case 'A':
      case 'a':
        // handle control + A
        if (evt.ctrlKey || evt.metaKey) {
          if (this.multiselectable) {
            this.selectRange(0, allOptions.length - 1);
          }
          evt.preventDefault();
          break;
        }
      // fall through
      default:
        if (evt.key.length === 1) {
          const itemToFocus = this.findItemToFocus(evt.key.toLowerCase());
          if (itemToFocus) {
            this.focusItem(itemToFocus);
          }
        }
        break;
    }

    if (this.activeDescendant !== lastActiveId) {
      this.updateScroll();
    }
    // Injected xml4Plex Start
    if (this.activeDescendant){
        showInfo(this.activeDescendant);
    }
    // Injected xml4Plex End
  }

  findItemToFocus(character) {
    const itemList = this.listboxNode.querySelectorAll('[role="option"]');
    let searchIndex = 0;

    if (!this.keysSoFar) {
      for (let i = 0; i < itemList.length; i++) {
        if (itemList[i].getAttribute('id') == this.activeDescendant) {
          searchIndex = i;
        }
      }
    }

    this.keysSoFar += character;
    this.clearKeysSoFarAfterDelay();

    let nextMatch = this.findMatchInRange(
      itemList,
      searchIndex + 1,
      itemList.length
    );

    if (!nextMatch) {
      nextMatch = this.findMatchInRange(itemList, 0, searchIndex);
    }
    return nextMatch;
  }

  /* Return the index of the passed element within the passed array, or null if not found */
  getElementIndex(option, options) {
    const allOptions = Array.prototype.slice.call(options); // convert to array
    const optionIndex = allOptions.indexOf(option);

    return typeof optionIndex === 'number' ? optionIndex : null;
  }

  /* Return the next listbox option, if it exists; otherwise, returns null */
  findNextOption(currentOption) {
    const allOptions = Array.prototype.slice.call(
      this.listboxNode.querySelectorAll('[role="option"]')
    ); // get options array
    const currentOptionIndex = allOptions.indexOf(currentOption);
    let nextOption = null;

    if (currentOptionIndex > -1 && currentOptionIndex < allOptions.length - 1) {
      nextOption = allOptions[currentOptionIndex + 1];
    }

    return nextOption;
  }

  /* Return the previous listbox option, if it exists; otherwise, returns null */
  findPreviousOption(currentOption) {
    const allOptions = Array.prototype.slice.call(
      this.listboxNode.querySelectorAll('[role="option"]')
    ); // get options array
    const currentOptionIndex = allOptions.indexOf(currentOption);
    let previousOption = null;

    if (currentOptionIndex > -1 && currentOptionIndex > 0) {
      previousOption = allOptions[currentOptionIndex - 1];
    }

    return previousOption;
  }

  clearKeysSoFarAfterDelay() {
    if (this.keyClear) {
      clearTimeout(this.keyClear);
      this.keyClear = null;
    }
    this.keyClear = setTimeout(
      function () {
        this.keysSoFar = '';
        this.keyClear = null;
      }.bind(this),
      500
    );
  }

  findMatchInRange(list, startIndex, endIndex) {
    // Find the first item starting with the keysSoFar substring, searching in
    // the specified range of items
    for (let n = startIndex; n < endIndex; n++) {
      const label = list[n].innerText;
      if (label && label.toLowerCase().indexOf(this.keysSoFar) === 0) {
        return list[n];
      }
    }
    return null;
  }

  checkClickItem(evt) {
    if (evt.target.getAttribute('role') !== 'option') {
      return;
    }

    // Injected xml4Plex Start
    //let id = evt.target.id.slice(8);
    //showInfo(id);
    showInfo(evt.target.id);
    // Injected xml4Plex End

    this.focusItem(evt.target);
    this.toggleSelectItem(evt.target);
    this.updateScroll();

    if (this.multiselectable && evt.shiftKey) {
      this.selectRange(this.startRangeIndex, evt.target);
    }
  }

  /**
   * Prevent text selection on shift + click for multi-select listboxes
   *
   * @param evt
   */
  checkMouseDown(evt) {
    if (
      this.multiselectable &&
      evt.shiftKey &&
      evt.target.getAttribute('role') === 'option'
    ) {
      evt.preventDefault();
    }
  }

  /**
   * @description
   *  Toggle the aria-selected value
   * @param element
   *  The element to select
   */
  toggleSelectItem(element) {
    if (this.multiselectable) {
      element.setAttribute(
        'aria-selected',
        element.getAttribute('aria-selected') === 'true' ? 'false' : 'true'
      );

      this.updateMoveButton();
    }
  }

  /**
   * @description
   *  Defocus the specified item
   * @param element
   *  The element to defocus
   */
  defocusItem(element) {
    if (!element) {
      return;
    }
    if (!this.multiselectable) {
      element.removeAttribute('aria-selected');
    }
    element.classList.remove('focused');
  }

  /**
   * @description
   *  Focus on the specified item
   * @param element
   *  The element to focus
   */
  focusItem(element) {
    this.defocusItem(document.getElementById(this.activeDescendant));
    if (!this.multiselectable) {
      element.setAttribute('aria-selected', 'true');
    }
    element.classList.add('focused');
    this.listboxNode.setAttribute('aria-activedescendant', element.id);
    this.activeDescendant = element.id;

    if (!this.multiselectable) {
      this.updateMoveButton();
    }

    this.checkUpDownButtons();
    this.handleFocusChange(element);
  }

  /**
   * Helper function to check if a number is within a range; no side effects.
   *
   * @param index
   * @param start
   * @param end
   * @returns {boolean}
   */
  checkInRange(index, start, end) {
    const rangeStart = start < end ? start : end;
    const rangeEnd = start < end ? end : start;

    return index >= rangeStart && index <= rangeEnd;
  }

  /**
   * Select a range of options
   *
   * @param start
   * @param end
   */
  selectRange(start, end) {
    // get start/end indices
    const allOptions = this.listboxNode.querySelectorAll('[role="option"]');
    const startIndex =
      typeof start === 'number'
        ? start
        : this.getElementIndex(start, allOptions);
    const endIndex =
      typeof end === 'number' ? end : this.getElementIndex(end, allOptions);

    for (let index = 0; index < allOptions.length; index++) {
      const selected = this.checkInRange(index, startIndex, endIndex);
      allOptions[index].setAttribute('aria-selected', selected + '');
    }

    this.updateMoveButton();
  }

  /**
   * Check for selected options and update moveButton, if applicable
   */
  updateMoveButton() {
    if (!this.moveButton) {
      return;
    }

    if (this.listboxNode.querySelector('[aria-selected="true"]')) {
      this.moveButton.setAttribute('aria-disabled', 'false');
    } else {
      this.moveButton.setAttribute('aria-disabled', 'true');
    }
  }

  /**
   * Check if the selected option is in view, and scroll if not
   */
  updateScroll() {
    const selectedOption = document.getElementById(this.activeDescendant);
    if (selectedOption) {
      const scrollBottom =
        this.listboxNode.clientHeight + this.listboxNode.scrollTop;
      const elementBottom =
        selectedOption.offsetTop + selectedOption.offsetHeight;
      if (elementBottom > scrollBottom) {
        this.listboxNode.scrollTop =
          elementBottom - this.listboxNode.clientHeight;
      } else if (selectedOption.offsetTop < this.listboxNode.scrollTop) {
        this.listboxNode.scrollTop = selectedOption.offsetTop;
      }
      selectedOption.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  /**
   * @description
   *  Enable/disable the up/down arrows based on the activeDescendant.
   */
  checkUpDownButtons() {
    const activeElement = document.getElementById(this.activeDescendant);

    if (!this.moveUpDownEnabled) {
      return;
    }

    if (!activeElement) {
      this.upButton.setAttribute('aria-disabled', 'true');
      this.downButton.setAttribute('aria-disabled', 'true');
      return;
    }

    if (this.upButton) {
      if (activeElement.previousElementSibling) {
        this.upButton.setAttribute('aria-disabled', false);
      } else {
        this.upButton.setAttribute('aria-disabled', 'true');
      }
    }

    if (this.downButton) {
      if (activeElement.nextElementSibling) {
        this.downButton.setAttribute('aria-disabled', false);
      } else {
        this.downButton.setAttribute('aria-disabled', 'true');
      }
    }
  }

  /**
   * @description
   *  Add the specified items to the listbox. Assumes items are valid options.
   * @param items
   *  An array of items to add to the listbox
   */
  addItems(items) {
    if (!items || !items.length) {
      return;
    }

    items.forEach(
      function (item) {
        this.defocusItem(item);
        this.toggleSelectItem(item);
        this.listboxNode.append(item);
      }.bind(this)
    );

    if (!this.activeDescendant) {
      this.focusItem(items[0]);
    }

    this.handleItemChange('added', items);
  }

  /**
   * @description
   *  Remove all of the selected items from the listbox; Removes the focused items
   *  in a single select listbox and the items with aria-selected in a multi
   *  select listbox.
   * @returns {Array}
   *  An array of items that were removed from the listbox
   */
  deleteItems() {
    let itemsToDelete;

    if (this.multiselectable) {
      itemsToDelete = this.listboxNode.querySelectorAll(
        '[aria-selected="true"]'
      );
    } else if (this.activeDescendant) {
      itemsToDelete = [document.getElementById(this.activeDescendant)];
    }

    if (!itemsToDelete || !itemsToDelete.length) {
      return [];
    }

    itemsToDelete.forEach(
      function (item) {
        item.remove();

        if (item.id === this.activeDescendant) {
          this.clearActiveDescendant();
        }
      }.bind(this)
    );

    this.handleItemChange('removed', itemsToDelete);
    saveListBox({action: 'delete', id: itemsToDelete});  // `Injected xml4Plex`
    return itemsToDelete;
  }

  clearActiveDescendant() {
    this.activeDescendant = null;
    this.listboxNode.setAttribute('aria-activedescendant', null);

    this.updateMoveButton();
    this.checkUpDownButtons();
  }

  /**
   * @description
   *  Shifts the currently focused item up on the list. No shifting occurs if the
   *  item is already at the top of the list.
   */
  moveUpItems() {
    if (!this.activeDescendant) {
      return;
    }

    const currentItem = document.getElementById(this.activeDescendant);
    const previousItem = currentItem.previousElementSibling;

    if (previousItem) {
      this.listboxNode.insertBefore(currentItem, previousItem);
      this.handleItemChange('moved_up', [currentItem]);
    }

    this.checkUpDownButtons();
    saveListBox({action: 'up', id: [currentItem]});  // `Injected xml4Plex`
  }

  /**
   * @description
   *  Shifts the currently focused item down on the list. No shifting occurs if
   *  the item is already at the end of the list.
   */
  moveDownItems() {
    if (!this.activeDescendant) {
      return;
    }

    var currentItem = document.getElementById(this.activeDescendant);
    var nextItem = currentItem.nextElementSibling;

    if (nextItem) {
      this.listboxNode.insertBefore(nextItem, currentItem);
      this.handleItemChange('moved_down', [currentItem]);
    }

    this.checkUpDownButtons();
    saveListBox({action: 'down', id: [currentItem]});  // `Injected xml4Plex`
  }

  /**
   * @description
   *  Delete the currently selected items and add them to the sibling list.
   */
  moveItems() {
    if (!this.siblingList) {
      return;
    }

    var itemsToMove = this.deleteItems();
    this.siblingList.addItems(itemsToMove);
  }

  /**
   * @description
   *  Enable Up/Down controls to shift items up and down.
   * @param upButton
   *   Up button to trigger up shift
   * @param downButton
   *   Down button to trigger down shift
   */
  enableMoveUpDown(upButton, downButton) {
    this.moveUpDownEnabled = true;
    this.upButton = upButton;
    this.downButton = downButton;
    upButton.addEventListener('click', this.moveUpItems.bind(this));
    downButton.addEventListener('click', this.moveDownItems.bind(this));
  }

  /**
   * @description
   *  Enable Move controls. Moving removes selected items from the current
   *  list and adds them to the sibling list.
   * @param button
   *   Move button to trigger delete
   * @param siblingList
   *   Listbox to move items to
   */
  setupMove(button, siblingList) {
    this.siblingList = siblingList;
    this.moveButton = button;
    button.addEventListener('click', this.moveItems.bind(this));
  }

  setHandleItemChange(handlerFn) {
    this.handleItemChange = handlerFn;
  }

  setHandleFocusChange(focusChangeHandler) {
    this.handleFocusChange = focusChangeHandler;
  }
};
/*
 *   This content is licensed according to the W3C Software License at
 *   https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
 */

'use strict';

/**
 * @namespace aria
 * @description
 * The aria namespace is used to support sharing class definitions between example files
 * without causing eslint errors for undefined classes
 */
var aria = aria || {};

/**
 * @class
 * @description
 *  Toolbar object representing the state and interactions for a toolbar widget
 * @param toolbarNode
 *  The DOM node pointing to the toolbar
 */

aria.Toolbar = class Toolbar {
  constructor(toolbarNode) {
    this.toolbarNode = toolbarNode;
    this.items = this.toolbarNode.querySelectorAll('.toolbar-item');
    this.selectedItem = this.toolbarNode.querySelector('.selected');
    this.registerEvents();
  }

  /**
   * @description
   *  Register events for the toolbar interactions
   */
  registerEvents() {
    this.toolbarNode.addEventListener(
      'keydown',
      this.checkFocusChange.bind(this)
    );
    this.toolbarNode.addEventListener('click', this.checkClickItem.bind(this));
  }

  /**
   * @description
   *  Handle various keyboard commands to move focus:
   *    LEFT:  Previous button
   *    RIGHT: Next button
   *    HOME:  First button
   *    END:   Last button
   * @param evt
   *  The keydown event object
   */
  checkFocusChange(evt) {
    let nextIndex, nextItem;

    // Do not move focus if any modifier keys pressed
    if (!evt.shiftKey && !evt.metaKey && !evt.altKey && !evt.ctrlKey) {
      switch (evt.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
          nextIndex = Array.prototype.indexOf.call(
            this.items,
            this.selectedItem
          );
          nextIndex = evt.key === 'ArrowLeft' ? nextIndex - 1 : nextIndex + 1;
          nextIndex = Math.max(Math.min(nextIndex, this.items.length - 1), 0);

          nextItem = this.items[nextIndex];
          break;

        case 'End':
          nextItem = this.items[this.items.length - 1];
          break;

        case 'Home':
          nextItem = this.items[0];
          break;
      }

      if (nextItem) {
        this.selectItem(nextItem);
        this.focusItem(nextItem);
        evt.stopPropagation();
        evt.preventDefault();
      }
    }
  }

  /**
   * @description
   *  Selects a toolbar item if it is clicked
   * @param evt
   *  The click event object
   */
  checkClickItem(evt) {
    if (evt.target.classList.contains('toolbar-item')) {
      this.selectItem(evt.target);
    }
  }

  /**
   * @description
   *  Deselect the specified item
   * @param element
   *  The item to deselect
   */
  deselectItem(element) {
    element.classList.remove('selected');
    element.setAttribute('aria-selected', 'false');
    element.setAttribute('tabindex', '-1');
  }

  /**
   * @description
   *  Deselect the currently selected item and select the specified item
   * @param element
   *  The item to select
   */
  selectItem(element) {
    this.deselectItem(this.selectedItem);
    element.classList.add('selected');
    element.setAttribute('aria-selected', 'true');
    element.setAttribute('tabindex', '0');
    this.selectedItem = element;
  }

  /**
   * @description
   *  Focus on the specified item
   * @param element
   *  The item to focus on
   */
  focusItem(element) {
    element.focus();
  }
};
/*
 *   This content is licensed according to the W3C Software License at
 *   https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
 */

'use strict';

/**
 * @namespace aria
 * @description
 * The aria namespace is used to support sharing class definitions between example files
 * without causing eslint errors for undefined classes
 */
var aria = aria || {};

/**
 * ARIA Listbox Examples
 *
 * @function onload
 * @description Initialize the listbox examples once the page has loaded
 */


window.addEventListener('DOMContentLoaded', function () {
  // This onload handle initializes two examples. Only initialize example if the example
  // can be found in the dom.
  if (document.getElementById('ss_imp_list')) {
    var ex1ImportantListbox = new aria.Listbox(
      document.getElementById('ss_imp_list')
    );
    populateQueue() // Injected xml4Plex
    var ex1UnimportantListbox = new aria.Listbox(
      document.getElementById('ss_unimp_list')
    );
    new aria.Toolbar(document.querySelector('[role="toolbar"]'));

    ex1ImportantListbox.enableMoveUpDown(
      document.getElementById('ex1-up'),
      document.getElementById('ex1-down')
    );
    ex1ImportantListbox.setupMove(
      document.getElementById('ex1-delete'),
      ex1UnimportantListbox
    );
    ex1ImportantListbox.setHandleItemChange(function (event, items) {
      var updateText = '';

      switch (event) {
        case 'added':
          updateText =
            'Moved ' + items[0].innerText + ' to important features.';
          break;
        case 'removed':
          updateText =
            'Moved ' + items[0].innerText + ' to unimportant features.';
          break;
        case 'moved_up':
        case 'moved_down':
          var pos = Array.prototype.indexOf.call(
            this.listboxNode.children,
            items[0]
          );
          pos++;
          updateText = 'Moved to position ' + pos;
          break;
      }

      if (updateText) {
        var ex1LiveRegion = document.getElementById('ss_live_region');
        ex1LiveRegion.innerText = updateText;
      }
    });
    ex1UnimportantListbox.setupMove(
      document.getElementById('ex1-add'),
      ex1ImportantListbox
    );
  }

  // This onload handle initializes two examples. Only initialize example if the example
  // can be found in the dom.
  if (document.getElementById('ms_imp_list')) {
    var ex2ImportantListbox = new aria.Listbox(
      document.getElementById('ms_imp_list')
    );
    var ex2UnimportantListbox = new aria.Listbox(
      document.getElementById('ms_unimp_list')
    );

    ex2ImportantListbox.setupMove(
      document.getElementById('ex2-add'),
      ex2UnimportantListbox
    );
    ex2UnimportantListbox.setupMove(
      document.getElementById('ex2-delete'),
      ex2ImportantListbox
    );
    ex2UnimportantListbox.setHandleItemChange(function (event, items) {
      var updateText = '';
      var itemText = items.length === 1 ? '1 item' : items.length + ' items';

      switch (event) {
        case 'added':
          updateText = 'Added ' + itemText + ' to chosen features.';
          break;
        case 'removed':
          updateText = 'Removed ' + itemText + ' from chosen features.';
          break;
      }

      if (updateText) {
        var ex1LiveRegion = document.getElementById('ms_live_region');
        ex1LiveRegion.innerText = updateText;
      }
    });
  }
});