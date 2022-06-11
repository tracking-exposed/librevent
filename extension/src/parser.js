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

    console.log("--", eventTime, eventTitle, leftovers);

    const fields = ['x', 'y', 'width', 'height', 'top', 'width', 'right', 'left',
        // all the fields are w3c standard, except for
        // 'area', which is calcultated below
        'area'];

    const elems = node.querySelectorAll('h2 > span');
    const infos = _.map(elems, function (e) {
        const coord = e.getBoundingClientRect();
        coord.area = coord.width * coord.height;
        return {
            ..._.pick(coord, fields),
            text: e.textContent,
            classList: Array.from(e.classList).join('-')
        };
    });

    const alllinkse = node.querySelectorAll('a[role="link"]');
    const links = _.map(alllinkse, function (n) {
        const coord = n.getBoundingClientRect();
        coord.area = coord.width * coord.height;
        return {
            ..._.pick(coord, fields),
            text: n.textContent,
            href: n.getAttribute('href')
        };
    });

    console.log('----', links, infos);
    return {
        eventTime,
        eventTitle,
        leftovers,
        links,
        infos
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
