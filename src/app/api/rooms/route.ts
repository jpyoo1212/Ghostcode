import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateRoomCode, generateRoomKey, generateSessionToken } from "@/lib/rooms/code-generator";
import { sha256Hex } from "@/lib/hash";
import type { CreateRoomResponse } from "@/lib/rooms/types";

export async function POST(_request: NextRequest) {
  const supabase = getSupabaseServerClient();

  const secretKey = generateRoomKey();
  const keyHash = sha256Hex(secretKey);
  const creatorToken = generateSessionToken();

  let roomCode = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("rooms").insert({
      room_code: roomCode,
      key_hash: keyHash,
      creator_token: creatorToken,
    });

    if (!error) {
      const response: CreateRoomResponse = {
        roomCode,
        secretKey,
        token: creatorToken,
        role: "creator",
      };
      return NextResponse.json(response, { status: 201 });
    }

    if (error.code === "23505") {
      roomCode = generateRoomCode();
      continue;
    }

    console.error("Failed to create room:", error.message);
    return NextResponse.json({ error: "Failed to create room." }, { status: 500 });
  }

  return NextResponse.json({ error: "Failed to generate a unique Room ID." }, { status: 500 });
}
