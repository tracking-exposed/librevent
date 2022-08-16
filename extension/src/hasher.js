import _ from 'lodash';

const hashmap = [
    {
        hash: 1844516875,
        mean: 'People responded'
    },
    {
        hash: -622892516,
        mean: 'Event by Individual' // https://www.facebook.com/events/5257217200998123
    },
    {
        hash: -366769260,
        mean: 'Location'
    },
    {
        hash: -1562912666,
        mean: 'duration'
    },
    {
        hash: -882302791,
        mean: 'Event by Organization' // https://www.facebook.com/events/381306017250363
    },
    {
        hash: -1981542790,
        mean: 'Tickets'
    },
    {
        hash: -1732475318,
        mean: 'Event available on and off Facebook'
    },
    {
        hash: 513712711,
        mean: 'Health and Safety requirements' // https://www.facebook.com/events/3268160536835081
    }
];

function seemore(rootnode) {

    const buttons = looks(rootnode, '[role="button"]', 'textContent', 'See more');

    if(!buttons.length) {
        return false;
    }

    console.log('Adding the red border to ', buttons.length, 'w/ content:', _.map(buttons, 'textContent'));

    _.each(buttons, function (b) {
        b.style = 'border: red 3px solid; border-radius: 3px';
    });
    return true;
}

function investigate (rootnode) {

    /*
    const imgs = looks(rootnode, 'img', 'src');
    const svg = looks(rootnode, 'svg'); */

    const icons = looks(rootnode, '[data-visualcompletion="css-img"]');

    const analysis = _.compact(_.map(icons, function (snode, order) {
        const rect = snode.getBoundingClientRect();

        if (rect.width !== rect.height) return null;

        const hash = stringToHash(snode.outerHTML);
        const matched = _.find(hashmap, { hash });

        snode.parentNode.parentNode.style = matched ? 'border: 1px green solid' : 'border: 1px red solid';
        /* in production should be:

        1) if !matched return null;
        2) no style hack */

        return {
            hash,
            matched,
            order,
            length: snode.outerHTML.length,
            node: snode,
            rect
        };
    }));

    console.log('Sorted', _.sortBy(analysis, 'order'));
    return analysis.length;
}

 function stringToHash (string) {
    if (!string.length) {
        return hash;
    }
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
        let char = string.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash;
}

function looks (rootnode, selector, feat, match) {
    const nodes = rootnode.querySelectorAll(selector);
    const rv = _.filter(nodes, function (node) {
        if (match) {
            return (node[feat] === match) ? node : null;
        }
        return node;
    });
    console.log(`for ${selector} found ${rv.length}`);
    return rv;
}

module.exports = {
    investigate,
    stringToHash,
    seemore,
};
