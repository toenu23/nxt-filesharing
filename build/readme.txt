Steps to build the modules.js file yourself, which includes the parse-torrent-file module and the modules it requires.

1. Install browserify
npm install -g browserify

2. Install the modules
npm install

3. Browserify
browserify -o modules.js -s p_filesharing_modules index.js
