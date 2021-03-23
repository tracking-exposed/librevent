const express = require('express');
const app = express();
const server = require('http').Server(app);
const _ = require('lodash');
const moment = require('moment');
const bodyParser = require('body-parser');
const debug = require('debug')('quintrex:collector');
const nconf = require('nconf');
const cors = require('cors');

const { processEvents, returnEvent } = require('./lib/api');
const mongo3 = require('./lib/mongo3');

const cfgFile = "./settings.json";
const redOn = "\033[31m";
const redOff = "\033[0m";

nconf.argv().env().file({ file: cfgFile });
console.log(`${redOn} ઉ nconf loaded, using ${cfgFile} ${redOff} db: ${nconf.get('mongoDb')}`);

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

/* configuration of express4 */
const LIMIT="11mb";
app.use(express.json({limit: LIMIT}));
app.use(express.urlencoded({limit: LIMIT, extended: true, parameterLimit: 50000}));
server.listen(nconf.get('port'), nconf.get('interface'));
console.log(
  ` Listening on http://${nconf.get("interface")}:${nconf.get("port")}, cfg limit of ${LIMIT}`,
);

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

(async function() {
    try {
        await mongo3.checkMongoWorks();
        console.log(" MongoDb connection works!");
    } catch(error) {
        console.log("Can't connect to database? Check", cfgFile, error.message);
        process.exit(1);
    };
})();
