'use strict';
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'config.json');

function resolveCertifyDir() {
  if (process.env.CERTIFY_DIR) return process.env.CERTIFY_DIR;
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (cfg.certifyDir) return cfg.certifyDir;
    } catch (_) {}
  }
  return path.join(process.cwd(), 'certify');
}

module.exports = { resolveCertifyDir };