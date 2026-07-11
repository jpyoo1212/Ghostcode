import { createHash } from "crypto";

/** Server-side one-way hash used to verify a Secret Room Key without storing it. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
