const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('lib:api');
const nconf = require('nconf');

const core = require('./core');
const mongo = require('./mongo');
const utils = require('./utils');
const CSV = require('./CSV');

/* note, a few functions in this file are outdated and should be deleted,
 + a discrete knowledge of lodash would help you for good */


function recursiveReassembly(objtree) {
    /* this object is specular to the text fetched 
     * from the source, it is initially produced in
     * extension/src/hasher.js file recursiveLinksDigging */
   
    /* this is the return variable, it accumulates piece of HTML */
    let htmlacc = "";
    /* if you dump the content of objtree with console.log 
     * you might see there are a lot of text we don't need,
     * this boolean 'stillIgnore' is true till the string: */
    const ignoreUntil = "Anyone on or off Facebook";
    let stillIgnore = true;

    /* this function need to exclude the pieces of text 
     * that we don't need */
    function handleHref(ahrefo) {
        if(stillIgnore)
            return;
        
        htmlacc += `<a target=_blank href="${ahrefo.href}">${ahrefo.text}</a>`;
    }

    function handleText(texto) {
        if(stillIgnore && texto.text === ignoreUntil)
            stillIgnore = false;

        if(stillIgnore)
            return;

        htmlacc += `<p dir="auto">${texto.text}</p>`;
    }

    /* this function do recursion and understand if 
     * is dealing with text, links, or objects */
    function objectDigging(obj) {
        if(obj instanceof Object) {
            /* objects might be { text: "blah" }, or
             * { href: "...", text: "blah" } so we check
             * before the href to handle the link differently */
            if(obj.href)
                handleHref(obj);
            else if(obj.text)
                handleText(obj);
        }
        if(obj instanceof Array) {
            _.each(obj, objectDigging);
        }
    }

    _.each(objtree, objectDigging);

    return htmlacc;
}

function processMINED(supporter, received) {

    const id = utils.hash({
        href: received.href,
        size: received.size,
        publicKey: supporter.publicKey,
        randomUUID: received.randomUUID,
    });

    const mined = _.pick(received, [
        'details',  // information mined in the extension, the blocks with RED border
        'element',  // html block of the event, not parsed
        'clientTime',
        'textnest', // nested block of texts, from the block in YELLOW border
        'href',     // facebook event URL
        'update'    // this is an incremental number in the case the same page in the browser has been sent more than once
    ]);
    mined.id = id;
    // the two dates should not be String but Date
    mined.clientTime = new Date(mined.clientTime);
    mined.savingTime = new Date();

    const htmlrebuilt = recursiveReassembly(mined.textnest);
    // mobilizone supports HTML too!
    mined.description = htmlrebuilt;

    return mined;
}

function processHTMLs(supporter, received) {

    const id = utils.hash({href: received.href,
        size: received.size,
        publicKey: supporter.publicKey,
        randomUUID: received.randomUUID,
    });
    /* different URL type causes different type */
    const linktype = received.href.match(/\/events\/(\d+)/) ? "event" : "previews";
    debug("Available keys before saving %j", _.keys(received));
    const evelif = {
        id,
        linktype,
        href: received.href,
        html: received.element,
        update: received.update,
        publicKey: supporter.publicKey,
        clientTime: new Date(received.clientTime),
        savingTime: new Date(),
    };
    return evelif;
}

async function createSupporter(mongoc, publicKey) {
    const supporter = {
        publicKey,
        keyTime: new Date(),
        lastActivity: new Date(),
    };                                                                                               
    supporter.pseudo = utils.pseudonymizeUser(publicKey);
    supporter.userSecret = utils.hash({
        publicKey,
        random: _.random(0, 0xffff),
        when: moment().toISOString()
    });
    debug("Creating %s %s", supporter.pseudo, publicKey);
    await mongo.writeOne(mongoc, nconf.get('schema').supporters, supporter);
    return supporter;
}

const requiredHeaders =  {
    'x-trex-publickey': 'publickey',
    'x-trex-signature': 'signature'
};

