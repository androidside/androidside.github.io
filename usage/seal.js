// Opens the sealed session names in `running_names`. WebCrypto only: no imports
// and no DOM access, so the same file runs in the browser and under
// `node --test`. The format is set by collector/seal.py; `iter` and `salt`
// always come from the blob.

const AAD = 'usage-dashboard/running_names/v1';
// Far above the collector's 600000, low enough that a damaged blob cannot hang
// the page.
const MAX_ITER = 10000000;

function checkBlob(sealed) {
  const ok = Boolean(sealed) && typeof sealed === 'object'
    && sealed.v === 1
    && sealed.kdf === 'PBKDF2-SHA256'
    && Number.isInteger(sealed.iter) && sealed.iter > 0 && sealed.iter <= MAX_ITER
    && typeof sealed.salt === 'string'
    && typeof sealed.iv === 'string'
    && typeof sealed.ct === 'string';
  if (!ok) throw new Error('unreadable running_names blob');
}

function fromBase64(text) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

// A non-extractable AES-GCM key, so a remembered key cannot be read back out.
export async function deriveKey(passphrase, sealed) {
  checkBlob(sealed);
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(sealed.salt), iterations: sealed.iter },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

// The parsed names, or throws: a wrong key and a damaged blob both fail the tag.
// JSON.parse ignores the trailing spaces that pad the plaintext.
export async function openNames(key, sealed) {
  checkBlob(sealed);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: new TextEncoder().encode(AAD) },
    key,
    fromBase64(sealed.ct),
  );
  const names = JSON.parse(new TextDecoder().decode(plain));
  if (!names || typeof names !== 'object' || Array.isArray(names)) throw new Error('unreadable running_names plaintext');
  return names;
}
