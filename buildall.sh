# Install various NPM dependencies...

cd backend

npm install; cd ..

cd extension

npm install --legacy-peer-deps
npm run build

cd ../

echo -e "\nLibrevent is ready. Please follow"
echo -e "\thttps://libre.events/mobilizon-poster/"
