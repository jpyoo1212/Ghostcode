import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionResponse } from "@/lib/rooms/types";

/**
 * Lets a browser that already joined/created a room re-establish its
 * session after a refresh, using the opaque token it stored — without
 * re-entering the Secret Room Key. The token itself proves membership.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const roomCode = params.code?.trim().toUpperCase();
  const token = request.headers.get("x-room-token");

  if (!roomCode || !token) {
    const body: SessionResponse = { status: "invalid" };
    return NextResponse.json(body, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { data: room, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (error || !room) {
    const body: SessionResponse = { status: "invalid" };
    return NextResponse.json(body, { status: 404 });
  }

  let role: "creator" | "joiner" | null = null;
  if (token === room.creator_token) role = "creator";
  else if (token === room.joiner_token) role = "joiner";

  if (!role) {
    const body: SessionResponse = { status: "invalid" };
    return NextResponse.json(body, { status: 403 });
  }

  const body: SessionResponse = {
    status: "ok",
    role,
    roomCode,
    roomFull: Boolean(room.joiner_token),
  };
  return NextResponse.json(body, { status: 200 });
}
