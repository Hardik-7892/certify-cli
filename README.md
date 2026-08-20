# certify-cli

Developer-only CLI for minting and verifying **ML-DSA-87** (NIST FIPS 204,
post-quantum) acknowledgement certificates for hardik-pandey.com.

This repo is **never deployed** — the site stays zero-build and
dependency-free. It only produces artifacts that land in the site repo's
`certify/` directory (public key, issued certificates, vendored browser
bundles).

## Layout

| File | Purpose |
| --- | --- |
| `issue-cert.js` | The CLI: `derive`, `sign`, `verify` |
| `config.js` | Resolves the site repo's `certify/` directory |
| `config.json` | Machine-specific path (**gitignored**, not committed) |
| `check-sri.js` | Verifies SRI hashes in the site's `verify.html` |
| `vendor-build.js` | Bundles the browser libraries into the site's `certify/` |
| `bundle-entry.js` / `bundle-entry-qr.js` | esbuild entry points |
| `package.json` / `package-lock.json` | npm deps |

## Setup

The master seed is **yours** — the CLI never generates it for you. Point the
CLI at the site repo first: create a local `config.json` (gitignored) or set
the `CERTIFY_DIR` environment variable:

```json
{ "certifyDir": "C:/path/to/Hardik-7892.github.io/certify" }
```

Install dependencies, then run `init`. It will ask whether to derive your
master seed from a password or paste a raw 64-hex seed. The password path
(selected with `y`, or `--pass` non-interactively) derives the seed with
**scrypt** (memory-hard, ~32 MB) so a password can't be brute-forced cheaply:

```sh
npm install
node issue-cert.js init          # interactive: y = password, N = paste 64-hex
node issue-cert.js init --pass   # skip the choice, go straight to password prompt
node issue-cert.js init --pass "<password>"   # non-interactive (lands in shell history — prefer the prompt)
```

Password-derived seeds are **weaker than a random 64-hex seed** — the public
key is public, so an offline attacker only needs to guess the password. scrypt
slows guessing, but a short/dictionary password is still crackable. Use a long
passphrase (12+ chars, ideally several words) and treat `~/.certify/master.seed`
as secret exactly as before — the password does not protect the file itself.

If a seed already exists `init` asks before overwriting (overwriting changes
your identity and invalidates all previously issued certs). Non-interactive
alternatives: `node issue-cert.js init --seed <64-hex>` or `--set` to skip the
confirmation.

`init` / `derive` reads `~/.certify/master.seed`, derives the signing key, saves
it to `~/.certify/signing.key`, and writes `certify/public-key.json` into the
site repo. Both are deterministic — re-running them produces the same keypair.

## Usage

```sh
node issue-cert.js sign --subject "Name" --claim "Claim text" [--key derived|master] [--seed-file <path> | --key-file <path>] [--issuedAt YYYY-MM-DD] [--publish]
node issue-cert.js verify --file <path>          # or: --data "<json>"
node check-sri.js
npm run vendor:build
```

- **`--key derived`** (default) signs with the saved `~/.certify/signing.key`;
  **`--key master`** re-derives from the seed. Both produce certificates the
  same public key verifies.
- **`--seed-file <path>`** / **`--key-file <path>`** sign using an explicit key
  file (a 64-hex seed or a 4896-byte signing key) instead of the defaults.
- **`--publish`** writes `certify/issued/<id>.json` into the site repo (the
  hosted short URL). The long `?c=` URL needs no commit.

## Security notes

- The seed never leaves `~/.certify` and never enters any repo.
- Nothing secret ships to the site — only the public key, issued certificates,
  and the vendored verification libraries.
- See the site repo's `certify/README.md` for the full threat model and honest
  limits.