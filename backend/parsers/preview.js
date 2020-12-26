const _ = require('lodash');
const debug = require('debug')('parser:preview');

function mine(envelope, previous) {

    if(envelope.html.linktype !== 'preview')
        return false;

    const sectionNames = _.map(envelope.jsdom.querySelectorAll('h2'), function(n) {
        return n.textContent;
    });

    return {
        sectionNames
    };
}

module.exports = mine;