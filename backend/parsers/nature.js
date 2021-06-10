const _ = require('lodash');
const debug = require('debug')('parsers:nature');
const querystring = require('querystring');
const urlminer = require('./urlminer');

async function nature(envelop, previous) {

    const retval = { href: envelop.html.href };
    retval.urlo = new URL(retval.href);
    retval.parsed = querystring.parse(retval.urlo.search); 
    retval.messages = [];

    /* only facebook path now are selected */
    const chunks = _.compact(retval.urlo.pathname.split('/'));
    /* at first analyze complex url, with?params */
    const firstTry = urlminer.attributeLinkByFormat(chunks, retval);
    if(!firstTry)
        /* then look at the substring in position 0, as profile/group/page name .. */
        urlminer.attributeLinkByPattern(chunks, retval);

    if(retval.useless) {
        debug("marked useless removing %j", retval.href);
        return null;
    }

    if(!retval.fblinktype) {
        debug("fail, not found nature w/ %s", retval.href);
        retval.unintended = true;
        retval.messages.push("not found nature?");
    }

    _.unset(retval, 'urlo');
    _.unset(retval, 'parsed');
    return retval;
}

module.exports = nature;
