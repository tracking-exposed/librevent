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