async function processEvents(req) {

    const headers = _.reduce(requiredHeaders, function(memo, destk, hdrnamek) {
        let received = _.get(req, 'headers');
        let exists = _.get(received, hdrnamek);
        if(exists) {
            _.set(memo, destk, exists);
            return memo;
        } else {
            debug("headers parsing error missing: %s - %j", hdrnamek, received);
            throw new Error("Missing header "+ hdrnamek);
        }
    }, {});

    /* first thing: verify signature integrity */
    let message = req.body;
    if (req.headers['content-type'] === 'application/json') {
        message = JSON.stringify(message)
    }
    if (!utils.verifyRequestSignature(headers.publickey, headers.signature, message)) {
        debug("event ignored: invalid signature, body of %d bytes, headers: %j",
            _.size(message), req.headers);
        throw new Error("Invalid signature");
    }
    /* verification complete */

    const beginning = moment();
    const mongoc = await mongo.clientConnect();

    let supporter = await mongo.readOne(mongoc, nconf.get('schema').supporters, {
        publicKey: headers.publickey
    });

    if(!_.size(supporter)) {
        debug("TOFU: creation of a new supporter");
        supporter = await createSupporter(mongoc, headers.publickey);
    }

    debug(" * Supporter %s [active on %s] last activity %s (%s ago)",
        supporter.pseudo, moment().format("HH:mm"),
        moment(supporter.lastActivity).format("HH:mm DD/MM"),
        moment.duration(moment.utc()-moment(supporter.lastActivity)).humanize() );

    const enrichedF = _.partial(processHTMLs, supporter);
    const htmls = _.map(req.body, enrichedF);
    const results = await mongo
        .insertMany(mongoc, nconf.get('schema').htmls, htmls);

    const config = req.body[0].settings;

    /* in this case every submission contains only one element */
    const source = _.first(req.body);

    /* this function, implemented above, produce an object ready for DB saving */
    const mined = processMINED(source, supporter);
    /* supporter and config are in two different collections, both handled in 'core', 
     * where the authentication token of mobilizon is fetched */

    const flushdetails = await core.flushEvents(mined, supporter, config)

    const upres = await mongo
        .updateOne(mongoc, nconf.get('schema').supporters, { publicKey: supporter.publicKey}, supporter);

    const conclusion = moment();

    _.set(supporter, 'lastActivity', new Date());
    debug("Written %d htmls, and %d mined events for supporter %s, took %s",
        _.size(htmls), _.size(mined), upres.pseudo, moment.duration(conclusion - beginning).humanize());

    await mongoc.close();
    return { "json": {
        "status": "OK",
        upres,
        flushdetails,
        seconds: moment.duration(conclusion - beginning).asSeconds(),
    }};
};

async function returnEvent(req) {

    const eventId = _.parseInt(req.params.eventId);
    const mongoc = await mongo.clientConnect();
    const event = await mongo.readLimit(mongoc, nconf.get('schema').metadata, {
        eventId
    }, { savingTime: -1}, 30, 0);
    debug("Fetched %d event(s) for %d", _.size(event), eventId);
    await mongoc.close();
    const ready = _.map(event, function(e) { return _.omit(e, ['_id', 'publicKey']) });
    return { json: ready };
};

async function produceJSON(pk, subject) {
    // this function might have publicKey (when invoked by personal API) or
    // might ask for every data (if queried by public API)
    const filter = pk ? _.extend(supportedTransformations[subject].filter, { publicKey: pk }) : supportedTransformations[subject].filter;
    debug("produceJSON %s -> filter %j", subject, filter);
    const MAXSIZE = 2000;
    const mongoc = await mongo.clientConnect();
    const data = await mongo.readLimit(mongoc, nconf.get('schema').metadata, filter, { savingTime: -1}, MAXSIZE, 0);
    await mongoc.close();

    if(_.size(data) == MAXSIZE)
        debug("Fetched MAX %d data, for %s, overflow!", _.size(data), subject);
    else
        debug("Fetched %d event(s) for %s", _.size(data), subject);

    /* functions from 'supported' executed here, a pipeline that transform metadata */
    const pipeline = supportedTransformations[subject].reduction.split(',');
    const clean = _.reduce(data, function(memo, entry) {
        let swapper = entry;
        _.each(pipeline, function(fname) {
            swapper = eval(fname)(swapper);
        })
        memo.push(swapper);
        return memo;
    }, []);


    /* in the case you want to apply a trasformation on the whole dataset, the 'final' function to it */
    if(supportedTransformations[subject].final) {
        const fname = supportedTransformations[subject].final;
        const retval = eval(fname)(clean);
        debug("Executed final function, from %d to %d entries", _.size(clean), _.size(retval));
        return retval;
    }

    /* standard cleaning if NO more specialized reconstruction (the .final above) hasn't happen */
    const omitFields = _.concat(['_id', 'when', 'update', 'textChains', 'hrefChains', 'imageChains',
        'preview', 'post', 'meaningfulId', 'attributions', 'nature'], ['urlo', 'parsed', 'messages']);
    /* the second chunks (urlo, parsed..) comes from 'nature' object */
    return _.map(clean, function(metadata) { return _.omit(metadata, omitFields) });
}

