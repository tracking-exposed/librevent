#!/usr/bin/env node
const _ = require('lodash');
const fs = require('fs');
const moment = require('moment');
const debug = require('debug')('testeread');
const nconf = require('nconf');
const JSDOM = require('jsdom').JSDOM;

nconf.argv().env().file({ file: './settings.json' });

async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

async function main(fname) {

    /*
     :~/D/librevent/backend main $ ls ../extension/sample/event*
    */
    const file1 = "../extension/sample/event1.html";
    const file2 = "../extension/sample/event-expanded.html";
    console.log("good morning", file1, file2);
    const usefile = _.random(0, 1) === 0 ? file1 : file2;

    console.log("Using ", usefile);
    const html = fs.readFileSync(usefile, { encoding: 'utf-8'});
    const jsdom = new JSDOM(html.replace(/\n\ +/g, '')).window.document;

    const buttons = looks(jsdom, '[role="button"]', 'textContent', 'See more');
    const imgs = looks(jsdom, 'img', 'src');
    // console.log(_.map(imgs, 'src'));
    const svg = looks(jsdom, 'svg');
    const svganalysis = _.map(svg, function(snode, order) {
        const h = stringToHash(snode.innerHTML);
        return { hash: h, length: snode.innerHTML.length, order };
    });
    console.log(_.sortBy(svganalysis, 'order'));
}

 function stringToHash(string) {
                  
    let hash = 0;
                  
    if (string.length == 0)
        return hash;
                  
    for (i = 0; i < string.length; i++) {
        char = string.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
                  
    return hash;
}

function looks(jsdom, selector, feat, match) {
    const nodes = jsdom.querySelectorAll(selector);
    const rv = _.filter(nodes, function(node) {
        // console.log(node[feat], node.getBoundingClientRect());
        // with JSDOM is always x: 0, y: 0 ...
        // console.log(node[feat]);

        if(match) {
            return (node[feat] === match) ? node : null;
        }
        return node;
    });
    console.log(`for ${selector} found ${rv.length}`);
    return rv;
}


nconf.env().argv()
main(nconf.get('file'));

