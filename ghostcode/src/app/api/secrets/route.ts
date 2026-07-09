import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { encryptMessage } from "@/lib/crypto";
import { generateCode } from "@/lib/code-generator";
import { DEFAULT_TTL_SECONDS, MAX_MESSAGE_LENGTH } from "@/lib/constants";
import type { CreateSecretRequest, CreateSecretResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  let body: CreateSecretRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const { ciphertext, iv, authTag } = encryptMessage(message);

  const ttlSeconds = DEFAULT_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  // Generate a code and retry on the extremely unlikely event of a collision.
  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("secrets").insert({
      code,
      ciphertext,
      iv,
      auth_tag: authTag,
      expires_at: expiresAt,
    });

    if (!error) {
      const response: CreateSecretResponse = { code, expiresAt, ttlSeconds };
      return NextResponse.json(response, { status: 201 });
    }

    // 23505 = unique_violation in Postgres
    if (error.code === "23505") {
      code = generateCode();
      continue;
    }

    console.error("Failed to store secret:", error.message);
    return NextResponse.json({ error: "Failed to generate code." }, { status: 500 });
  }

  return NextResponse.json({ error: "Failed to generate a unique code." }, { status: 500 });
}
