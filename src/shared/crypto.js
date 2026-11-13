/* crypto-utils.js
* used for encryption/decrypting entries in the local store
*/
const ALGORITHM = { name: "AES-GCM", length: 256 };

async function getOrCreateKey() {
  const stored = await chrome.storage.local.get("_encKey");
  if (stored._encKey) {
    return await crypto.subtle.importKey(
      "raw",
      base64ToBuffer(stored._encKey),
      ALGORITHM,
      false,
      ["encrypt", "decrypt"]
    );
  }
  const key = await crypto.subtle.generateKey(ALGORITHM, true, ["encrypt", "decrypt"]);
  const exported = await crypto.subtle.exportKey("raw", key);
  await chrome.storage.local.set({ _encKey: bufferToBase64(exported) });
  return key;
}

export async function encryptValue(plaintext) {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return bufferToBase64(iv) + "." + bufferToBase64(ciphertext);
}

export async function decryptValue(stored) {
  const key = await getOrCreateKey();
  const [ivB64, ctB64] = stored.split(".");
  const iv = base64ToBuffer(ivB64);
  const ciphertext = base64ToBuffer(ctB64);
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plainBuffer);
}

function bufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuffer(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}