const _ = require('lodash');
const debug = require('debug')('automation:evicoas');
const bcons = require('debug')('browser:console');
const path = require('path');

async function beforeDirectives(page, directives) {
    // debug("Watching and duplicating browser console...");
    // page.on('console', function(message) { bcons("%s", message.text())});
    page.on('pageerror', function(message) { bcons(`Error: ${message}`)});
}

async function beforeWait(page, directive) {
}

async function afterWait(page, directive) {
    // const innerWidth = await page.evaluate(_ => { return window.innerWidth });
    // const innerHeight = await page.evaluate(_ => { return window.innerHeight });
    const linestr = directive.line;
    const fname = _.concat([ linestr], _.values(_.omit(directive, ['url', 'loadFor']))).join('+')
    const scrout = path.join("screencapts", `${fname}.png`);
    await page.screenshot({ path: scrout, type: 'png' });
    debug("screenshot saved as %s", scrout);
}

module.exports= {
    beforeWait,
    afterWait,
    beforeDirectives,
}
