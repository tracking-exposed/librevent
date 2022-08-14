// Import other utils to handle the DOM and scrape data.
import _ from 'lodash';

import { createPanel } from './panel';
import config from './config';
import hub from './hub';
import { registerHandlers } from './handlers/index';
import { mineEvent } from './parser';
import { investigate } from './hasher';

// bo is the browser object, in chrome is named 'chrome', in firefox is 'browser'
const bo = chrome || browser;

function getRandomBlock () {
  return Math.random().toString(36).substring(2, 13) +
    Math.random().toString(36).substring(2, 13);
}

// variable used to spot differences due to refresh and url change
let randomUUID = 'INIT|' + getRandomBlock();

// Frequency of url change and decision
const hrefPERIODICmsCHECK = 4000;
let lastURL = null;
const FB_PAGE_SELECTOR = '[role="main"]';
const cacheSize = {
  seen: 0,
  sentTimes: 0
};

// Boot the user script. This is the first function called.
// Everything starts from here.
function boot () {
  // this get executed only on facebook.com
  console.log(`Librevent extension settings: ${JSON.stringify(config)}`);

  // Register all the event handlers.
  // An event handler is a piece of code responsible for a specific task.
  // You can learn more in the [`./handlers`](./handlers/index.html) directory.
  registerHandlers(hub);

  // Lookup the current user and decide what to do.
  localLookup(response => {
    // `response` contains the user's public key, we save it global for the blinks
    console.log(`Librevent local settings: ${JSON.stringify(response, undefined, 2)} from localLookup`);

    /* these parameters are loaded from localstorage */
    config.publicKey = response.publicKey;
    config.active = response.active;
    config.ux = response.ux;

    if (config.active !== true) {
      console.log('Librevent looks disabled, you should enabled it via popup');
      return;
    }

    initializeBlinks();
    window.setInterval(hrefUpdateMonitor, hrefPERIODICmsCHECK);
    flush();
  });
}

function acceptableHref (pathname) {
 /* the events path are five:
  * https://www.facebook.com/events?source=46&action_history=null
  * https://www.facebook.com/events/440531403865204/?acontext=%7B%22even
  * + page event + pg/page event
  *
  * but now we support only direct event page!
  *  */
  return !!pathname.match(/^\/events\/(\d+)/);
}

function meaningfulCachedDifference (elem) {
  const ts = elem.outerHTML.length;
  const fivepercentless = (ts / 20) * 19;
  let retval = false;

  cacheSize.sentTimes++;

  if (ts < 4000) {
    console.debug('Event triggered too early, current HTML is way too small to be collected');
  } else if (cacheSize.seen < fivepercentless) {
    console.debug('Observed a (meaningful) size update from', cacheSize.seen,
      'to', ts, 'page seen', cacheSize.seenTimes, 'times');
    retval = true;
  }
  /* else: the increase was lesser than 5% so it is ignored */

  cacheSize.seen = ts;
  return retval;
}

function cleanCache () {
  cacheSize.seen = 0;
  cacheSize.sentTimes = 0;
}

function hrefUpdateMonitor () {
  if (!acceptableHref(window.location.pathname)) {
    console.debug(window.location.pathname, 'Ignored pathname as only events are considered');
    return;
  }
  // check if the main element is present: this might also causes a few race
  // condition, in the case of slow network. can it be? TO BE TESTED.
  const elem = document.querySelector(FB_PAGE_SELECTOR);
  if (!elem) {
    console.log(
      'Unexpected: not found selector',
      FB_PAGE_SELECTOR,
      'in',
      window.location.href,
    );
    return;
  }

  // if is different from the previous, is the first time observed
  const diff = window.location.href !== lastURL;
  // regardless of diff, update the current one as also the last one
  lastURL = window.location.href;

  // continue the step, if new, clean cache
  if (diff) {
    cleanCache();
    randomUUID = getRandomBlock().substring(28);
  }

  if (!meaningfulCachedDifference(elem)) {
    return;
  }

  if (!currentPhase) {
    console.log('Initializing phase as first');
    currentPhase = 'first';
  }

  let investiresult = null;
  try {
    investiresult = investigate(elem);
    console.log(investiresult);
  } catch (error) {
    console.log('Error in investigation:', error.message);
  }

  let metadata = {};
  try {
    metadata = mineEvent(elem);
    console.log('Event spotted and mined successfully', metadata);
  } catch (error) {
    console.log('Event spotted but error in mining', error.message);
    metadata.error = error.message;
  }
  hub.event('newContent', {
    metadata,
    element: elem.outerHTML,
    href: window.location.href,
    when: Date(),
    update: cacheSize.sentTimes,
    randomUUID
  });
}

