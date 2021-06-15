#!/usr/bin/env node
const _ = require('lodash');
const debug = require('debug')('fbwatcher');
const puppeteer = require("puppeteer-extra")
const pluginStealth = require("puppeteer-extra-plugin-stealth");
const fs = require('fs');
const path = require('path');
const nconf = require('nconf');
const execSync = require('child_process').execSync;
const querystring = require('querystring');

const urlminer = require('../../backend/parsers/urlminer');

nconf.argv().env();

defaultAfter = async function(page, directive) {
  debug("afterWait function is not implemented");
}
defaultBefore = async function(page, directive) {
  debug("beforeWait function is not implemented");
}
defaultInit = async function(page, directive) {
  debug("beforeDirective function is not implemented");
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

async function main() {

  /*
  const sourceUrl = nconf.get('source');
  if(!sourceUrl) {
    console.log("Mandatory option --list is missing and should be a .json file");
    process.exit(1);
  } */

  if(!nconf.get('url')) {
    console.log("--url required");
    process.exit(1);
  }

  let directives;
  try {
    retval = {
      line: 1,
      loadFor: 12000,
      url: nconf.get('url'),
    };
    retval.urlo = new URL( retval.url );
    retval.parsed = querystring.parse(retval.urlo.search);
    const chunks = _.compact(retval.urlo.pathname.split('/'));
    if(!urlminer.attributeLinkByPattern(chunks, retval))
      throw new Error("Unable to parse link by pattern");
    directives = [ _.omit(retval, ['urlo', 'parsed']) ];
    debug("Directive %s", JSON.stringify(directives, undefined, 2));
  } catch (error) {
    console.log("Error in retriving directive URL: " + error.message);
    console.log(error.stack);
    // console.log(error.response.body);
    process.exit(1);
  }

  debug("Opening %d URLs/directives", directives.length);

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
    browser = await puppeteer.launch({
        headless: false,
        userDataDir: udd,
        args: ["--no-sandbox",
          "--disabled-setuid-sandbox",
          "--load-extension=" + dist,
          "--disable-extensions-except=" + dist
        ],
    });
  
    if(setupDelay)
      await allowResearcherSomeTimeToSetupTheBrowser();

    const DS = './domainSpecific';
    let domainSpecific = null;
    try {
      domainSpecific = require(DS);
    } catch(error) {
      console.log("Not found domainSpecific!?", DS, error);
      domainSpecific = {
        beforeWait: defaultBefore,
        afterWait: defaultAfter,
        beforeDirectives: defaultInit,
      };
    }
    const page = (await browser.pages())[0];
    _.tail(await browser.pages()).forEach(async function(opage) {
      debug("Closing a tab that shouldn't be there!");
      await opage.close();
    })
    await domainSpecific.beforeDirectives(page, profile, directives);
    // the BS above should close existing open tabs except 1st
    await operateBroweser(page, directives, domainSpecific);
    await browser.close();
  } catch(error) {
    console.log("Error in operateBrowser (collection fail):", error);
    await browser.close();
    process.exit(1);
  }
  process.exit(0);
}

async function operateTab(page, directive, domainSpecific, timeout) {
  // TODO the 'timeout' would allow to repeat this operation with
  // different parameters. https://stackoverflow.com/questions/60051954/puppeteer-timeouterror-navigation-timeout-of-30000-ms-exceeded
  await page.goto(directive.url, { 
    waitUntil: "networkidle0",
  });
  debug("— Loading URL %d", directive.line);
  try {
    await domainSpecific.beforeWait(page, directive);
  } catch(error) {
    console.log("error in beforeWait", error.message, error.stack);
  }
  debug("Directive to URL %s, Loading delay %d", directive.url, directive.loadFor);
  await page.waitFor(directive.loadFor);
  console.log("Done loading wait. Calling domainSpecific");
  try {
    await domainSpecific.afterWait(page, directive);
  } catch(error) {
    console.log("Error in afterWait", error.message, error.stack);
  }
  debug("— Completed operation %d", directive.line);
}

async function operateBroweser(page, directives, domainSpecific) {
  // await page.setViewport({width: 1024, height: 768});
  for (directive of directives) {
    try {
      await operateTab(page, directive, domainSpecific);
    } catch(error) {
      debug("operateTab in %s — error: %s", directive.url, error.message);
    }
  }
}

main ();
