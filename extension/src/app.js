
// Import other utils to handle the DOM and scrape data.
import _ from 'lodash';

import {createPanel} from './panel';
import config from './config';
import hub from './hub';
import { registerHandlers } from './handlers/index';

// bo is the browser object, in chrome is named 'chrome', in firefox is 'browser'
const bo = chrome || browser;

// variable used to spot differences due to refresh and url change
let randomUUID = 'INIT' + Math.random().toString(36).substring(2, 13) +
                Math.random().toString(36).substring(2, 13);


// Frequency of url change and decision 
const hrefPERIODICmsCHECK = 2000;
var lastURL = null;
const FB_PAGE_SELECTOR ='[data-pagelet="page"]';
let cacheSize = {
    seen: 0,
    sentTimes: 0,
};

// Boot the user script. This is the first function called.
// Everything starts from here.
function boot () {

    // this get executed only on facebook.com
    console.log(`librevent collector extension: ${JSON.stringify(config)}`);

    // Register all the event handlers.
    // An event handler is a piece of code responsible for a specific task.
    // You can learn more in the [`./handlers`](./handlers/index.html) directory.
    registerHandlers(hub);

    // Lookup the current user and decide what to do.
    localLookup(response => {
        // `response` contains the user's public key, we save it global for the blinks
        console.log("app.js gets", response, "from localLookup");

        /* these parameters are loaded from localstorage */
        config.publicKey = response.publicKey;
        config.active = response.active;
        config.ux = response.ux;

        if(config.active !== true) {
            console.log("evicoas is disabled!"); // TODO some UX change
            return null;
        }

        initializeBlinks();
        window.setInterval(hrefUpdateMonitor, hrefPERIODICmsCHECK);
        flush();
    });
}

function phase (path) {
    const f = _.get(phases, path);
    f(path);
}

function acceptableHref(pathname) {
    return !!pathname.match(/^\/events/);
}

function meaningfulCachedDifference(elem) {
    const ts = elem.outerHTML.length;
    const fivepercentless = (ts / 20) * 19;
    let retval = false;

    if(cacheSize.seen < fivepercentless) {
        console.debug("Observed a size update from", cacheSize.seen, "to", ts);
        retval = true;
    }

    cacheSize.seen = ts;
    cacheSize.sentTimes++;
    return retval;
}

function cleanCache() {
    cacheSize.seen = 0;
    cacheSize.sentTimes = 0;
}

