const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('api');
const nconf = require('nconf');

const mongo3 = require('./mongo3');
const utils = require('./utils');
const CSV = require('./CSV');

function processHTMLs(supporter, received) {

    const id = utils.hash({href: received.href,
        size: received.size,
        update: received.update,
        randomUUID: received.randomUUID,
    });
    /* different URL type causes different type */
    const linktype = received.href.match(/\/events\/(\d+)/) ? "event" : "previews";
    const evelif = {
        id,
        linktype,
        href: received.href,
        html: received.element,
        update: received.update,
        publicKey: supporter.publicKey,
        clientTime: new Date(received.clientTime),
        savingTime: new Date(moment().toISOString()),
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
    await mongo3.writeOne(mongoc, nconf.get('schema').supporters, supporter);
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

    const mongoc = await mongo3.clientConnect();

    let supporter = await mongo3.readOne(mongoc, nconf.get('schema').supporters, {
        publicKey: headers.publickey
    });

    if(!_.size(supporter)) {
        debug("TOFU: creation of a new supporter");
        supporter = await createSupporter(mongoc, headers.publickey);
    }

    debug(" * Supporter %s [%s] last activity %s (%s ago)",
        supporter.pseudo, supporter.marker ? supporter.marker : "(NOMARKER)",
        moment(supporter.lastActivity).format("HH:mm DD/MM"),
        moment.duration(moment.utc()-moment(supporter.lastActivity)).humanize() );

    _.set(supporter, 'lastActivity', new Date());

    const enrichedF = _.partial(processHTMLs, supporter);
    const htmls = _.map(req.body, enrichedF);
    const results = await mongo3
        .insertMany(mongoc, nconf.get('schema').htmls, htmls);
    const upres = await mongo3
        .updateOne(mongoc, nconf.get('schema').supporters, { publicKey: supporter.publicKey}, supporter);

    debug("Written %d htmls, types %j supporter", _.size(htmls), _.map(htmls, 'linktype'));

    await mongoc.close();
    return { "json": {
        "status": "OK", "info": upres
    }};
};

async function returnEvent(req) {

    const eventId = _.parseInt(req.params.eventId);
    const mongoc = await mongo3.clientConnect();
    const event = await mongo3.readLimit(mongoc, nconf.get('schema').metadata, {
        eventId
    }, { savingTime: -1}, 30, 0);
    debug("Fetched %d event(s) for %d", _.size(event), eventId);
    await mongoc.close();
    const ready = _.map(event, function(e) { return _.omit(e, ['_id', 'publicKey']) });
    return { json: ready };
};

async function produceJSON(pk, subject) {
    const filter = _.extend(supported[subject].filter, { publicKey: pk });
    debug("produceJSON %s -> filter %j", subject, filter);
    const MAXSIZE = 2000;
    const mongoc = await mongo3.clientConnect();
    const data = await mongo3.readLimit(mongoc, nconf.get('schema').metadata, filter, { savingTime: -1}, MAXSIZE, 0);
    await mongoc.close();

    if(_.size(data) == MAXSIZE)
        debug("Fetched MAX %d data, for %s, overflow!", _.size(data), subject);
    else
        debug("Fetched %d event(s) for %s", _.size(data), subject);

    /* functions from 'supported' executed here, a pipeline that transform metadata */
    const pipeline = supported[subject].reduction.split(',');
    const clean = _.reduce(data, function(memo, entry) {
        let swapper = entry;
        _.each(pipeline, function(fname) {
            swapper = fname(swapper);
        })
        memo.push(swapper);
    }, []);


    /* in the case you want to apply a trasformation on the whole dataset, the 'final' function to it */
    if(supported[supported].final) {
        const fname = supported[supported].final;
        const retval = fname(clean);
        debug("Executed final function, from %d to %d entries", _.size(clean), _.size(final));
        return retval;
    }

    /* standard cleaning if NO more specialized reconstruction (the .final above) hasn't happen */
    const omitFiedls = ['_id', 'when', 'update', 'textChains', 'hrefChains', 'imageChains',
        'preview', 'post', 'meaningfulId', 'attributions'];
    return _.map(clean, function(metadata) { return _.omit(metadata, omitFiedls) });
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

function standard(metadata) {
    metadata.fblinkype = metadata.nature.fblinkype;
    return metadata;
}
function summaryOnlyCSV(metadata) {
    return metadata;
}
function crono(metadata) {
    const rebuilt = [];
    const counters = _.countBy(metadata, 'fblinktype');
    const counters2 = _.countBy(metadata, 'linktype');
    debug(counters, counters2);
    rebuilt[0] = [counters, counters2];
    return rebuilt;
}

const supported = {
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
    'event': { filter: { 'linktype': 'event'},
        reduction: 'standard'
    },
    'previews': { filter: { 'linktype': 'previews'},
        reduction: 'standard',
        final: 'guardoni'
    }
};

async function personalCSVbySubject(req) {
    // personal CSV by :subject
    debug("Requested personalCSV by Subject %s", req.params.subject);
    if(req.params.subject == 'post')
        return await produceCSV(req.params.publicKey, 'post');
    else if(req.params.subject == 'profile')
        return await produceCSV(req.params.publicKey, 'profile');
    else if(req.params.subject == 'crono' || req.params.subject == 'home')
        return await produceCSV(req.params.publicKey, 'crono');
    else
        return { text: `Invalid subject requested, currently supported ${JSON.stringify(_.keys(supported))}`}
}

module.exports = {
    processEvents,
    returnEvent,
    personalCSVbySubject,
};