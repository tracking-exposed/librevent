Tools and commands for automated librevent 

1. [Install nodejs in your system](https://nodejs.org/en/download://nodejs.org/en/download/)
2. download: https://github.com/tracking-exposed/librevent/archive/master.zip
3. unpack and enter in `automation` directory 
4. `npm install`
5. `node src/guardoni.js`


### How does `node src/guardoni.js` works


start by giving the command:

`node src/guardoni.js --source http://localhost:13000/api/v2/common/previews/guardoni`

In should return something like:

```
Mandatory you specify with --chrome the absolute path of chrome executable. For example:
{
  "windows": "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "linux": "/usr/bin/google-chrome"
}
```


`mkdir profiles/user1` or create any directory under `profiles`. chromium would populate that directory.

1. it have to follow a list of URL retrieved from a JSON list reachable on the web. You can decide which URL, we offer two of them as default: [conservative](https://youtube.tracking.exposed/bin/conservative-filtertube.json), [progressive](https://youtube.tracking.exposed/bin/progressive-filtertube.json).
2. you have to create a directory where the chrome-profile would live. we suggest to create a directory in `methodology/profiles/` 
3. you have to download a .zip (the browser extension of [youtube.tracking.exposed](/)) and unpack it `methodology/extension/`

What you're ready, guardoni.js is a script that uses puppeteer and automate chrome.
for our video we configured the method to watch them till the end. In other pages and other cases you might want to train your profile

# Examples

`node scr/guardoni.js --source https://youtube.tracking.exposed/bin/conservative-filtertube.json --profile profiles/conservative1`

or, if you enable debug:

`DEBUG=*,-puppeteer:* node src/guardoni.js --source https://youtube.tracking.exposed/bin/progressive-filtertube.json --profile profiles/progressiv1`