// The function `localLookup` communicates with the **action pages**
// to get information about the current user from the browser storage
// (the browser storage is unreachable from a **content script**).
function localLookup (callback) {
  bo.runtime.sendMessage(
    {
      type: 'localLookup',
      payload: {
        userId: 'local' // at the moment is fixed to 'local'
      }
    },
    callback,
  );
}

// The function `remoteLookup` communicate the intention
// to the server of performing a certain test, and retrive
// the userPseudonym from the server
// this is not used atm but might be worthy
function remoteLookup (callback) {
  bo.runtime.sendMessage(
    {
      type: 'remoteLookup',
      payload: {
        // window.location.pathname.split('/')
        // Array(4) [ "", "d", "1886119869", "Soccer" ]
        // window.location.pathname.split('/')[2]
        // "1886119869"
        testId: window.location.pathname.split('/')[2]
      }
    },
    callback,
  );
}

function flush () {
  window.addEventListener('beforeunload', e => {
    hub.event('windowUnload');
  });
}

// Before booting the app, we need to update the current configuration
// with some values we can retrieve only from the `chrome`space.
bo.runtime.sendMessage({type: 'chromeConfig'}, response => {
  Object.assign(config, response);
  boot();
});

function runPageAnalysis () {
  const elem = document.querySelector(FB_PAGE_SELECTOR);
  if (!elem) { return; }

  console.log('executing runPageAnalysis by click!');
  let investiresult = null;
  try {
    investiresult = investigate(elem);
    console.log(investiresult);
  } catch (error) {
    console.log('Error in investigation:', error.message);
  }
}

/* **************************************************************
 ..########....##.........####...##....##...##....##....######...
 ..##.....##...##..........##....###...##...##...##....##....##..
 ..##.....##...##..........##....####..##...##..##.....##........
 ..########....##..........##....##.##.##...#####.......######...
 ..##.....##...##..........##....##..####...##..##...........##..
 ..##.....##...##..........##....##...###...##...##....##....##..
 ..########....########...####...##....##...##....##....######...
 ************************************************************** */

let currentPhase = null;
export function dispatchIconClick (id) {
  console.debug('Handling a click to: ', id, "and currently we're in phase", currentPhase);
  /* when someone click on a button, check if the event is worthy of being analyzed and trimmed */
  runPageAnalysis();

  if (!id || !id.length) return;

  if (!currentPhase) {
    const node = document.getElementById(id);
    const backup = node.innerHTML;
    node.innerHTML = '<p style="width:120px;background-color:white; margin:2px">Not an event page!</p>';
    window.setTimeout(() => {
      /* when it is clicked, for 600 ms it display "not an event page" if you are not
       * in an event page */
      node.innerHTML = backup;
    }, 600);
  } else if (currentPhase === 'first' && id === 'first') {
    /* phase one is when the system look for a "See More" and look
     * if the event can be already collected */
    handlePhase('first');
    shiftPhase({first: true, second: false, third: false });
  } else if (currentPhase === 'second' && id === 'second') {
    /* phase two is when by clicking on the buttons the event would be
     * liberated */
    handlePhase('second');
    shiftPhase({first: false, second: true, third: false });
  } else if (currentPhase === 'third' && id === 'third') {
    handlePhase('third');
    shiftPhase({first: false, second: false, third: true });
    /* phase three is an event liberated / already there should not be
     * duplicated */
  } else {
    console.log(`Unmanaged condition? id is ${id} and phase ${currentPhase}`);
  }
}

