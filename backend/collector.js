const express = require('express');
const app = express();
const server = require('http').Server(app);
const _ = require('lodash');
const moment = require('moment');
const bodyParser = require('body-parser');
const debug = require('debug')('quintrex:collector');
const nconf = require('nconf');
const cors = require('cors');

const { processEvents, returnEvent, personalCSVbySubject } = require('./lib/api');
const mongo3 = require('./lib/mongo3');

const cfgFile = "./settings.json";
const redOn = "\033[31m";
const redOff = "\033[0m";

nconf.argv().env().file({ file: cfgFile });
console.log(`${redOn} ઉ nconf loaded, using ${cfgFile} ${redOff} db: ${nconf.get('mongoDb')}`);

async function wrapRoutes(what, req, res) {
    if(what == 'input')
        return await processEvents(req, res);
    else if(what == 'output')
        return await returnEvent(req, res);
    else if(what == 'personal')
        return await personalCSVbySubject(req, res);
    else
        throw new Error("Developer Error: invalid API call");
}

async function iowrapper(what, req, res) {

    /* there are only two APIs at the moment,  */
    const httpresult = await wrapRoutes(what, req, res);

    if(_.isObject(httpresult.headers))
        _.each(httpresult.headers, function(value, key) {
            debug("Setting header %s: %s", key, value);
            res.setHeader(key, value);
        });

    if(httpresult.json) {
        debug("API <req %d bytes> success, returning JSON <%d bytes>",
            _.size(JSON.stringify(req.body)), _.size(JSON.stringify(httpresult.json)) );
        res.json(httpresult.json)
    } else if(httpresult.text) {
        debug("API success, returning text <size %d>", _.size(httpresult.text));
        res.send(httpresult.text)
    } else {
        debug("Undetermined failure in API call, result → %j", httpresult);
        res.send(JSON.stringify(httpresult));
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

app.options('/api/v2/events', cors()) // enable pre-flight request for POST request as it has special headers
/* This POST only API, to collect the event HTML */
app.post('/api/v2/events', cors(), async function(req, res) {
    try {
        await iowrapper('input', req, res);
    } catch(error) {
        debug("iowrapper Trigger an Exception in 'input' %s", error);
    };
});
/* This GET only API, to collect the event HTML */
app.get('/api/v2/events/:eventId', cors(), async function(req, res) {
    try {
        await iowrapper('output', req, res);
    } catch(error) {
        debug("iowrapper Trigger an Exception in 'output' %s", error);
    };
});

app.get('/api/v2/personal/:publicKey/:subject/csv', cors(), async function(req, res) {
    try {
        await iowrapper('personal', req, res);
    } catch(error) {
        debug("iowrapper Trigger an Exception in 'personal' %s", error);
    }
});

/* Capture All 404 errors */
app.use(async (req, res, next) => {
    debug("Reached URL %s: not handled!", req.originalUrl);
        res.status(404).send('Unable to find the requested resource!');
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
