const _ = require('lodash');
const debug = require('debug')('lib:sharedoni');
const fs = require('fs');
const nconf = require('nconf');
const moment = require('moment');
const fetch = require('node-fetch');

async function beforeDirectives(page, profile, directives) {
  // debug("Watching and duplicating browser console...");
  // page.on('console', function(message) { bcons("%s", message.text())});
  page.on('pageerror', function(message) {
      debug(`Error: ${message}`)
  });
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

function getChromePath() {
  // this function check for standard chrome executabled path and 
  // return it. If not found, raise an error
  const knownPaths = [
    "/usr/bin/google-chrome",
    "/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];

  const chromePath = _.find(knownPaths, function(p) {
    return fs.existsSync(p);
  })
  if(!chromePath) {
    console.log("Tried to guess your Chrome executable and wasn't found");
    console.log("Solutions: Install Google Chrome in your system or contact the developers");
    process.exit(1);
  }
  return chromePath;
}

module.exports = {
    beforeDirectives,
    keypress,
    allowResearcherSomeTimeToSetupTheBrowser,
    getChromePath,
}
