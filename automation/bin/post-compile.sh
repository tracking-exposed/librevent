#!/usr/bin/sh

# this script is invoked by npm run pkt, and simply should rename the executabled with the proper version name.

version=`grep version package.json | cut -b 15- | sed -es/\".*//`

cd dist

mv libertadata-win.exe libertadata-$version.exe
mv libertadata-macos libertadata-$version-macos
mv libertadata-linux libertadata-$version-linux
ls -l
cd ..
