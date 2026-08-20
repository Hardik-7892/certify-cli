'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ml_dsa87 } = require('@noble/post-quantum/ml-dsa.js');

const { resolveCertifyDir } = require('./config');
const REPO_SALT = 'hardik-pandey.com';
const ALG = 'ml-dsa-87';
const ISSUER = 'hardik-pandey.com';
const CERTIFY_DIR = resolveCertifyDir();
const ISSUED_DIR = path.join(CERTIFY_DIR, 'issued');
const PUBLIC_KEY_FILE = path.join(CERTIFY_DIR, 'public-key.json');
const KEY_DIR = path.join(os.homedir(), '.certify');
const SEED_FILE = path.join(KEY_DIR, 'master.seed');
const SIGNING_KEY_FILE = path.join(KEY_DIR, 'signing.key');
const VERIFY_URL = 'https://hardik-pandey.com/certify/verify.html';
const FIELDS = ['v', 'issuer', 'issuedAt', 'subject', 'claim'];

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function fromB64url(str) {
  return Buffer.from(str, 'base64url');
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest();
}

function seedInstructions() {
  return [
    'No valid master seed found at: ' + SEED_FILE,
    '',
    'Create it yourself in your own terminal (never share the value):',
    '  $b = New-Object byte[] 32',
    '  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)',
    '  -join ($b | ForEach-Object { $_.ToString(\'x2\' ) })',
    'Set-Content -Path "' + SEED_FILE + '" -Value "<those 64 hex chars>" -Encoding ascii -NoNewline',
    '',
    'Then run: node scripts/issue-cert.js derive',
  ].join('\n');
}

function loadMasterSeed() {
  if (!fs.existsSync(SEED_FILE)) throw new Error(seedInstructions());
  const hex = fs.readFileSync(SEED_FILE, 'utf8').trim();
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('Invalid master.seed — expected exactly 64 hex chars (0-9, a-f). Found: ' + hex.length + ' chars.');
  }
  return Buffer.from(hex, 'hex');
}

function deriveKeypair() {
  const master = loadMasterSeed();
  const kid = new Uint8Array(crypto.hkdfSync('sha256', master, REPO_SALT, ALG, 32));
  return ml_dsa87.keygen(kid);
}

function writeSigningKey(secretKey) {
  fs.mkdirSync(KEY_DIR, { recursive: true });
  fs.writeFileSync(SIGNING_KEY_FILE, Buffer.from(secretKey).toString('hex') + '\n', { mode: 0o600 });
}

function loadSigningKey() {
  if (!fs.existsSync(SIGNING_KEY_FILE)) return null;
  const hex = fs.readFileSync(SIGNING_KEY_FILE, 'utf8').trim();
  if (!/^[0-9a-f]+$/i.test(hex)) throw new Error('Invalid signing.key — expected hex.');
  return Buffer.from(hex, 'hex');
}

function signKeyFor(source) {
  if (source === 'master') return deriveKeypair().secretKey;
  const saved = loadSigningKey();
  if (saved) return saved;
  return deriveKeypair().secretKey;
}

function canonicalPayload(claims) {
  const o = {};
  for (const k of FIELDS) o[k] = claims[k];
  return JSON.stringify(o);
}

function makeCert(claims, keySource) {
  const payload = canonicalPayload(claims);
  const secretKey = signKeyFor(keySource);
  const id = sha256(Buffer.from(payload, 'utf8')).subarray(0, 8).toString('hex');
  const sig = ml_dsa87.sign(Buffer.from(payload, 'utf8'), secretKey);
  return { id, payload, sig, claims };
}

function certFile(cert) {
  return JSON.stringify({ ...cert.claims, id: cert.id, sig: b64url(cert.sig) }, null, 2);
}

