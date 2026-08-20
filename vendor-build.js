'use strict';
const esbuild = require('esbuild');
const path = require('path');
const { resolveCertifyDir } = require('./config');

async function main() {
  const certDir = resolveCertifyDir();
  const shared = { bundle: true, format: 'iife', minify: true, logLevel: 'info' };
  await esbuild.build({ ...shared, entryPoints: ['bundle-entry.js'], outfile: path.join(certDir, 'noble-post-quantum.js') });
  await esbuild.build({ ...shared, entryPoints: ['bundle-entry-qr.js'], outfile: path.join(certDir, 'qrcode.js') });
  console.log('Vendored bundles written to: ' + certDir);
}

main().catch((err) => { console.error('Error: ' + err.message); process.exit(1); });