const logo = (width = '10px', height = '10px', color = '#000') => {
  return `<svg style="vertical-align: middle; padding: 5px;" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 310">
      <path style="fill:${color}" d="M304.05 151.924a150.38 150.38 0 00-139.82-150v21.16c66.36 5.39 118.71 61.11 118.71 128.84s-52.35 123.45-118.71 128.84v21.16a150.38 150.38 0 00139.82-150zM24.41 151.924c0-67.73 52.35-123.45 118.71-128.84V1.924a150.37 150.37 0 000 300v-21.16c-66.36-5.39-118.71-61.11-118.71-128.84z"/>
      <path style="fill:${color}" d="M102.23 62.824a102.9 102.9 0 00-42.47 131.1l18.42-10.64a81.76 81.76 0 01140.43-81.08l18.43-10.63a102.9 102.9 0 00-134.81-28.75zM194.57 222.754a81.91 81.91 0 01-105.84-21.15l-18.43 10.63a102.9 102.9 0 00177.29-102.31l-18.42 10.6a81.9 81.9 0 01-34.6 102.23z"/>
      <path style="fill:${color}" d="M181.37 103.924a55.41 55.41 0 00-69.52 11.65l18.84 10.88a34.29 34.29 0 0156.52 32.63l18.84 10.87a55.41 55.41 0 00-24.68-66.03zM136.53 181.624a34.35 34.35 0 01-16.39-36.88l-18.84-10.82a55.4 55.4 0 0094.2 54.38l-18.85-10.88a34.33 34.33 0 01-40.12 4.2z"/>
    </svg>
  `;
};

function handlePhase (phase) {
  console.log(`We should handle phase #${phase} and we're currently in ${currentPhase}`);
}

function shiftPhase (cfg) {
  /* this shiftPhase could take as option only a phase name, but instead takes
   * all the JSON representing the phases. 'currentPhase' is a variable
   * that might be embedded here, but right now stays outside */
  console.log('I should do', cfg);

  hub.event('newContent', {
    href: window.location.href,
    when: Date(),
    cfg,
    currentPhase,
    randomUUID
  });
}

const FIRST_COLOR = '#00aefe';
const SECOND_COLOR = '#269072';
const THIRD_COLOR = '#c03030';

function initializeBlinks () {
  config.blinks = createPanel(
    {
      'first': {color: FIRST_COLOR },
      'second': {color: SECOND_COLOR },
      'third': {color: THIRD_COLOR }
    },
    `
<div class="panel">
  <span style="font-size:2em">
    <a href="https://libr.events" target="_blank">Librevents</a> browser extension
  </span>
  <hr />
  <p>Note: at the moment this works only if Facebook interface is in English; Legend:</p>
  <ul style="list-style-type: none;">
    <li style="font-size: 1.2rem">${logo(
      '15px', '15px',
      FIRST_COLOR,
      'first',
      )} Event available, (you might need to click on "<b>See more</b>").</li>
    <li style="font-size: 1.2rem">${logo(
      '15px',
      '15px',
      SECOND_COLOR,
      'second',
      )} Click the green icon to see what the extension would process.</li>
    <li style="font-size: 1.2rem">${logo(
      '15px',
      '15px',
      THIRD_COLOR,
      'third',
    )} Liberate the event! Configure your settings <a href="${config.WEB_ROOT}/personal/#${
    config.publicKey
  }" target='_blank'>on Librevent server</a>.</li> 
  </ul>
  <hr />
  <i>Move the mouse to close</i>
</div>
`,
  );
}