function verifyCert(certObj) {
  const claims = {};
  for (const k of FIELDS) claims[k] = certObj[k];
  const payload = Buffer.from(canonicalPayload(claims), 'utf8');
  const idOk = sha256(payload).subarray(0, 8).toString('hex') === certObj.id;
  const pub = JSON.parse(fs.readFileSync(PUBLIC_KEY_FILE, 'utf8'));
  const sigOk = ml_dsa87.verify(fromB64url(certObj.sig), payload, fromB64url(pub.key));
  return { idOk, sigOk };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function writePublicKey(publicKey) {
  const keyB64 = b64url(publicKey);
  const fingerprint = sha256(publicKey).subarray(0, 8).toString('hex');
  const obj = {
    alg: 'ML-DSA-87',
    key: keyB64,
    fingerprint,
    issuer: ISSUER,
    url: VERIFY_URL,
  };
  fs.mkdirSync(CERTIFY_DIR, { recursive: true });
  fs.writeFileSync(PUBLIC_KEY_FILE, JSON.stringify(obj, null, 2) + '\n');
  return obj;
}

function parseFlags(argv) {
  const flags = { subject: null, claim: null, issuedAt: today(), publish: false, key: 'derived' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--subject') flags.subject = argv[++i];
    else if (a === '--claim') flags.claim = argv[++i];
    else if (a === '--issuedAt') flags.issuedAt = argv[++i];
    else if (a === '--publish') flags.publish = true;
    else if (a === '--file') flags.file = argv[++i];
    else if (a === '--data') flags.data = argv[++i];
    else if (a === '--key') flags.key = argv[++i];
  }
  return flags;
}

function printCert(id, certJson, publishPath, keySource) {
  console.log('Certificate ID : ' + id);
  console.log('Signed with    : ' + keySource + ' key');
  if (publishPath) console.log('Verify (short) : ' + VERIFY_URL + '?id=' + id);
  console.log('Verify (long)  : ' + VERIFY_URL + '?c=' + b64url(certJson));
  console.log('');
  console.log('Cert JSON:');
  console.log(certJson);
}

function cmdDerive() {
  const kp = deriveKeypair();
  writeSigningKey(kp.secretKey);
  const pub = writePublicKey(kp.publicKey);
  console.log('Derived signing key written : ' + SIGNING_KEY_FILE);
  console.log('Public key written          : ' + PUBLIC_KEY_FILE);
  console.log('Algorithm                   : ML-DSA-87 (FIPS 204, Level 5)');
  console.log('Public key                  : ' + pub.key);
  console.log('Fingerprint                 : ' + pub.fingerprint);
  console.log('');
  console.log('Derivation is deterministic — running this again produces the same keys.');
  console.log('Back up ' + SEED_FILE + ' — losing it loses the signing key forever.');
}

function cmdSign(flags) {
  if (!flags.subject || !flags.claim) {
    console.error('Usage: node scripts/issue-cert.js sign --subject "Name" --claim "Claim text" [--key derived|master] [--issuedAt YYYY-MM-DD] [--publish]');
    process.exit(1);
  }
  if (flags.key !== 'derived' && flags.key !== 'master') {
    console.error('Error: --key must be "derived" (default) or "master".');
    process.exit(1);
  }
  const claims = { v: 1, issuer: ISSUER, issuedAt: flags.issuedAt, subject: flags.subject, claim: flags.claim };
  const cert = makeCert(claims, flags.key);
  const file = certFile(cert);
  let publishPath = null;
  if (flags.publish) {
    fs.mkdirSync(ISSUED_DIR, { recursive: true });
    publishPath = path.join(ISSUED_DIR, cert.id + '.json');
    fs.writeFileSync(publishPath, file + '\n');
  }
  printCert(cert.id, file, publishPath, flags.key);
}

function cmdVerify(flags) {
  let certObj;
  if (flags.file) certObj = JSON.parse(fs.readFileSync(flags.file, 'utf8'));
  else if (flags.data) certObj = JSON.parse(flags.data);
  else {
    console.error('Usage: node scripts/issue-cert.js verify --file path/to/<id>.json  |  --data "<json>"');
    process.exit(1);
  }
  const { idOk, sigOk } = verifyCert(certObj);
  console.log('ID hash matches      : ' + (idOk ? 'yes' : 'NO'));
  console.log('Signature valid      : ' + (sigOk ? 'yes' : 'NO'));
  console.log('Overall              : ' + (idOk && sigOk ? 'VALID' : 'INVALID'));
  process.exit(idOk && sigOk ? 0 : 1);
}

const cmd = process.argv[2];
try {
  if (cmd === 'init' || cmd === 'derive') cmdDerive();
  else if (cmd === 'sign') cmdSign(parseFlags(process.argv.slice(3)));
  else if (cmd === 'verify') cmdVerify(parseFlags(process.argv.slice(3)));
  else {
    console.log('Usage: node scripts/issue-cert.js <init|derive|sign|verify>');
    console.log('');
    console.log('  init | derive            Read ~/.certify/master.seed, derive the signing key,');
    console.log('                            save ~/.certify/signing.key, publish certify/public-key.json');
    console.log('  sign --subject --claim   Mint a certificate (prints JSON + verify URLs)');
    console.log('      [--key derived|master]  Sign with the saved signing key (default) or re-derive from master');
    console.log('      [--issuedAt YYYY-MM-DD]  Issue date (default: today)');
    console.log('      [--publish]              Write certify/issued/<id>.json for the hosted short URL');
    console.log('  verify --file <path>     Check a certificate JSON (id hash + signature)');
    console.log('      | --data "<json>"');
  }
} catch (err) {
  console.error('Error: ' + err.message);
  process.exit(1);
}