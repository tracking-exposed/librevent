#!/usr/bin/env node
const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const nconf = require('nconf');
const moment = require('moment');
const querystring = require('querystring');
const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');

const debug = require('debug')('libertadata');
debug.enabled = true;

const urlminer = require('../lib/urlminer');
const imagefetch = require('../lib/imagefetch');
const shardoni = require('../lib/shardoni');

const SCREENSHOTS = "screenshots"; // default folder name

const defaultCfgPath = "libertadata.json";
if(!fs.existsSync(defaultCfgPath)) {
  console.log("Creating default configuration file: ", defaultCfgPath);
  fs.writeFileSync(defaultCfgPath, JSON.stringify({
    profile: "libertadata",
    delay: 4,
  }, undefined, 2));
}

nconf.argv().env();
nconf.defaults({
  config: defaultCfgPath
});
const configFile = nconf.get('config');
nconf.argv().env().file(configFile);


async function getEvent(page, directive) {
  // this function is invoked when an event is rendered
  // and considering the different variation Facebook enact,
  // we should build from a page of our a variety of different events
  // and test if the are correctly acquired.

  const eventDetails = await page.evaluate(() => {
    const sctns = document.querySelectorAll('section');
    const desrows = sctns[0].querySelectorAll('tr');
    const img = document.querySelector('img[role="img"]');
    const title=document.querySelectorAll('title');;

    const mandatory = {
      rowcount: desrows.length,
      sectioncount: sctns.length,
      dates: desrows[0].innerText,
      when: desrows[0].querySelector('div').innerText,
      title: title[0].innerText,
    }

    if (desrows.length > 1)
      mandatory.location = desrows[1].querySelector('div').innerText;

    if(img && img.getAttribute('src'))
      mandatory.src = img.getAttribute('src');
    if(sctns.length > 1)
      mandatory.description = sctns[1].innerText;

    return JSON.stringify(mandatory);
  });

  if(!fs.existsSync('evdetails'))
    fs.mkdirSync('evdetails');

  const evfname = directive.eventId + '_' + moment().format("YYYY-MM-DD-HH-mm");
  const evscrout = path.join(SCREENSHOTS, `${evfname}.png`);
  const evjsondetf = path.join("evdetails", `${evfname}.json`);

  const eventnfo = JSON.parse(eventDetails);
  /* pieces of code from imagefetch.mineImg */
  eventnfo.urlo = new URL(eventnfo.src);
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
}

async function localParseEventPage(page, directive) {

  const valuables = {};
  const data = await page.evaluate(() => {
    const ahrefs = document.querySelectorAll('a[href^="/events/"]');
    const result = [];
    for (let i = 0; i < ahrefs.length; i++) {
      result.push(ahrefs[i].getAttribute('href'));
    }
    console.log("X", result);
    return JSON.stringify(result);
  });

  // https://stackoverflow.com/questions/52045947/nodejs-puppeteer-how-to-use-page-evaluate
  if(data && data.length > 2) {
    const cleanHrefs = _.uniq(_.map(JSON.parse(data), function(href) {
      return href.replace(/\?.*/, '');
    }));
    valuables.eventHrefs = cleanHrefs;
  }

  if(!fs.existsSync(SCREENSHOTS)) {
    console.log("Creating 'screenshots' directory");
    fs.mkdirSync(SCREENSHOTS);
  }

  if(valuables.eventHrefs) {
    const fname = _.concat([ moment().format("YYYY-MM-DD+HH-mm")], _.values(_.omit(directive, [ 'quintrex', 'url', 'loadFor']))).join('+')
    const scrout = path.join(SCREENSHOTS, `${fname}.png`);
    await page.screenshot({ path: scrout, type: 'png' });
    debug("Screenshot saved as %s", scrout);

    const pout = "libertadata.log";
    valuables.screenshot = scrout;
    fs.writeFileSync(pout, moment().format("YYYY-MM-DD HH:mm:SS") + "," +
      _.values(valuables).join(",") + "\n", { encoding: 'utf-8', flag: 'a'});
    // this return for the next iteration
    return valuables;
  } else {
    console.log("Nothing saved as nothing worthy have been found!");
  }
}

