#!/usr/bin/env node
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const nconf = require('nconf');
const moment = require('moment');
const querystring = require('querystring');
const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');

const debug = require('debug')('guardoni:events');
const bcons = require('debug')('browser:console');

const urlminer = require('../../backend/parsers/urlminer');
const imagefetch = require('../../backend/parsers/imagefetch');

nconf.argv().env();

async function beforeDirectives(page, profile, directives) {
  // debug("Watching and duplicating browser console...");
  // page.on('console', function(message) { bcons("%s", message.text())});
  page.on('pageerror', function(message) { bcons(`Error: ${message}`)});
}

async function getEvent(page, directive) {
  // this function is invoked when an event is rendered,
  // and considering the different variation Facebook enact,
  // we should build from a page of our a variety of different events 
  // and test if the are correctly acquired.

  /*
  const eventDetails = await page.evaluate(() => {
    const sctns = document.querySelectorAll('section');
    const desrows = sctns[0].querySelectorAll('tr');
    const img = document.querySelector('img[role="img"]');

    const mandatory = {
      rowcount: desrows.length,
      sectioncount: sctns.length,
      dates: desrows[0].innerText,
      when: desrows[0].querySelector('div').innerText,
      description: sctns[1].innerText,
    }

    if(img && img.getAttribute('src'))
      mandatory.image = img.getAttribute('src');

    return JSON.stringify(mandatory);
  });
  const eventnfo = JSON.parse(eventDetails);
  */

  const evfname = directive.eventId + '_' + moment().format("YYYY-MM-DD-HH-mm");
  const evscrout = path.join("screencapts", `${evfname}.png`);
  const evjsondetf = path.join("evdetails", `${evfname}.json`);

  const eventnfo = await page.$eval("[type='application/ld+json']", function(elem) {
    return JSON.parse(elem.innerHTML);
  });

  /* pieces of code from imagefetch.mineImg */
  eventnfo.urlo = new URL(eventnfo.image);
  eventnfo.origname = path.basename(eventnfo.urlo.pathname);

  await imagefetch.fetchImages(eventnfo, eventnfo.src, directive.eventId)
  debug("Downloaded picture in %s", eventnfo.saved);

  await page.screenshot({ path: evscrout, type: 'png' });
  debug("Screenshot saved as %s", evscrout);

  eventnfo.screenshot = evscrout;
  _.unset(eventnfo, 'urlo');
  _.unset(eventnfo, 'src');
  _.unset(eventnfo, 'origname');
  console.log("Saving " + JSON.stringify(eventnfo).length + " bytes of event details in", evjsondetf);
  fs.writeFileSync(evjsondetf, JSON.stringify(eventnfo, undefined, 2), 'utf-8');
  console.log("Now that can be used by mobilizon-bridge")
}

async function localParseEventPage(page, directive) {

  const valuables = {};
  const data = await page.evaluate(() => {
    // debugging / inspecting inside of here is complex?
    const ahrefs = document.querySelectorAll('a[href^="/events/"]');
    const result = [];
    for (let i = 0; i < ahrefs.length; i++) {
      result.push(ahrefs[i].getAttribute('href'));
    }
    return JSON.stringify(result);
  });
  // https://stackoverflow.com/questions/52045947/nodejs-puppeteer-how-to-use-page-evaluate
  if(data && data.length > 2) {
    const cleanHrefs = _.uniq(_.map(JSON.parse(data), function(href) {
      return href.replace(/\?.*/, '');
    }));
    valuables.eventHrefs = cleanHrefs;
  }

  if(valuables.eventHrefs) {
    const fname = _.concat([ moment().format("YYYY-MM-DD+HH-mm")], _.values(_.omit(directive, [ 'quintrex', 'url', 'loadFor']))).join('+')
    const scrout = path.join("screencapts", `${fname}.png`);
    await page.screenshot({ path: scrout, type: 'png' });
    debug("Screenshot saved as %s", scrout);

    const pout = path.join("pointers", `${fname}.json`);
    valuables.screenshot = scrout;
    fs.writeFileSync(pout, JSON.stringify(valuables, undefined, 2), 'utf-8');
    console.log("Saved pointers!");
    console.log("Now you can use --pointer ", pout);
  } else {
    console.log("Nothing saved as nothing worthy have been found!");
  }
}

async function keypress() {
  process.stdin.setRawMode(true)
  return new Promise(resolve => process.stdin.once('data', () => {
    process.stdin.setRawMode(false)
    resolve()
  }))
}

async function allowResearcherSomeTimeToSetupTheBrowser() {
  console.log("Now you can configure your chrome browser, define default settings and when you're done, press enter");
  await keypress();
}

