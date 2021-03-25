const _ = require('lodash');
const debug = require('debug')('parsers:textChains');

function recursiveTextContent(memo, node) {

    if(node.children.length) {
        return _.reduce(node.children, recursiveTextContent, memo);
    } else {
        memo.push(node.textContent);
        return memo;
    }
};

function textChains(envelop) {
    /* a reason is like 54c7c8f6c5440407cb7ee764620424ecdd6fea3f
     * when a post report on top why it is display.
     * it is an h5 with quality of "it is before every /ajax/hovercard/" */

    const coacervo = Object({});
    // "Suggested for You"
    coacervo.span = _.compact(_.reduce(envelop.jsdom.querySelectorAll('span'), recursiveTextContent, []));
    coacervo.div = _.compact(_.reduce(envelop.jsdom.querySelectorAll('div'), recursiveTextContent, []));
    coacervo.a = _.compact(_.reduce(envelop.jsdom.querySelectorAll('a'), recursiveTextContent, []));
    coacervo.h2 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h2'), recursiveTextContent, []));
    coacervo.h3 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h3'), recursiveTextContent, []));
    coacervo.h4 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h4'), recursiveTextContent, []));
    coacervo.h5 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h5'), recursiveTextContent, []));
    coacervo.h6 = _.compact(_.reduce(envelop.jsdom.querySelectorAll('h6'), recursiveTextContent, []));
    coacervo.strong = _.compact(_.reduce(envelop.jsdom.querySelectorAll('strong'), recursiveTextContent, []));

    const retval = _.reduce(coacervo, function(memo, value, key) {
        if(value && value.length)
            _.set(memo, key, value);
        return memo;
    }, {});

    return retval;
};

module.exports = textChains;
