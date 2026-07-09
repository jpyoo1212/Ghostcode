import { randomBytes } from "crypto";
import { CODE_ALPHABET, CODE_LENGTH } from "./constants";

/**
 * Generates a cryptographically random, non-sequential code that gives no
 * information about the underlying message. Uses rejection sampling to
 * avoid modulo bias.
 */
export function generateCode(length: number = CODE_LENGTH): string {
  const alphabetLength = CODE_ALPHABET.length;
  const maxValid = 256 - (256 % alphabetLength);
  let result = "";

  while (result.length < length) {
    const bytes = randomBytes(length - result.length);
    for (const byte of bytes) {
      if (byte < maxValid) {
        result += CODE_ALPHABET[byte % alphabetLength];
      }
      if (result.length === length) break;
    }
  }

  return result;
}
