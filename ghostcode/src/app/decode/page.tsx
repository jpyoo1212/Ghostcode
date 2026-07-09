"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DecodeSecretResponse } from "@/lib/types";

type View =
  | { kind: "idle" }
  | { kind: "revealed"; message: string }
  | { kind: "expired" };

export default function DecodePage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "idle" });

  async function handleDecode() {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/secrets/${encodeURIComponent(code.trim())}`, {
        method: "POST",
      });
      const data = (await res.json()) as DecodeSecretResponse;

      if (data.status === "ok") {
        setView({ kind: "revealed", message: data.message });
      } else {
        setView({ kind: "expired" });
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setCode("");
    setView({ kind: "idle" });
    setError(null);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 py-10 sm:py-16">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/" className="text-sm text-ink-500 hover:text-ink-100">
          Cancel
        </Link>
      </div>

      <div className="mt-12 flex-1">
        {view.kind === "idle" && (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink-100">
              Decode a secret code
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              Paste the code you were given. It can only be opened once, so
              make sure you&apos;re ready to read it.
            </p>

            <Card className="mt-6">
              <label htmlFor="code" className="sr-only">
                Secret code
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="X7kP9LmQ2Az81VnR"
                autoFocus
                className="w-full rounded-2xl border border-void-600 bg-void-900/80 p-4 font-mono text-base tracking-wider text-ink-100 placeholder:text-ink-700 focus:border-signal-violet/60"
              />
              {error && <p className="mt-2 text-xs text-signal-red">{error}</p>}

              <Button
                onClick={handleDecode}
                disabled={!code.trim() || loading}
                size="lg"
                className="mt-4 w-full"
              >
                {loading ? "Decoding…" : "Decode"}
              </Button>
            </Card>
          </>
        )}

        {view.kind === "revealed" && (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink-100">
              Message revealed
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              This code has now been permanently deleted. This is the only
              time it will be shown.
            </p>

            <Card className="mt-6">
              <p className="whitespace-pre-wrap break-words text-lg leading-relaxed text-ink-100">
                {view.message}
              </p>
            </Card>

            <Link href="/" className="mt-6 block">
              <Button variant="secondary" className="w-full">
                Done
              </Button>
            </Link>
          </>
        )}

        {view.kind === "expired" && (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink-100">
              Gone for good
            </h1>
            <Card className="mt-6 border-signal-red/30">
              <p className="text-ink-100">
                This code has expired or has already been used.
              </p>
              <p className="mt-2 text-sm text-ink-500">
                Codes only work once, and disappear automatically after three
                minutes.
              </p>
            </Card>

            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={handleReset} className="flex-1">
                Try another code
              </Button>
              <Link href="/" className="flex-1">
                <Button variant="ghost" className="w-full">
                  Home
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
