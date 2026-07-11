import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { authorizeRoomRequest } from "@/lib/rooms/server-auth";
import { ROOM_MESSAGE_TTL_SECONDS } from "@/lib/rooms/constants";
import type { RoomMessageRecord } from "@/lib/rooms/types";

/**
 * Encrypted message backup store for a room. The server only ever
 * sees/stores ciphertext — it has no way to decrypt these rows. This exists
 * so a reconnecting participant can restore messages sent while they were
 * offline, and so "Destroy Chat" has something concrete to delete.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const roomCode = params.code?.trim().toUpperCase();
  const token = request.headers.get("x-room-token");
  const supabase = getSupabaseServerClient();

  const auth = await authorizeRoomRequest(supabase, roomCode, token);
  if (!auth) {
    return NextResponse.json({ error: "Not authorized for this room." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("room_messages")
    .select("*")
    .eq("room_id", auth.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch room messages:", error.message);
    return NextResponse.json({ error: "Failed to fetch messages." }, { status: 500 });
  }

  const messages: RoomMessageRecord[] = (data ?? []).map((row) => ({
    id: row.id,
    ciphertext: row.ciphertext,
    iv: row.iv,
    senderRole: row.sender_role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));

  return NextResponse.json({ messages }, { status: 200 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const roomCode = params.code?.trim().toUpperCase();
  const token = request.headers.get("x-room-token");
  const supabase = getSupabaseServerClient();

  const auth = await authorizeRoomRequest(supabase, roomCode, token);
  if (!auth) {
    return NextResponse.json({ error: "Not authorized for this room." }, { status: 403 });
  }

  let body: { ciphertext?: string; iv?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.ciphertext || !body.iv) {
    return NextResponse.json({ error: "ciphertext and iv are required." }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + ROOM_MESSAGE_TTL_SECONDS * 1000).toISOString();

  const { data, error } = await supabase
    .from("room_messages")
    .insert({
      room_id: auth.id,
      ciphertext: body.ciphertext,
      iv: body.iv,
      sender_role: auth.role,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to store room message:", error.message);
    return NextResponse.json({ error: "Failed to store message." }, { status: 500 });
  }

  await supabase
    .from("rooms")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", auth.id);

  const message: RoomMessageRecord = {
    id: data.id,
    ciphertext: data.ciphertext,
    iv: data.iv,
    senderRole: data.sender_role,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };

  return NextResponse.json({ message }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const roomCode = params.code?.trim().toUpperCase();
  const token = request.headers.get("x-room-token");
  const supabase = getSupabaseServerClient();

  const auth = await authorizeRoomRequest(supabase, roomCode, token);
  if (!auth) {
    return NextResponse.json({ error: "Not authorized for this room." }, { status: 403 });
  }

  const { error } = await supabase.from("room_messages").delete().eq("room_id", auth.id);

  if (error) {
    console.error("Failed to destroy chat:", error.message);
    return NextResponse.json({ error: "Failed to destroy chat." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
