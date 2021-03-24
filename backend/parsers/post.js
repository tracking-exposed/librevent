const _ = require('lodash');
const debug = require('debug')('parser:post');
const helper = require('./helper');

function post(envelope, previous) {

    if(previous.nature.fblinktype !== 'post')
        return false;

    const infos = _.map(envelope.jsdom.querySelectorAll('a'), function(n) {
        let text = n.textContent.trim();
        if(text.match(/---/))
            text = text.replace(/-/g, '');

        const retval = {
            href: n.getAttribute('href'),
            text
        };
        return helper.updateHrefUnit(retval, 'href');
    });

    debug("%s", _.map(infos, JSON.stringify));
    const sources = [ 
        previous.textChains.h2,
        previous.textChains.h3,
        previous.textChains.h4,
        previous.textChains.h5,
        previous.textChains.h6 ];

    let attribution = _.uniq(_.flatten(sources));
    
    const retval = {
        publisherName: _.first(attribution),
        possiblePicks: sources,
    };

    if(_.size(attribution) > 2)
        retval.sharedOf = _.dropRight(attribution);

    return [ infos, retval ];
}

module.exports = post;