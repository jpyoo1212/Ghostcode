# GhostCode

Turn a message into a one-time secret code. The recipient can open it exactly
once — after that, or after 3 minutes (whichever comes first), it's
permanently deleted. No accounts, no chat history, no message ever stored in
plaintext.

## Stack

- **Next.js 14** (App Router) + React + TypeScript
- **Tailwind CSS** for styling
- **Supabase** (Postgres) for storage, accessed only from server-side API
  routes via the service role key — never exposed to the browser
- AES-256-GCM encryption at rest (`src/lib/crypto.ts`) — even inside the
  database, messages are ciphertext, not plaintext

## How it works

1. **Create** (`/create` → `POST /api/secrets`): message is encrypted
   server-side, stored with a random 16-character code and a 3-minute
   `expires_at`, and only the code is ever returned to the browser.
2. **Decode** (`/decode` → `POST /api/secrets/[code]`): looks up the code,
   checks it's neither expired nor already used, atomically marks it used
   (guards against a race between two simultaneous decode attempts), decrypts
   it, deletes the row, and returns the message once. Any later attempt with
   the same code gets "This code has expired or has already been used."

Decoding is a `POST`, not a `GET`, on purpose: reading a secret is a
destructive, one-time action, and `GET` requests can be triggered
unintentionally (link previews, prefetching, crawlers).

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a free project at [supabase.com](https://supabase.com), then open the
SQL editor and run the contents of [`supabase/schema.sql`](./supabase/schema.sql).

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — from your
  Supabase project's **Settings → API**. The service role key is secret;
  it's only ever read on the server.
- `ENCRYPTION_KEY` — a 64-character hex string. Generate one with:

  ```bash
  openssl rand -hex 32
  ```

### 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`.

### 5. Deploy to Vercel

Push to a Git repo, import it into Vercel, and add the same three
environment variables in the Vercel project settings. No other config is
needed.

## Project structure

```
src/
  app/
    page.tsx                  Home
    create/page.tsx           Create Secret Code
    decode/page.tsx           Decode Secret Code
    api/secrets/route.ts      POST — create a secret
    api/secrets/[code]/route.ts  POST — decode + consume a secret
  components/                 Presentational + interactive UI pieces
  lib/
    crypto.ts                 AES-256-GCM encrypt/decrypt
    code-generator.ts         Random code generation
    constants.ts               Tunables (TTL, max length, code length)
    types.ts                   Shared request/response types
    supabase/server.ts         Server-only Supabase client
  hooks/use-countdown.ts      Countdown timer hook
supabase/schema.sql           Database schema + RLS + optional pg_cron cleanup
```

## Extending it

The code is deliberately modular so the features below can be added without
restructuring:

- **Custom expiry times** — `CreateSecretRequest.ttlSeconds` is already
  accepted by the type; wire it into `api/secrets/route.ts` and a UI control.
- **Password-protected codes** — `CreateSecretRequest.password` /
  `DecodeSecretRequest.password` are reserved fields; combine the password
  into the AES key derivation (e.g. via HKDF) instead of `ENCRYPTION_KEY`
  alone.
- **File / image / voice sharing** — store an encrypted blob in Supabase
  Storage instead of (or alongside) `ciphertext`, keyed by the same code.
- **QR code sharing** — generate a QR for `result.code` (or a decode URL) on
  the success screen in `create/page.tsx`.
- **AI translation** — a new `/api/translate` route called before encryption,
  or on decode for the recipient's locale.
- **Group secret messages** — add a `recipients` join table; each recipient
  gets their own one-time code pointing at the same encrypted payload.
- **PWA** — add a `manifest.json` and a service worker; the app already has
  no client-side storage dependency that would fight with offline caching.
- **End-to-end encryption** — currently encryption happens server-side with
  a server-held key (protects data at rest / from DB compromise, not from
  the server itself). For true E2E, encrypt in the browser with a key kept
  only in the URL fragment (e.g. `/decode#key=...`), which never reaches the
  server or logs.

## Notes on the 3-minute expiry

Expiry is enforced lazily (checked whenever a decode is attempted) and,
optionally, proactively via the commented-out `pg_cron` job in
`supabase/schema.sql`, which physically deletes expired rows once a minute
even if nobody ever tries to open them.
