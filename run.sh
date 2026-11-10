if [[ "$1" == "i" || "$1" == "install" ]]; then
npm i express multer sharp pg cookie-parser
fi
node src/server.js