async function produceCSV(pk, subject) {

    const data = await produceJSON(pk, subject);
    debug("produceJSON: %s")
    const filename = `${subject}-${_.size(data)}-${moment().format("YYYY-MM-DD")}.csv`;
    const csv = CSV.produceCSVv1(data);
    /* this is for collector.js and then for express4 */
    return {
        headers: {
            "Content-Type": "csv/text",
            "Content-Disposition": "attachment; filename=" + filename
        },
        text: csv,
    };
}

/* -- THIS IS HOW A RAW METADATA LOOKS LIKE.

_id	id	linktype	href	update	publicKey	savingTime	when	nature	
textChains	hrefChains	imageChains	preview	post	meaningfulId	attributions 

    -- functions below should also become a library and become a batch script        */

// REDUCION transformations they works on an individual data unit
function standard(metadata) {
    return _.merge(metadata, metadata.nature);
}
function summaryOnlyCSV(metadata) {
    return metadata;
}
function mineEventsFromPreview(metadata) {

    if(!metadata.meaningfulId) return [];
    const valuables = _.compact(_.map(metadata.meaningfulId.hrefs, function(eventobj) {
        const isanEvent = eventobj.fblinktype ==='event' &&
            eventobj.eventId &&
            eventobj.eventId.match(/(\d+)/);
        if(!isanEvent)
            return false;

        eventobj.href = `https://www.facebook.com/events/${eventobj.eventId}`;
        eventobj.title = eventobj.text;
        eventobj.savingTime = new Date(metadata.savingTime);
        eventobj.timeago = moment.duration(moment() - moment(metadata.savingTime)).humanize();
        return eventobj;
    }));

    return _.map(valuables, function(entry) {
        return _.pick(entry, ['title', 'urlId', 'savingTime', 'href', 'timeago']);
    });
}
function eventInfo(metadata) {
    try {
        const images = _.filter(metadata.imageChains.images, function(entry) {
            return entry.src.match(/.*(\d+)_(\d+)_(\d+)_n\.jpg\?.*/);
        });
        metadata.images = _.map(images, 'src');
        // debug("Found %d meaningful images %j", _.size(images), metadata.images);
        metadata.title = metadata.textChains.h2[2];
        metadata.eventDateString = metadata.textChains.h2[1];
        metadata.description = metadata.textChains.topdiv.join(' ');
    } catch(error) {
        debug("Error in eventInfo pipeline function: %s", error.message);
    }
    return metadata;
}
// FINAL transformation (they works on the entire dataset)
function crono(metadatas) { 
    const rebuilt = [];
    const counters = _.countBy(metadatas, 'fblinktype');
    const counters2 = _.countBy(metadatas, 'linktype');
    debug(counters, counters2);
    rebuilt[0] = [counters, counters2];
    return rebuilt;
}

const supportedTransformations = {
    'post': { filter: { 'nature.fblinktype': 'post'},
        reduction: 'standard'
    },
    'profile': { filter: { 'nature.fblinktype': 'profile'},
        reduction: 'standard'
    },
    'crono': { filter: {},
        reduction: 'standard,summaryOnlyCSV',
        final: 'crono'
    },
    'events': { filter: { 'linktype': 'event'},   // uniform linktype and nature.fblinktype?
        reduction: 'standard,eventInfo'
    },
    'previews': { filter: { 'linktype': 'previews'},
        reduction: 'mineEventsFromPreview',
        final: 'guardoni'
    }
};

async function personalCSVbySubject(req) {
    // personal CSV by :subject
    debug("Requested personalCSV by Subject %s", req.params.subject);
    if(req.params.subject == 'crono' || req.params.subject == 'home')
        return await produceCSV(req.params.publicKey, 'crono');

    if(_.keys(supportedTransformations).indexOf(req.params.subject) == -1)
        return { text: `Invalid subject requested, currently supported ${JSON.stringify(_.keys(supportedTransformations))}`}

    // check if the requested format it is effectively CSV
    if(req.params.format === 'csv')
        return await produceCSV(req.params.publicKey, req.params.subject);
    else
        return await produceJSON(req.params.publicKey, req.params.subject);
}

async function commonalDataViaSubject(req) {
    // this function is like personal but do not add publicKey filter and it is mean for 
    // public diffusione of data: personal identified MUST be redacted/pseudonymized
    debug("Requested commonal data (subject %s, format %s", req.params.subject, req.params.format);
    if(req.params.subject == 'previews') {
        // the 'previews' already destroy personal data as it use 'guardoni' as final TRANSFORMATION
        content = await produceJSON(null, req.params.subject);
        return { json: content };
    }

    return { text: 'Only supported variables: /api/v2/common/previews/guardoni'};
}

module.exports = {
    processEvents,
    returnEvent,
    recursiveReassembly,
    personalCSVbySubject,
    commonalDataViaSubject,
};
