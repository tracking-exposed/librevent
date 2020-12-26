var _ = require('lodash');
var moment = require('moment');
var debug = require('debug')('api');
var nconf = require('nconf');

var mongo3 = require('./mongo3');
var utils = require('./utils');

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

module.exports = {
    processEvents,
};
