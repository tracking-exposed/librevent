/*
 * this library module represent the 'core' of librevent 0.3.x, as it is the
 * interface between the backend and the mobilizon instance
 * is uses the module @_vecna/mobilizon-poster to handle this */

const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('lib:core');
const nconf = require('nconf');
const mobi = require('@_vecna/mobilizon-poster').lib;

const mongo = require('./mongo');
const utils = require('./utils');
const CSV = require('./CSV');

async function flushEvents(mined, supporter, config) {
    // this function might be bigly optimized, but, at the moment
    // it takes a blob of data from the extension, among them
    // the authentication material.

    // debug('mined: %j config %j supporter %j', mined, config, supporter);
    debugger;
    debug('mined: %j config %j',
        _.omit(mined, ['element']), config);

    const { login, password, mobilizon } = config;
    // by following the small documentation here
    // https://www.npmjs.com/package/@_vecna/mobilizon-poster

    debugger;
    let token, userInfo;
    try {
        token = await mobi.login.perform({ login, password, api: mobilizon });
        userInfo = await mobi.login.getInfo(token);
        // userInfo has this content
        /* [{
         *   "__typename": "Person",
         *   "avatar": null,
         *   "id": "12",
         *   "name": "experiment",
         *   "preferredUsername": "experiment",
         *   "type": "PERSON"
         * }]
         */
    } catch(error) {
        debug("Error in connecting to mobilizon with third via mobilizon-poster package!");
        throw error;
    }

    const eventvars = {
        start: new Date(), // the object need to have a valid .toISOString() method
        end: new Date(),   // this can be null, and
        title: "Event title!",
        description: "A description that should also contains\n\nnewlines",
        url: "https://your.event.promotion.or.anything.else",
        address: "Berlin, Cocolo Ramen", // A string that would be queried soon!
    };
    /* this is the userId that should be used */
    eventvars.organizerActorId = userInfo[0].id;
    eventvars.token = token;
    eventvars.description = mined.description;

    debugger;
    try {
        eventvars.location = await mobi.location.queryLocation(
            eventvars.address,
            localString=null,
            apiEndpoint=mobilizon,
            token
        );
    } catch(error) {
        debug("Failure in retriving location %s: %s",
            eventvars.address, error.message);
        throw error;
    }

    debugger;
    let results = null;
    try {
        results = await mobi.createEvent.postToMobilizon(eventvars);
        debug(results);
    } catch(error) {
        debug("Failure in createEvent call: %s", error.message);
        throw error;
    }
}

module.exports = {
    flushEvents
};
