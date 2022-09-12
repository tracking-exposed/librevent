import _ from 'lodash';
import { runPageAnalysis } from './app';

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

function seemore (rootnode) {

    const seemores = ['See more', 'Mehr anzeigen', 'Altro...', 'Voir plus', 'Ver más', 'Ver mais'];

    for (const item of seemores) {
      var buttons = looks(rootnode, '[role="button"]', 'textContent', item);
      if (buttons.length) {
        break;
      }
    }

    if (!buttons.length) return [];

    console.log('Adding the red border to ', buttons.length, 'w/ content:', _.map(buttons, 'textContent'));

    _.each(buttons, function (b) {
        b.style = 'border: red 2px solid; border-radius: 5px';
        b.addEventListener('mouseout', runPageAnalysis);
    });
    return buttons;
}

function recursiveLinksDigging (node) {
    // console.log(node, node.tagName, node.childNodes);

    if (node.tagName === 'A') {
        return {
            text: node.textContent,
            href: node.getAttribute('href')
        };
    }

    if (!node.childNodes && node.tagName !== 'A') {
        return null;
    }

    if (node.childNodes) {
        return _.compact(_.flatten(_.map(node.childNodes, recursiveLinksDigging)));
    }
    console.log('Unhandled condition in recursive function');
}

function investigate (rootnode) {
    /* these were other two nodes under investigation, and perhaps the images are still relevant
    const imgs = looks(rootnode, 'img', 'src');
    const svg = looks(rootnode, 'svg'); */

    const icons = looks(rootnode, '[data-visualcompletion="css-img"]');

    const analysis = _.compact(_.map(icons, function (snode, order) {
        const rect = snode.getBoundingClientRect();

        if (rect.width !== rect.height) return null;

        const hash = stringToHash(snode.outerHTML);
        const matched = _.find(hashmap, { hash });

        snode.parentNode.parentNode.style = matched ? 'border: 1px green solid' : 'border: 1px red solid';
        // console.log(order, matched, hash, snode.parentNode.parentNode.textContent, snode);

        const links = recursiveLinksDigging(snode.parentNode.parentNode);

        /*  ************************
        in production should be:
            1) if !matched return null;
            2) no style hack
        but, practically, this selection based on hash isn't working yet well
        **************************** */
        const retval = {
            hash,
            matched,
            order,
            text: snode.parentNode.parentNode.textContent,
            size: snode.outerHTML.length,
            node: snode,
            rect,
        };

        if (links.length) {
            retval.links = links;
        }

        return retval;
    }));

    console.log('Sorted', _.sortBy(analysis, 'order'));
    return analysis;
}

function title (node) {
    const h2 = node.querySelectorAll('h2');
    if(!h2 || !h2.length) {
        console.log('Not possible find a title?'); return;
    }
    const title = h2[0].textContent;
    console.log(`Found title: [${title}]`);
    return title;
}

function description (node) {
    /* by analysis the second element h2 is 'details' so we can get above
     * the parentNodes till we found the actual description box
        0 H2, 210
        Details
        1 DIV, 292
        Details
        2 DIV, 329
        Details
        3 DIV, 384
        Details
        4 DIV, 12466
    ************************************* */
    const h2 = node.querySelectorAll('h2');
    console.log(`Description recursive search (h2 should be > 3 and they are: ${h2 ? h2.length : 0})`);
    if(!h2 || !h2.length)
        return false;

    if(h2.length < 2) {
        console.log("assumption fail! investigate")
        return false;
    }

    const selection = _.reduce(_.times(7), function(memo, testNumber) {
        if(memo.node.innerHTML.length > 1000 && memo.correct === null) {
            memo.correct = memo.node;
            // console.log(`Keeping: ${testNumber} ${memo.node.tagName}, ${memo.node.innerHTML.length}`);
        }
        memo.node = memo.node.parentNode;
        return memo;
    }, { node: h2[1], correct: null });

    if(!selection.correct) {
        console.log("Recursion n.1 fail!");
        return false;
    }

    selection.correct.style = 'border: 2px yellow solid';
    console.log(`Found: ${selection.correct.textContent}`);
    const retstruct = recursiveTextContent(selection.correct);
    console.log(JSON.stringify(retstruct, null, 2));
    return retstruct;
}

function recursiveTextContent(rnode) {
    const retval = {};
    const rect = (typeof rnode.getBoundingClientRect === 'function') ? rnode.getBoundingClientRect() : null;

    if(rnode.tagName === 'A') {

        retval.text = rnode.textContent;
        retval.href = rnode.getAttribute('href');
        // retval.tagName = rnode.tagName; // rethorical tagName
        if(rect !== null)
            retval.rect = rect;

    } else if(rnode.nodeType === Node.TEXT_NODE) {
        const text = rnode.nodeValue.trim();
        if(text && text.length) {

            retval.text = text;
            retval.tagName = rnode.tagName;
            if(rect !== null)
                retval.rect = rect;

        }
    }

    const recursive = rnode.childNodes.length ?
        _.map(rnode.childNodes, recursiveTextContent): [];

    return _.concat(retval, recursive);
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
    // console.log(`for ${selector} found ${rv.length}`);
    return rv;
}

module.exports = {
    investigate,
    stringToHash,
    title,
    description,
    seemore,
};
