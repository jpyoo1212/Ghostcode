import type { RoomRole } from "@/lib/rooms/types";

const SESSION_PREFIX = "ghostcode-room:";
const HISTORY_KEY = "ghostcode-room-history";
const MAX_HISTORY_ENTRIES = 6;

export interface StoredRoomSession {
  token: string;
  role: RoomRole;
  secretKey: string;
  roomCode: string;
  updatedAt: number;
}

export interface RoomHistoryEntry {
  roomCode: string;
  role: RoomRole;
  updatedAt: number;
}

export function roomSessionKey(roomCode: string) {
  return `${SESSION_PREFIX}${normalizeRoomCode(roomCode)}`;
}

export function normalizeRoomCode(roomCode: string) {
  return roomCode.trim().toUpperCase();
}

export function getRoomSession(roomCode: string): StoredRoomSession | null {
  const code = normalizeRoomCode(roomCode);
  if (!code) return null;

  const localSession = readRoomSession(getLocalStorage(), code);
  if (localSession) return localSession;

  const tabSession = readRoomSession(getSessionStorage(), code);
  if (tabSession) {
    return saveRoomSession(code, tabSession);
  }

  return null;
}

export function saveRoomSession(
  roomCode: string,
  session: Pick<StoredRoomSession, "token" | "role" | "secretKey"> & Partial<StoredRoomSession>
) {
  const code = normalizeRoomCode(roomCode);
  const stored: StoredRoomSession = {
    token: session.token,
    role: session.role,
    secretKey: session.secretKey,
    roomCode: code,
    updatedAt: Date.now(),
  };
  const payload = JSON.stringify(stored);

  safeSetItem(getLocalStorage(), roomSessionKey(code), payload);
  safeSetItem(getSessionStorage(), roomSessionKey(code), payload);
  writeRoomHistory(upsertHistoryEntry(readRoomHistory(), stored));

  return stored;
}

export function removeRoomSession(roomCode: string) {
  const code = normalizeRoomCode(roomCode);
  safeRemoveItem(getLocalStorage(), roomSessionKey(code));
  safeRemoveItem(getSessionStorage(), roomSessionKey(code));
  writeRoomHistory(getRoomHistory().filter((entry) => entry.roomCode !== code));
}

export function getRoomHistory(): RoomHistoryEntry[] {
  const byCode = new Map<string, RoomHistoryEntry>();

  for (const entry of readRoomHistory()) {
    byCode.set(entry.roomCode, entry);
  }

  for (const storage of [getLocalStorage(), getSessionStorage()]) {
    for (const session of readAllRoomSessions(storage)) {
      byCode.set(session.roomCode, {
        roomCode: session.roomCode,
        role: session.role,
        updatedAt: session.updatedAt,
      });
    }
  }

  return [...byCode.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_HISTORY_ENTRIES);
}

function upsertHistoryEntry(
  history: RoomHistoryEntry[],
  session: StoredRoomSession
): RoomHistoryEntry[] {
  return [
    { roomCode: session.roomCode, role: session.role, updatedAt: session.updatedAt },
    ...history.filter((entry) => entry.roomCode !== session.roomCode),
  ].slice(0, MAX_HISTORY_ENTRIES);
}

function readRoomHistory(): RoomHistoryEntry[] {
  const raw = safeGetItem(getLocalStorage(), HISTORY_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(parseHistoryEntry)
      .filter((entry): entry is RoomHistoryEntry => Boolean(entry))
      .slice(0, MAX_HISTORY_ENTRIES);
  } catch {
    return [];
  }
}

function writeRoomHistory(history: RoomHistoryEntry[]) {
  safeSetItem(getLocalStorage(), HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ENTRIES)));
}

function readAllRoomSessions(storage: Storage | null): StoredRoomSession[] {
  if (!storage) return [];

  const sessions: StoredRoomSession[] = [];
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!key?.startsWith(SESSION_PREFIX)) continue;

      const roomCode = key.slice(SESSION_PREFIX.length);
      const session = readRoomSession(storage, roomCode);
      if (session) sessions.push(session);
    }
  } catch {
    return sessions;
  }

  return sessions;
}

function readRoomSession(storage: Storage | null, roomCode: string): StoredRoomSession | null {
  const raw = safeGetItem(storage, roomSessionKey(roomCode));
  if (!raw) return null;

  try {
    return parseRoomSession(JSON.parse(raw), roomCode);
  } catch {
    return null;
  }
}

function parseRoomSession(value: unknown, roomCode: string): StoredRoomSession | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<StoredRoomSession>;
  if (
    typeof candidate.token !== "string" ||
    typeof candidate.secretKey !== "string" ||
    !isRoomRole(candidate.role)
  ) {
    return null;
  }

  return {
    token: candidate.token,
    role: candidate.role,
    secretKey: candidate.secretKey,
    roomCode: normalizeRoomCode(
      typeof candidate.roomCode === "string" ? candidate.roomCode : roomCode
    ),
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
  };
}

function parseHistoryEntry(value: unknown): RoomHistoryEntry | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<RoomHistoryEntry>;
  if (typeof candidate.roomCode !== "string" || !isRoomRole(candidate.role)) return null;

  return {
    roomCode: normalizeRoomCode(candidate.roomCode),
    role: candidate.role,
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
  };
}

function isRoomRole(value: unknown): value is RoomRole {
  return value === "creator" || value === "joiner";
}

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getSessionStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGetItem(storage: Storage | null, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage | null, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Private browsing / quota failures should not block chat.
  }
}

function safeRemoveItem(storage: Storage | null, key: string) {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore browser storage failures.
  }
}
