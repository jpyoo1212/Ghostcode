import { randomBytes } from "crypto";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_KEY_ALPHABET,
  ROOM_KEY_LENGTH,
} from "./constants";

function randomFromAlphabet(alphabet: string, length: number): string {
  const maxValid = 256 - (256 % alphabet.length);
  let result = "";
  while (result.length < length) {
    const bytes = randomBytes(length - result.length);
    for (const byte of bytes) {
      if (byte < maxValid) result += alphabet[byte % alphabet.length];
      if (result.length === length) break;
    }
  }
  return result;
}

/** Short, easy-to-read/share Room ID (not secret — just an address). */
export function generateRoomCode(): string {
  return randomFromAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH);
}

/** High-entropy Secret Room Key. This is the actual shared secret. */
export function generateRoomKey(): string {
  return randomFromAlphabet(ROOM_KEY_ALPHABET, ROOM_KEY_LENGTH);
}

/** Opaque per-participant session token, proves membership in a room. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}
