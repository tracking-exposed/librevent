#!/usr/bin/env bash

rm -rf ./dist
NODE_ENV=production node_modules/.bin/webpack -p

echo "Manually removing 'localhost' from the manifest.json, but please double check it this matter"
grep -v localhost manifest.json | grep -v 127\.0 > ./dist/manifest.json

cp src/popup/* ./dist
cp icons/* ./dist
cd ./dist
zip extension.zip * 

