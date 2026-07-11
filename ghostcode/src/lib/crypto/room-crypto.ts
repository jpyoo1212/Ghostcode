"use client";

/**
 * Client-side end-to-end encryption for Private Rooms.
 *
 * Both participants type the same Secret Room Key. Each browser
 * independently derives the same AES-256-GCM key from it via PBKDF2 — the
 * key itself is never sent anywhere. Every message is encrypted before it
 * leaves the browser and decrypted only after it arrives in the peer's
 * browser. The server (and its owner) only ever sees ciphertext.
 *
 * The Room ID is used as the PBKDF2 salt. It's public (shared as an
 * "address"), but a salt doesn't need to be secret — only the Secret Room
 * Key does, and that never touches the network in a form usable to decrypt.
 */

const PBKDF2_ITERATIONS = 150_000;

async function importKeyMaterial(secretKey: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
}

export async function deriveRoomKey(
  secretKey: string,
  roomCode: string
): Promise<CryptoKey> {
  const keyMaterial = await importKeyMaterial(secretKey);
  const encoder = new TextEncoder();

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(`ghostcode-room:${roomCode}`),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function encryptText(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv.buffer),
  };
}

export async function decryptText(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(iv) },
    key,
    base64ToBuffer(ciphertext)
  );

  return new TextDecoder().decode(decrypted);
}