function buildPageDirective(url) {

  if(!url.match(/\/events\//)) {
    console.log("Invalid page: it should finish with /events");
    console.log(url);
    process.exit(1);
  }

  const rightUrl = url.match(/www\./) ?
    url.replace(/www\./, 'mbasic.') : url;

  const delayMs = nconf.get('delay') ? (_.parseInt(nconf.get('delay')) * 1000) : 4000;
  if(delayMs > 15000) {
    console.log("Warning: the delay should be expressed in seconds, and seems bigger than 15 seconds: ",
      delayMs / 1000);
  }
  const retval = {
    loadFor: delayMs,
    url: rightUrl,
  };
  retval.urlo = new URL( retval.url );
  retval.parsed = querystring.parse(retval.urlo.search);
  const chunks = _.compact(retval.urlo.pathname.split('/'));
  if(!urlminer.attributeLinkByPattern(chunks, retval))
    throw new Error("Unable to parse link by pattern");
  return [ _.omit(retval, ['urlo', 'parsed']) ];
}

function buildEventsDirectives(eventHrefs) {
  return _.map(eventHrefs, function(eurl) {
    const retval = {
      url: 'https://mbasic.facebook.com' + eurl,
      loadFor: nconf.get('delay') ? _.parseInt(nconf.get('delay')) * 1000 : 5000,
    }
    retval.urlo = new URL( retval.url );
    retval.parsed = querystring.parse(retval.urlo.search);
    const chunks = _.compact(retval.urlo.pathname.split('/'));
    if(!urlminer.attributeLinkByPattern(chunks, retval))
      throw new Error("Unable to parse link by pattern");
    return _.omit(retval, ['urlo', 'parsed']);
  });
}

async function browserExecution(directives) {
  const profile = nconf.get('profile');
  if(!profile) {
    console.log("--profile it is necessary and if you don't have one: pick up a name");
    process.exit(1);
  }

  const default_profile_name = "libertadata"
  if(profile === "liberadata") {
    console.log("--profile is not set. The tool uses the default ", default_profile_name);
    console.log("you can configure it in 'libertadata.json' config file, or specify with --config");
  }

  let setupDelay = false;
  const udd = path.resolve(profile);
  if(!fs.existsSync(udd)) {
    console.log("--profile libertadata hasn't a directory associated: creating!");
    fs.mkdirSync(udd);
    setupDelay = true;
  }

  let executablePath = nconf.get('chrome') || shardoni.getChromePath();
  if(!executablePath) {
    console.log("--chrome should be a path and can point to chromium executable");
    console.log("you can configure it in 'libertadata.json' config file, or specify with --config");
    process.exit(1);
  }

  let browser = null;
  try {
    puppeteer.use(pluginStealth());
    const browser = await puppeteer.launch({
      headless: false,
      userDataDir: udd,
      executablePath,
      args: ["--no-sandbox", "--disabled-setuid-sandbox" ],
    });
  
    if(setupDelay)
      await shardoni.allowResearcherSomeTimeToSetupTheBrowser();

    const page = (await browser.pages())[0];
    _.tail(await browser.pages()).forEach(async function(opage) {
      debug("Closing a tab that shouldn't be there!");
      await opage.close();
    });
    // the BS above should close existing open tabs except 1st

    await shardoni.beforeDirectives(page, profile, directives);
    // ^^^ this execute settings that should always be active

    const retval = [];
    // await page.setViewport({width: 1024, height: 768});
    for (directive of directives) {
      try {
        const r = await operateTab(page, directive);
        retval.push(r);
      } catch(error) {
        debug("operateTab in %s — error: %s", directive.url, error.message);
      }
    }
    await browser.close();
    return retval;

  } catch(error) {
    console.log("Error in operateBrowser (collection fail):", error);
    await browser.close();
    process.exit(1);
  }
}

async function operateTab(page, directive) {
  // TODO the 'timeout' would allow to repeat this operation with
  // different parameters. https://stackoverflow.com/questions/60051954/puppeteer-timeouterror-navigation-timeout-of-30000-ms-exceeded
  await page.goto(directive.url, { 
    waitUntil: "networkidle0",
  });

  debug("Directive to URL %s, Loading delay %d", directive.url, directive.loadFor);
  await page.waitForTimeout(directive.loadFor);

  try {
    if(directive.fblinktype == "events-page") {
      return await localParseEventPage(page, directive);
    } else if (directive.fblinktype == "events") {
      return await getEvent(page, directive);
    }
  } catch(error) {
    console.log("Error in page operations", error.message, error.stack);
  }
}

async function main() {

  const helptext = `Options can be specify with --longopts, or in ${defaultCfgPath} config\n
  --page https://www.facebook.com/about.party/events/
  --pages firstpage,secondpage\n\n
This tool creates DIRECTORY 'screenshots' and 'evdetails' 
                   and FILE 'libertadata.json' and 'libertadata.log'
check documentation in https://quickened.interoperability.tracking.exposed/libertadata`;

  if(!nconf.get('page') && !nconf.get('pages') ) {
    console.log(helptext);
    process.exit(1);
  }

  let directives = null;
  try {
    
    /* this function return a list of directived that depends on
    * the option supply via config files or via command line */
    const pages = nconf.get('pages');
    if(pages?.length) {
      debug("Multiple pages access! %d", pages.length);
      directives = _.flatten(_.map(pages, buildPageDirective));
    }

    directives = buildPageDirective(nconf.get('page')) 
  } catch (error) {
    console.log("Error in building directive: " + error.message);
    console.log(error.stack);
    process.exit(1);
  }

  debug("Connecting to %j", _.map(directives, 'url'));
  const pointers = await browserExecution(directives);
  directives = buildEventsDirectives(pointers[0].eventHrefs);
  debug("Connecting to %j", _.map(directives, 'url'));
  const completed = await browserExecution(directives);
  console.log("Now files in 'evdetails' can be used by mobilizon-bridge");
}

main ();
