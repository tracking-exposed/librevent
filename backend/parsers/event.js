const _ = require('lodash');
const debug = require('debug')('parser:event');

function event(envelope, previous) {

    if(previous.nature.fblinktype !== 'event')
        return false;

	debug("this is an event");
    const h2 = envelope.jsdom.querySelectorAll('h2');
    const eventTime = h2[0].textContent;
    const eventTitle = h2[1].textContent;
    const eventId = envelope.html.href.replace(/.*events\//, '').replace(/\?.*/, '');

    const links = envelope.jsdom.querySelectorAll('a[role="link"]');
    const bordered = _.reduce(envelope.jsdom.querySelectorAll('div'), function(memo, n) {
        if(Array.from(n.style).indexOf('border-radius') !== -1)
            memo.push({node: n, testsize: n.textContent.length });
        return memo;
    }, []);

    const x = _.last(_.orderBy(bordered, 'testsize'));
    const cleanlinks = x.node.querySelectorAll('a[role="link"]');
    const linkcombo = _.map(cleanlinks, function(n) {
        return {
            text: n.textContent,
            href: n.getAttribute('href')
        };
    });

    const potexts = _.map(envelope.jsdom.querySelectorAll("span[dir='auto'] > div"), function(n) {
        // too many dirty data reuturns from here
        return n.textContent;
    });

    return {
        eventTime,
        eventTitle,
        linkcombo,
        eventId,
    };
}

module.exports = event;