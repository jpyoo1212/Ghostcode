"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { CountdownTimer } from "@/components/countdown-timer";
import { CodeReveal } from "@/components/code-reveal";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
import type { CreateSecretResponse } from "@/lib/types";

type Result = CreateSecretResponse | null;

export default function CreatePage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  const remaining = MAX_MESSAGE_LENGTH - message.length;

  async function handleGenerate() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      // The original message never lingers in state once we have a code.
      setMessage("");
      setResult(data as CreateSecretResponse);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
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
        {!result ? (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink-100">
              Create a secret code
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              Your message is encrypted and replaced by a code. Once
              generated, the message itself can&apos;t be viewed again — only
              decoded once, by whoever has the code.
            </p>

            <Card className="mt-6">
              <label htmlFor="message" className="sr-only">
                Your message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder="What are you doing?"
                rows={6}
                autoFocus
                className="w-full resize-none rounded-2xl border border-void-600 bg-void-900/80 p-4 text-base text-ink-100 placeholder:text-ink-700 focus:border-signal-violet/60"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-ink-700">
                <span>{error ? <span className="text-signal-red">{error}</span> : "Never shown again after this."}</span>
                <span className={remaining < 30 ? "text-signal-red" : ""}>{remaining} left</span>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!message.trim() || loading}
                size="lg"
                className="mt-4 w-full"
              >
                {loading ? "Generating…" : "Generate code"}
              </Button>
            </Card>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-semibold text-ink-100">
              Your code is ready
            </h1>
            <p className="mt-2 text-sm text-ink-500">
              Share it however you like. It works exactly once.
            </p>

            <Card className="mt-6 space-y-5">
              <CodeReveal code={result.code} />
              <CopyButton value={result.code} />
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-ink-700">
                  Expires in
                </p>
                <CountdownTimer expiresAt={result.expiresAt} totalSeconds={result.ttlSeconds} />
              </div>
            </Card>

            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={handleReset} className="flex-1">
                Create another
              </Button>
              <Link href="/" className="flex-1">
                <Button variant="ghost" className="w-full">
                  Done
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
