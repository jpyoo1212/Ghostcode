/**
 * Central place for tunables so future features (custom expiry, etc.)
 * only need to change one file.
 */
export const MAX_MESSAGE_LENGTH = 500;

export const DEFAULT_TTL_SECONDS = Number(process.env.SECRET_TTL_SECONDS ?? 180);

export const CODE_LENGTH = 16;

export const CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
