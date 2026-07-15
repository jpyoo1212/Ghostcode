"use client";

/**
 * Bundles a Room ID + Secret Room Key into a single, copy-pasteable "join
 * code" (and, wrapped in a URL, a one-tap invite link). This is a plain
 * encoding, not encryption — the actual secrecy still comes entirely from
 * the Secret Room Key itself. The point is purely UX: one thing to share
 * and one field to paste, instead of two.
 */

function toBase64Url(input: string): string {
  const base64 =
    typeof window !== "undefined"
      ? window.btoa(input)
      : Buffer.from(input, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return typeof window !== "undefined"
    ? window.atob(padded)
    : Buffer.from(padded, "base64").toString("utf-8");
}

export function encodeJoinCode(roomCode: string, secretKey: string): string {
  return toBase64Url(`${roomCode.toUpperCase()}:${secretKey}`);
}

export function decodeJoinCode(code: string): { roomCode: string; secretKey: string } | null {
  const trimmed = code.trim();
  if (!trimmed) return null;

  try {
    const raw = fromBase64Url(trimmed);
    const separatorIndex = raw.indexOf(":");
    if (separatorIndex === -1) return null;

    const roomCode = raw.slice(0, separatorIndex).toUpperCase();
    const secretKey = raw.slice(separatorIndex + 1);
    if (!roomCode || !secretKey) return null;

    return { roomCode, secretKey };
  } catch {
    return null;
  }
}

export function buildInviteLink(roomCode: string, secretKey: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/room?j=${encodeJoinCode(roomCode, secretKey)}`;
}

/**
 * Accepts whatever someone pastes into the single join field — a full
 * invite link, just its query string, or a bare join code — and resolves
 * it to a Room ID + Secret Key. Returns null if it's not recognizable.
 */
export function resolveJoinInput(input: string): { roomCode: string; secretKey: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.includes("j=")) {
    try {
      const url = new URL(trimmed, typeof window !== "undefined" ? window.location.origin : "https://placeholder.invalid");
      const j = url.searchParams.get("j");
      if (j) {
        const decoded = decodeJoinCode(j);
        if (decoded) return decoded;
      }
    } catch {
      // Not a valid URL — fall through and try it as a raw code below.
    }
  }

  return decodeJoinCode(trimmed);
}
