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

The master seed is **yours** — the CLI never generates it for you. Create it
once in your own terminal and keep it private:

```powershell
$b = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
-join ($b | ForEach-Object { $_.ToString('x2') })   # 64 hex chars — your master key
Set-Content -Path "$env:USERPROFILE\.certify\master.seed" -Value "<those 64 hex chars>" -Encoding ascii -NoNewline
```

Then point the CLI at the site repo. Create a local `config.json` (gitignored)
or set the `CERTIFY_DIR` environment variable:

```json
{ "certifyDir": "C:/path/to/Hardik-7892.github.io/certify" }
```

Install dependencies and derive the keypair:

```sh
npm install
node issue-cert.js derive
```

`derive` reads `~/.certify/master.seed`, derives the signing key, saves it to
`~/.certify/signing.key`, and writes `certify/public-key.json` into the site
repo. It is deterministic — re-running it produces the same keypair.

## Usage

```sh
node issue-cert.js sign --subject "Name" --claim "Claim text" [--key derived|master] [--issuedAt YYYY-MM-DD] [--publish]
node issue-cert.js verify --file <path>          # or: --data "<json>"
node check-sri.js
npm run vendor:build
```

- **`--key derived`** (default) signs with the saved `~/.certify/signing.key`;
  **`--key master`** re-derives from the seed. Both produce certificates the
  same public key verifies.
- **`--publish`** writes `certify/issued/<id>.json` into the site repo (the
  hosted short URL). The long `?c=` URL needs no commit.

## Security notes

- The seed never leaves `~/.certify` and never enters any repo.
- Nothing secret ships to the site — only the public key, issued certificates,
  and the vendored verification libraries.
- See the site repo's `certify/README.md` for the full threat model and honest
  limits.