const fs = require('fs');
const https = require('https');
const path = require('path');

const map = {
  "pt": "pt", "ar": "ar", "fr": "fr", "de": "de",
  "es": "es", "gb-eng": "gb-eng", "br": "br", "it": "it",
  "nl": "nl", "be": "be", "hr": "hr", "uy": "uy",
  "jp": "jp", "kr": "kr", "us": "us", "mx": "mx",
  "sn": "sn", "ma": "ma", "ch": "ch", "pl": "pl",
  "gb-sct": "gb-sct", "gb-wls": "gb-wls", "un": "un", "id": "id"
};

const dir = path.join(__dirname, 'public', 'teams');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

Object.values(map).forEach(code => {
  const url = `https://flagcdn.com/w320/${code}.png`;
  const dest = path.join(dir, `${code}.png`);
  const file = fs.createWriteStream(dest);
  https.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close();  // close() is async, call cb after close completes.
      console.log(`Downloaded ${code}.png`);
    });
  }).on('error', function(err) {
    fs.unlink(dest, () => {});
    console.error(`Error downloading ${code}.png: ${err.message}`);
  });
});
