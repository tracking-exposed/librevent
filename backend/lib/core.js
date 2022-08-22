/*
 * this library module represent the 'core' of librevent 1.0, as it is the 
 * interface between the backend and the mobilizon instance
 * is uses the module @_vecna/mobilizon-poster to handle this */

const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('lib:core');
const nconf = require('nconf');

const mongo = require('./mongo');
const utils = require('./utils');
const CSV = require('./CSV');

function flushEvents(mined, supporter, config) {
    debug(mined, supporter, config);
}

module.exports = {
    flushEvents
};
