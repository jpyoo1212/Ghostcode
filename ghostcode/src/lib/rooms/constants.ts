export const ROOM_CODE_LENGTH = 8;
export const ROOM_KEY_LENGTH = 20;
export const ROOM_MESSAGE_TTL_SECONDS = 60 * 60 * 24; // 24 hours for reconnect/history restore
export const ROOM_MESSAGE_RETENTION_LABEL = "24 hours";
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars, easy to read aloud
export const ROOM_KEY_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz23456789";
