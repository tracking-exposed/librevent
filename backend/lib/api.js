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
        if(stillIgnore && texto.text === ignoreUntil) {
            stillIgnore = false;
            // because otherwise we add 'ignoreUntil' in text 
            return;
        }

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
        'title',
        'textnest', // nested block of texts, from the block in YELLOW border
        'href',     // facebook event URL
        'update'    // this is an incremental number in the case the same page in the browser has been sent more than once
    ]);
    mined.id = id;
    // the two dates should not be String but Date
    console.log(mined.clientTime, typeof mined.clientTime);
    mined.clientTime = new Date(mined.clientTime);
    mined.savingTime = new Date();

    // fundamental to keep track of the data liberator
    mined.publicKey = supporter.publicKey;

    // mobilizone supports HTML too!
    mined.description = recursiveReassembly(mined.textnest);
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

    /* in this case every submission contains only one element,
     * this function, implemented above, produce an object ready for DB saving */
    const mined = processMINED(supporter, _.first(req.body) );
    /* supporter and config are in two different collections, both handled in 'core', 
     * where the authentication token of mobilizon is fetched */

    const mobiposted = await core.flushEvents(mined, supporter, config)

    if(mobiposted['__typename'] === 'Event')
        mined.posted = mobiposted;
    else
        mined.failure = mobiposted;

    _.set(supporter, 'lastActivity', new Date());
    /* save in supporter collection the most recent settings used */
    supporter.config = config;
    console.log(supporter);
    const upres = await mongo
        .updateOne(mongoc, nconf.get('schema').supporters, { publicKey: supporter.publicKey}, supporter);

    // TODO remind the `posted` collection has not index nor yet clear structure
    const mobi = await mongo.writeOne(mongoc, nconf.get('schema').posted, mined);

    const conclusion = moment();
    await mongoc.close();

    debug("Written %d htmls, event post [%s] (%s) supporter %s, took %s",
        _.size(htmls),
        mined?.posted?.url ? "SUCESSFUL" : "FAILURE",
        mined?.posted?.url ? mined.posted.url : JSON.stringify(mined.failure),
        supporter.pseudo,
        moment.duration(conclusion - beginning).humanize());

    return { "json": {
        status: mined?.posted?.url ? "OK" : "error",
        mobiposted,
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

async function personalContribs(req) {
    // personal Contribution, is the API accessed only via knowledge of the personal 
    // secret (which technical is a publicKey so a better authentication mechanism can be 
    // implemented, for example what has been done in fbtrex and/or a challenge-response mechanism

    // this API returns the `supporter` entry with the `supporter.config` settings,
    // and returns also the list of the last 100 liberated events. this is an arbitrary 
    // number and pagination isn't yet implemented. 

    const publicKey = req.params.publicKey;
    debug("Requested personalContribs by %s", publicKey);

    const mongoc = await mongo.clientConnect();
    const posted = await mongo.readLimit(mongoc, nconf.get('schema').posted, {
       publicKey 
    }, { savingTime: -1}, 100, 0);
    const supporter = await mongo.readOne(mongoc, nconf.get('schema').supporters, {publicKey})

    debug("Fetched %d posted events for %s", _.size(posted), supporter.pseudo);
    await mongoc.close();
    return { 
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        json: { posted, supporter }};
}

async function commonalDataViaSubject(req) {
    // this function is meant for public diffusion of reposted events 
    // of course any personal identified MUST be redacted/pseudonymized
    return { text: 'Not supported antymore' };
}

module.exports = {
    processEvents,
    returnEvent,
    recursiveReassembly,
    personalContribs,
    commonalDataViaSubject,
};