function buildPageDirective(url) {
  const rightUrl = url.match(/www\./) ?
    url.replace(/www\./, 'mbasic.') : url;
  const retval = {
    loadFor: nconf.get('delay') ? _.parseInt(nconf.get('delay')) * 1000 : 12000,
    url: rightUrl,
  };
  retval.urlo = new URL( retval.url );
  retval.parsed = querystring.parse(retval.urlo.search);
  const chunks = _.compact(retval.urlo.pathname.split('/'));
  if(!urlminer.attributeLinkByPattern(chunks, retval))
    throw new Error("Unable to parse link by pattern");
  return [ _.omit(retval, ['urlo', 'parsed']) ];
}

function buildEventsDirectives(pointerfile) {
  debug("Loading content and parsing JSON from %s", pointerfile);
  const content = JSON.parse(fs.readFileSync(pointerfile, 'utf-8'));
  return _.map(content.eventHrefs, function(eurl) {
    const retval = {
      url: 'https://mbasic.facebook.com' + eurl,
      loadFor: nconf.get('delay') ? _.parseInt(nconf.get('delay')) * 1000 : 12000,
    }
    retval.urlo = new URL( retval.url );
    retval.parsed = querystring.parse(retval.urlo.search);
    const chunks = _.compact(retval.urlo.pathname.split('/'));
    if(!urlminer.attributeLinkByPattern(chunks, retval))
      throw new Error("Unable to parse link by pattern");
    return _.omit(retval, ['urlo', 'parsed']);
  });
}

async function main() {

  if(!nconf.get('page') && !nconf.get('pointer')) {
    console.log("--page or --pointer is required as option");
    console.log("check documentation in https://quickened.interoperability.tracking.exposed/guardoni");
    process.exit(1);
  }

  let directives;
  try {
    if(nconf.get('page'))
      directives = buildPageDirective(nconf.get('page'));
    else
      directives = buildEventsDirectives(nconf.get('pointer'));

    debug("Directive built: %s", JSON.stringify(directives, undefined, 2));
  } catch (error) {
    console.log("Error in building directive: " + error.message);
    console.log(error.stack);
    process.exit(1);
  }


  const cwd = process.cwd();
  const dist = path.resolve(path.join(cwd, '..', 'extension', 'dist'));
  const manifest = path.resolve(path.join(cwd, '..', 'extension', 'dist', 'manifest.json'));
  if(!fs.existsSync(manifest)) {
    console.log('cd ..; cd extension; npm run build:dist');
    process.exit(1);
  }

  const profile = nconf.get('profile');
  if(!profile) {
    console.log("--profile it is necessary and if you don't have one: pick up a name and this tool would assist during the creation");
    // console.log(localbrowser, "--user-data-dir=profiles/<YOUR PROFILE NAME> to init browser");
    process.exit(1)
  }

  let setupDelay = false;
  const udd = path.resolve(path.join('profiles', profile));
  if(!fs.existsSync(udd)) {
    console.log("--profile name hasn't an associated directory: " + udd + "\nLet's create it!");
    // console.log(localbrowser," --user-data-dir=profiles/path to initialize a new profile");
    // process.exit(1)
    fs.mkdirSync(udd);
    setupDelay = true;
  }

  let browser = null;
  try {
    puppeteer.use(pluginStealth());
    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: udd,
        // executablePath:  "C:\\program\ files\ \(x86\)\\Google\\Chrome\\Application\\chrome.exe",
        args: ["--no-sandbox",
          "--disabled-setuid-sandbox",
          "--load-extension=" + dist,
          "--disable-extensions-except=" + dist
        ],
    });
  
    if(setupDelay)
      await allowResearcherSomeTimeToSetupTheBrowser();

    const page = (await browser.pages())[0];
    _.tail(await browser.pages()).forEach(async function(opage) {
      debug("Closing a tab that shouldn't be there!");
      await opage.close();
    });
    // the BS above should close existing open tabs except 1st

    await beforeDirectives(page, profile, directives);
    // ^^^ this execute settings that should always be active
    await operateBroweser(page, directives);
    // this loop over all the directives
    await browser.close();
  } catch(error) {
    console.log("Error in operateBrowser (collection fail):", error);
    await browser.close();
    process.exit(1);
  }
  process.exit(0);
}

async function operateBroweser(page, directives) {
  // await page.setViewport({width: 1024, height: 768});
  for (directive of directives) {
    try {
      await operateTab(page, directive);
    } catch(error) {
      debug("operateTab in %s — error: %s", directive.url, error.message);
    }
  }
}

async function operateTab(page, directive) {
  // TODO the 'timeout' would allow to repeat this operation with
  // different parameters. https://stackoverflow.com/questions/60051954/puppeteer-timeouterror-navigation-timeout-of-30000-ms-exceeded
  await page.goto(directive.url, { 
    waitUntil: "networkidle0",
  });

  debug("Directive to URL %s, Loading delay %d", directive.url, directive.loadFor);
  await page.waitFor(directive.loadFor);

  try {
    if(directive.fblinktype == "events-page") {
      await localParseEventPage(page, directive);
    } else if (directive.fblinktype == "events") {
      await getEvent(page, directive);
    }
  } catch(error) {
    console.log("Error in page operations", error.message, error.stack);
  }

  debug("— Completed operation");
}

main ();
