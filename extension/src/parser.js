import _ from 'lodash';

export function mineEvent (node) {
    /* this works for page such as
       https://www.facebook.com/events/996875664473238/ */

    const h2s = node.querySelectorAll('h2');
    const h2list = _.map(h2s, 'textContent');
    const { eventTime, eventTitle, leftovers } = _.reduce(h2list, (memo, h2) => {
        if (!memo.eventTitle) {
            memo.eventTitle = h2;
        } else if (!memo.eventTime) {
            memo.eventTime = h2;
        } else {
            memo.leftovers.push(h2);
        }
        return memo;
    }, { eventTime: null, eventTitle: null, leftovers: []});

    const bordered = _.reduce(node.querySelectorAll('div'), function (memo, n) {
        if (Array.from(n.style).indexOf('border-radius') !== -1) { memo.push({node: n, testsize: n.textContent.length }); }
        return memo;
    }, []);

    const x = _.last(_.orderBy(bordered, 'testsize'));
    const cleanlinks = x.node.querySelectorAll('a[role="link"]');
    const linkcombo = _.map(cleanlinks, function (n) {
        return {
            text: n.textContent,
            href: n.getAttribute('href')
        };
    });

    const potexts = _.map(node.querySelectorAll("span[dir='auto'] > div"), function (n) {
        // too many dirty data returns from here,
        // should refer with positional '<i>' ?
        return n.textContent;
    });
    console.log(potexts, eventTime, eventTitle, linkcombo);
    return {
        potexts,
        eventTime,
        eventTitle,
        linkcombo
    };
}

/*
function findDateTime(anode) {
    // this might/should become a recursive madness, but
    let foundstring = null;
    let cursor = anode.parentNode;
    while(cursor) {
        const checkstring = cursor.textContent;
        // this is the most basic regexp to spot a date, then a more robust would exist
        if(checkstring.match(/\ [A-Z]{3}\ [0-9]{1,2}/)) {
            foundstring = checkstring;
            break;
        }
        cursor = cursor.parentNode;
    }
    return foundstring;
} */
