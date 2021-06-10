const _ = require('lodash');
const debug = require('debug')('parser:event');

function mineEventInfo(envelope) {
    /* this works for page such as
       https://www.facebook.com/events/996875664473238/ */
/*
    const sources = [ 
        previous.textChains.h2,
        previous.textChains.h3,
        previous.textChains.h4,
        previous.textChains.h5,
        previous.textChains.h6 ];

    let potentials = _.uniq(_.flatten(sources));
    
    const attribution = {
        publisherName: _.first(attribution),
        possiblePicks: sources,
    };
*/

    const h2 = envelope.jsdom.querySelectorAll('h2');
    const eventTime = h2[0].textContent;
    const eventTitle = h2[1].textContent;

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
        // too many dirty data returns from here,
        // should refer with positional '<i>' ?
        return n.textContent;
    });

    return {
        eventTime,
        eventTitle,
        linkcombo,
    };
}

function findDateTime(anode) {
    /* this might/should become a recursive madness, but */
    let foundstring = null;
    let cursor = anode.parentNode;
    while(cursor) {
        const checkstring = cursor.textContent;
        /* this is the most basic regexp to spot a date, then a more robust would exist */
        if(checkstring.match(/\ [A-Z]{3}\ [0-9]{1,2}/)) {
            foundstring = checkstring;
            break;
        }
        cursor = cursor.parentNode;
    }
    return foundstring;
}

function mineEventList(envelope) {
    const allthelinks = envelope.jsdom.querySelectorAll('a[href^="/events/"]');
    /* many of these event links aren't in fact events */
    const eventlinks = _.compact(_.map(allthelinks, function(anchor) {
        // this match twice, and the biggest one isn't that favorable
        if(anchor.outerHTML.length > 1200)
            return null;

        const ref = anchor.getAttribute('href').replace(/\?.*/, '');
        // an event is /events/3423424242/?csds
        const isnumber = _.nth(_.compact(ref.split('/')), 1);
        const checkedText = anchor.textContent.length ? anchor.textContent : null;
        debugger;
        const datetime = findDateTime(anchor);
        if(checkedText && _.parseInt(isnumber) > 0) {
            return {
                eventURL: ref,
                eventName: checkedText,
                datetime,
                // anode: anchor,
            };
        }
        // else return undefined and get stripped by _compact
    }));
    debug("eventlinks in search %d", eventlinks.length);
    return eventlinks;
}

async function processEvents(envelope, previous) {

    if(!previous.nature.quintrex)
        return false;

    debug("this is a processable content of %s",
        previous.nature.fblinktype);

    if(previous.nature.fblinktype === 'events') {
        return mineEventInfo(envelope);
    }

    if(previous.nature.fblinktype === 'events-list') {
        return mineEventList(envelope);
    }

    if(previous.nature.fblinktype === 'events-search') {
        return mineEventList(envelope);
    }

}

module.exports = processEvents;
