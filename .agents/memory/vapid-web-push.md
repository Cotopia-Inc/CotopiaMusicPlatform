---
name: VAPID key generation for Web Push
description: How to correctly generate VAPID keys for the web-push library; manual Node.js crypto extraction has an off-by-one bug.
---

## Rule
Always use `web-push`'s own `generateVAPIDKeys()` to generate VAPID keys — never extract them manually from Node.js `generateKeyPairSync` output.

**Why:** Manual extraction using `publicKey.slice(27)` drops the `0x04` uncompressed-point prefix from the P-256 DER-encoded SPKI output, producing a 64-byte key instead of the required 65 bytes. `web-push` rejects this with "Vapid public key should be 65 bytes long when decoded."

**How to apply:** Run this once to get a valid pair:
```bash
node --input-type=module <<'EOF'
import webPush from '/home/runner/workspace/node_modules/.pnpm/web-push@3.6.7/node_modules/web-push/src/index.js';
const keys = webPush.generateVAPIDKeys();
console.log('PUBLIC:' + keys.publicKey);
console.log('PRIVATE:' + keys.privateKey);
EOF
```
Then store PUBLIC in `VAPID_PUBLIC_KEY` + `VITE_VAPID_PUBLIC_KEY` (shared env vars) and PRIVATE in `VAPID_PRIVATE_KEY` (shared env var). Subject goes in `VAPID_SUBJECT`.

## Current keys (Cotopia)
- Public (87 chars base64url): `BFnQz2DCxNPmt5XqhI5vkRZQWYgb47e8U_fnKNzVcEPD-kD8l5CON6Kvr8U5GED0obtw7u_Q8rHSfbtet2W9GCM`
- Stored as shared env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `VITE_VAPID_PUBLIC_KEY`
