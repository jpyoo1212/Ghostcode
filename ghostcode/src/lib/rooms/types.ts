export type RoomRole = "creator" | "joiner";

export interface CreateRoomResponse {
  roomCode: string;
  secretKey: string;
  token: string;
  role: RoomRole;
}

export type JoinRoomResponse =
  | { status: "ok"; roomCode: string; token: string; role: RoomRole }
  | { status: "invalid_key" }
  | { status: "room_full" }
  | { status: "not_found" };

export type SessionResponse =
  | { status: "ok"; role: RoomRole; roomCode: string; roomFull: boolean }
  | { status: "invalid" };

export interface EncryptedEnvelope {
  ciphertext: string;
  iv: string;
}

export interface RoomMessageRecord {
  id: string;
  ciphertext: string;
  iv: string;
  senderRole: RoomRole;
  createdAt: string;
  expiresAt: string;
}
