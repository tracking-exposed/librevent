## This directory have been **DISCONTINUED**

_and soon would be removed!_

It has worked well for a few months, but since version 0.3 we moved on a different design.

If you're curious on how this was working, please checkout this video produced by Mobilize.Berlin: [https://vimeo.com/744976039](https://vimeo.com/744976039).

---

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
