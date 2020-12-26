const express = require('express');
const app = express();
const server = require('http').Server(app);
const _ = require('lodash');
const moment = require('moment');
const bodyParser = require('body-parser');
const debug = require('debug')('collector');
const nconf = require('nconf');
const cors = require('cors');

const { processEvents, returnEvent } = require('./lib/api');

const cfgFile = "./settings.json";
const redOn = "\033[31m";
const redOff = "\033[0m";

nconf.argv().env().file({ file: cfgFile });
console.log(redOn + "ઉ nconf loaded, using " + cfgFile + redOff);

if(nconf.get('FBTREX') !== 'production') {
    debug("Because $FBTREX is not 'production', it is assumed be 'development'");
    nconf.stores.env.readOnly = false;
    nconf.set('FBTREX', 'development');
    nconf.stores.env.readOnly = true;
} else {
    debug("Production execution!");
}

async function iowrapper(what, req, res) {

    /* there are only two APIs at the moment,  */
    const httpresult = what == 'input' ? 
        await processEvents(req, res) :
        await returnEvent(req, res);

    if(_.isObject(httpresult.headers))
        _.each(httpresult.headers, function(value, key) {
            debug("Setting header %s: %s", key, value);
            res.setHeader(key, value);
        });

    if(httpresult.json) {
        debug("API (%d bytes) success, returning JSON (%d bytes)",
            _.size(JSON.stringify(req.body)), _.size(JSON.stringify(httpresult.json)) );
        res.json(httpresult.json)
    } else if(httpresult.text) {
        debug("API s success, returning text (size %d)", _.size(httpresult.text));
        res.send(httpresult.text)
    } else {
        debug("Undetermined failure in API call, result →  %j", httpresult);
    }
};

server.listen(nconf.get('port'), nconf.get('interface'));
debug("Listening on http://%s:%s", nconf.get('interface'), nconf.get('port'));

/* configuration of express4 */
app.use(cors());
app.use(bodyParser.json({limit: '4mb'}));
app.use(bodyParser.urlencoded({limit: '4mb', extended: true}));

/* This POST only API, to collect the event HTML */
app.post('/api/v:version/events', async function(req, res) {
    try {
        await iowrapper('input', req, res);
    } catch(error) {
        debug("iowrapper Trigger an Exception %s", error);
    };
});
/* This GET only API, to collect the event HTML */
app.get('/api/v1/events/:eventId', async function(req, res) {
    try {
        await iowrapper('output', req, res);
    } catch(error) {
        debug("iowrapper Trigger an Exception %s", error);
    };
});

console.log("This alpha stage software do not check if mongodb is running: we hope it does!");