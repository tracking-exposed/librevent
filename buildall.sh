cd automation; npm install; cd ..
cd backend; npm install; cd ..
cd extension; npm install; npm run build:dist; cd .. # may need to use --legacy-peer-deps for old webpack version
echo "Librevent is ready, not please follow https://libre.events/mobilizon-poster/"
