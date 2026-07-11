import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { decryptMessage } from "@/lib/crypto";
import type { DecodeSecretResponse, SecretRow } from "@/lib/types";

/**
 * Decoding is a POST (not GET) because it is a destructive, one-time action:
 * a successful read consumes the secret. GET requests should never have
 * side effects, and browsers/crawlers/link-preview bots can trigger GETs
 * without the user's intent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.trim();

  if (!code) {
    const body: DecodeSecretResponse = { status: "not_found" };
    return NextResponse.json(body, { status: 404 });
  }

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("secrets")
    .select("*")
    .eq("code", code)
    .maybeSingle<SecretRow>();

  if (error) {
    console.error("Failed to look up secret:", error.message);
    return NextResponse.json({ error: "Failed to look up code." }, { status: 500 });
  }

  const isExpired = !data || data.used || new Date(data.expires_at) < new Date();

  if (isExpired) {
    // Best-effort cleanup of expired/used rows we happen to stumble on.
    if (data) {
      await supabase.from("secrets").delete().eq("id", data.id);
    }
    const body: DecodeSecretResponse = { status: "expired" };
    return NextResponse.json(body, { status: 410 });
  }

  // Consume atomically: only decode if this row is still unused. This
  // update-then-check guards against a race where two decode requests
  // arrive for the same code at nearly the same time.
  const { data: consumed, error: consumeError } = await supabase
    .from("secrets")
    .update({ used: true })
    .eq("id", data.id)
    .eq("used", false)
    .select()
    .maybeSingle<SecretRow>();

  if (consumeError || !consumed) {
    const body: DecodeSecretResponse = { status: "expired" };
    return NextResponse.json(body, { status: 410 });
  }

  const message = decryptMessage({
    ciphertext: consumed.ciphertext,
    iv: consumed.iv,
    authTag: consumed.auth_tag,
  });

  // Permanently delete now that it has been read once.
  await supabase.from("secrets").delete().eq("id", consumed.id);

  const body: DecodeSecretResponse = { status: "ok", message };
  return NextResponse.json(body, { status: 200 });
}
