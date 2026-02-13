---
slug: secrets-management
title: Secrets Management
status: accepted
created: 2026-02-12
---

## Description

Encrypted secrets vault using `multi-encrypt`. Secret `.env` files are encrypted into a single `encrypted.json` committed to git. One password decrypts everything. The smart launcher auto-detects missing `.env` files and prompts for the password.

## Overview

Secret files (`.env`) are listed in the `# Secrets` section of the root `.gitignore`. This section serves double duty: it tells git to ignore the plaintext files AND tells `multi-encrypt` which files to encrypt/decrypt.

**Workflow:**
1. Edit your `.env` files locally as normal
2. Run `bun run enc` to encrypt all listed files into `encrypted.json`
3. Commit `encrypted.json` to git
4. On a fresh clone, `bun run dev` auto-detects missing files and prompts for the password
5. Or run `bun run dec` manually to decrypt

**Current secret files:**
- `./.env` — Supabase credentials (`CORE_DATASOURCE_URL`, `CORE_DATASOURCE_KEY`)
- `./demos/chat/.env` — OpenRouter key, GitHub OAuth, session password

## FAQ

**How do I add a new secret file?**
1. Add the path to the `# Secrets` section in `.gitignore` (use `./` prefix, relative to repo root)
2. Run `bun run enc` to re-encrypt all files including the new one
3. Commit both `.gitignore` and `encrypted.json`

**How do I rotate the password?**
1. `bun run dec` with the old password (if files aren't already decrypted)
2. `bun run enc` — enter the new password when prompted
3. Commit the updated `encrypted.json`
4. Share the new password with the team

**What encryption does multi-encrypt use?**
AES-256-GCM with PBKDF2-SHA256 (600k iterations). Uses only Node built-in `crypto` — no native dependencies.

**How does CI/CD get the password?**
Store it as a GitHub Actions secret (`MULTI_ENCRYPT_PASSWORD`). The deploy workflow pipes it via stdin: `echo "$PASSWORD" | bunx multi-encrypt dec`.

**What if I forget the password?**
The plaintext `.env` files are the source of truth. If at least one dev has them, re-encrypt with a new password. If nobody has them, you'll need to regenerate the secrets from their respective services.

**Does every dev need the password?**
Yes. The smart launcher prompts for it automatically when `.env` files are missing. Share the password through a secure channel (not the git repo).

## Reasoning

**Why not dotenv-vault, SOPS, or age?**
- `dotenv-vault` requires a hosted service and account signup
- `sops` / `age` require key distribution (GPG keys, age keys) — more complex than a shared password
- `multi-encrypt` is zero-config: one password, one file, Node built-in crypto only

**Why a manifest in `.gitignore` instead of a config file?**
The secret paths need to be gitignored anyway. Listing them in `.gitignore` with a `# Secrets` header avoids a separate config file and ensures the gitignore and manifest can never drift out of sync.

**Why not a `postinstall` hook?**
A postinstall hook would hang CI with an interactive password prompt. The smart launcher (`core/cli/dev.js`) is the right gate — it only runs during local development.

**Why not auto-modify `.gitignore` when copying demos?**
Auto-modifying `.gitignore` is too magical. Instead, `copyDemo()` prints a warning when the copied demo has a `.env`, telling the dev to manually add the path and re-encrypt.

## Details

### Package

`multi-encrypt@2.0.0` (published Jan 31 2026). Zero dependencies — uses Node built-in `crypto`.

### Manifest format

The `# Secrets` comment in `.gitignore` marks the start of the manifest. All non-empty, non-comment lines after it are treated as file paths:

```gitignore
# Secrets - Handled by multi-encrypt
# Files below are encrypted into encrypted.json (committed to repo).
# After adding a new secret file: bun run enc
./.env
./demos/chat/.env
```

### encrypted.json

v2 format with per-file IV and auth tags. Committed to git. Contains all files listed in the manifest, encrypted with a single password.

### Smart launcher integration

`checkAndDecryptSecrets()` in `core/cli/dev.js`:
1. Checks if `encrypted.json` exists (skips if not — fresh fork with no secrets)
2. Parses `# Secrets` section from `.gitignore` to get file list
3. Checks which listed files are missing on disk
4. If any missing: prints them, runs `bun run dec` with `stdio: 'inherit'`
5. Exits on failure (dev server needs secrets to function)

### CI/CD

Deploy workflows decrypt before building:
```yaml
- name: Decrypt secrets
  run: echo "${{ secrets.MULTI_ENCRYPT_PASSWORD }}" | bunx multi-encrypt dec
```

Lint/typecheck/build-only CI jobs do NOT need decryption.
