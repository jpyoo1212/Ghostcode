export interface CreateSecretRequest {
  message: string;
  /**
   * Reserved for the "custom expiry" future feature. Ignored by the MVP
   * API, which always uses DEFAULT_TTL_SECONDS, but accepted here so the
   * client contract doesn't need to change later.
   */
  ttlSeconds?: number;
  /** Reserved for the "password-protected codes" future feature. */
  password?: string;
}

export interface CreateSecretResponse {
  code: string;
  expiresAt: string; // ISO timestamp
  ttlSeconds: number;
}

export interface DecodeSecretRequest {
  code: string;
  /** Reserved for the "password-protected codes" future feature. */
  password?: string;
}

export type DecodeSecretResponse =
  | { status: "ok"; message: string }
  | { status: "expired" }
  | { status: "not_found" };

export interface SecretRow {
  id: string;
  code: string;
  ciphertext: string;
  iv: string;
  auth_tag: string;
  created_at: string;
  expires_at: string;
  used: boolean;
}