function hrefUpdateMonitor () {
    // check if is a path we should monitor
    if(!acceptableHref(window.location.pathname)) return;

    // fetch the elment
    const elem = document.querySelector(FB_PAGE_SELECTOR);
    if(!elem) {
        console.log("Unexpected: not found selector", FB_PAGE_SELECTOR,
            "in", window.location.href);
        return;
    }

    // if is different from the previous, is the first time observed
    let diff = (window.location.href !== lastURL);
    // regardless of diff, update the current one as also the last one
    lastURL = window.location.href;

    // continue the step, if new, clean cache 
    if (diff) {
        phase('video.seen');
        cleanCache();
        randomUUID = Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }

    if(!meaningfulCachedDifference(elem)) return;
    phase('video.send');

    hub.event('newContent', {
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
    bo.runtime.sendMessage({
        type: 'localLookup',
        payload: {
            userId: 'librevent' // at the moment is fixed to 'local'
        }
    }, callback);
}

// The function `remoteLookup` communicate the intention
// to the server of performing a certain test, and retrive
// the userPseudonym from the server 
// this is not used atm but might be worthy
function remoteLookup (callback) {
    bo.runtime.sendMessage({
        type: 'remoteLookup',
        payload: {
            // window.location.pathname.split('/')
            // Array(4) [ "", "d", "1886119869", "Soccer" ]
            // window.location.pathname.split('/')[2]
            // "1886119869"
            testId: window.location.pathname.split('/')[2]
        }
    }, callback);
}

function flush () {
    window.addEventListener('beforeunload', (e) => {
        hub.event('windowUnload');
    });
}

// Before booting the app, we need to update the current configuration
// with some values we can retrieve only from the `chrome`space.
bo.runtime.sendMessage({type: 'chromeConfig'}, (response) => {
    Object.assign(config, response);
    boot();
});

/*
.########..##.......####.##....##.##....##..######.
.##.....##.##........##..###...##.##...##..##....##
.##.....##.##........##..####..##.##..##...##......
.########..##........##..##.##.##.#####.....######.
.##.....##.##........##..##..####.##..##.........##
.##.....##.##........##..##...###.##...##..##....##
.########..########.####.##....##.##....##..######.
*/

/*
 * phases are all the div which can appears on the right bottom.
 * the function below is called in the code, when the condition is
 * met, and make append the proper span */
var phases = {
    'adv': {'seen': advSeen },
    'video': {'seen': videoSeen, 'wait': videoWait, 'send': videoSend},
    'counters': {
        'adv': { seen: 0 },
        'video': { seen: 0, wait: 0, send: 0}
    }
  };

const VIDEO_WAIT = 'video wait';
const VIDEO_SEEN = 'video seen';
const VIDEO_SEND = 'video send';
const SEEN_ADV = 'seen adv';

const logo = (width = '10px', height = '10px', color = '#000') => {
    return `<svg style="vertical-align: middle; padding: 5px;" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 310">
        <path style="fill:${color}" d="M304.05 151.924a150.38 150.38 0 00-139.82-150v21.16c66.36 5.39 118.71 61.11 118.71 128.84s-52.35 123.45-118.71 128.84v21.16a150.38 150.38 0 00139.82-150zM24.41 151.924c0-67.73 52.35-123.45 118.71-128.84V1.924a150.37 150.37 0 000 300v-21.16c-66.36-5.39-118.71-61.11-118.71-128.84z"/>
        <path style="fill:${color}" d="M102.23 62.824a102.9 102.9 0 00-42.47 131.1l18.42-10.64a81.76 81.76 0 01140.43-81.08l18.43-10.63a102.9 102.9 0 00-134.81-28.75zM194.57 222.754a81.91 81.91 0 01-105.84-21.15l-18.43 10.63a102.9 102.9 0 00177.29-102.31l-18.42 10.6a81.9 81.9 0 01-34.6 102.23z"/>
        <path style="fill:${color}" d="M181.37 103.924a55.41 55.41 0 00-69.52 11.65l18.84 10.88a34.29 34.29 0 0156.52 32.63l18.84 10.87a55.41 55.41 0 00-24.68-66.03zM136.53 181.624a34.35 34.35 0 01-16.39-36.88l-18.84-10.82a55.4 55.4 0 0094.2 54.38l-18.85-10.88a34.33 34.33 0 01-40.12 4.2z"/>
    </svg>
`;
};

function initializeBlinks() {
    console.log("UX temporarly disabled");
    return;

    config.blinks = createPanel({
        [VIDEO_WAIT]: {color: '#00aefe'},
        [VIDEO_SEEN]: {color: '#269072'},
        [VIDEO_SEND]: {color: '#c03030'},
        [SEEN_ADV]: {color: '#ffb545'}
    }, `
<div>
    <h2>
        <a href="https://youtube.tracking.exposed" target=_blank>youtube</a>.<a href="https://tracking.exposed" target=_blank>tracking.exposed</a> is currently enabled!
    </h2><hr />
    <p style="font-size: 1.2rem">This is a browser extention you installed. Data is processed for academic and digital activism purposes, we can use your evidence by clicking on the extension icon.</p>
    <p style="font-size: 1.2rem">You can see the nearby icons <span>${logo('10px', '10px', '#bbb')}</span> and they blink. Each position/color is a different stage in the evidence collection.</p>
    <br /><br />
    <ul style="list-style-type: none;">
        <li style="font-size: 1.2rem">${logo('15px', '15px', '#00aefe')} Video seen, waiting loading complete</li>
        <li style="font-size: 1.2rem">${logo('15px', '15px', '#269072')} New video seen</li>
        <li style="font-size: 1.2rem">${logo('15px', '15px', '#c03030')} Video is sent to a server. <a href="${config.WEB_ROOT}/personal/#${config.publicKey}" target=_blank><b>A</b>ccess your data</a>.</li>
        <li style="font-size: 1.2rem">${logo('15px', '15px', '#ffb545')} Advertising spotted and sent</li>
        <!-- if you read this code, please consider a small git-commit as contribution :)
             we're short in resources and the project is ambitious! -->
    </ul>
    <br />
    <h3>Know more about the project:
        <button size="small" color="secondary" onclick=window.open("https://tracking.exposed/manifesto")>
        Manifesto
        </button>
        <button size="small" color="primary" onclick="window.open("https://github.com/tracking-exposed/yttrex/")> 
        Software Repository
        </button>
        <button size="small" color="secondary" onclick="window.open("https://github.com/tracking-exposed/yttrex/")> 
        Facebook support page
        </button>
    </h3>
</div>
`
    );
}

/* below the 'span creation' function mapped in the dict phases above */
function videoWait (path) {
    return;
    config.blinks[VIDEO_WAIT]();
}
function videoSeen (path) {
    return;
    config.blinks[VIDEO_SEEN]();
}
function videoSend (path) {
    return;
    config.blinks[VIDEO_SEND]();
}
function advSeen (path) {
    return;
    config.blinks[SEEN_ADV]();
};
