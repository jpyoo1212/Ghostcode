import { SupabaseClient } from "@supabase/supabase-js";

export interface AuthorizedRoom {
  id: string;
  role: "creator" | "joiner";
}

/**
 * Validates an x-room-token header against a room's stored tokens.
 * Returns the room's internal id and the caller's role, or null if the
 * token doesn't match either participant slot.
 */
export async function authorizeRoomRequest(
  supabase: SupabaseClient,
  roomCode: string,
  token: string | null
): Promise<AuthorizedRoom | null> {
  if (!token) return null;

  const { data: room, error } = await supabase
    .from("rooms")
    .select("id, creator_token, joiner_token")
    .eq("room_code", roomCode)
    .maybeSingle();

  if (error || !room) return null;

  if (token === room.creator_token) return { id: room.id, role: "creator" };
  if (token === room.joiner_token) return { id: room.id, role: "joiner" };

  return null;
}
