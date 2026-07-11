import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateSessionToken } from "@/lib/rooms/code-generator";
import { sha256Hex } from "@/lib/hash";
import type { JoinRoomResponse } from "@/lib/rooms/types";

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const roomCode = params.code?.trim().toUpperCase();
  let body: { secretKey?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const secretKey = body.secretKey?.trim();
  if (!roomCode || !secretKey) {
    return NextResponse.json({ error: "Room ID and Secret Room Key are required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();

  const { data: room, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (error) {
    console.error("Failed to look up room:", error.message);
    return NextResponse.json({ error: "Failed to look up room." }, { status: 500 });
  }

  if (!room) {
    const body: JoinRoomResponse = { status: "not_found" };
    return NextResponse.json(body, { status: 404 });
  }

  if (sha256Hex(secretKey) !== room.key_hash) {
    const body: JoinRoomResponse = { status: "invalid_key" };
    return NextResponse.json(body, { status: 401 });
  }

  if (room.joiner_token) {
    const body: JoinRoomResponse = { status: "room_full" };
    return NextResponse.json(body, { status: 409 });
  }

  const joinerToken = generateSessionToken();

  // Atomic guard: only succeed if joiner_token is still null (protects
  // against two people joining at almost the same instant).
  const { data: updated, error: updateError } = await supabase
    .from("rooms")
    .update({ joiner_token: joinerToken, last_active_at: new Date().toISOString() })
    .eq("id", room.id)
    .is("joiner_token", null)
    .select()
    .maybeSingle();

  if (updateError || !updated) {
    const body: JoinRoomResponse = { status: "room_full" };
    return NextResponse.json(body, { status: 409 });
  }

  const responseBody: JoinRoomResponse = {
    status: "ok",
    roomCode,
    token: joinerToken,
    role: "joiner",
  };
  return NextResponse.json(responseBody, { status: 200 });
}
