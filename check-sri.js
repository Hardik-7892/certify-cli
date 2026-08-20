'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { resolveCertifyDir } = require('./config');

const certDir = resolveCertifyDir();
const html = fs.readFileSync(path.join(certDir, 'verify.html'), 'utf8');
const files = ['noble-post-quantum.js', 'qrcode.js'];
const sris = [...html.matchAll(/integrity="(sha384-[^"]+)"/g)].map((m) => m[1]);
for (const f of files) {
  const actual = 'sha384-' + crypto.createHash('sha384').update(fs.readFileSync(path.join(certDir, f))).digest('base64');
  console.log((sris.includes(actual) ? 'MATCH ' : 'MISMATCH ') + f);
}