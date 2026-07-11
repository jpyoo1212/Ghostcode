import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 py-10 sm:py-16">
      <Logo />

      <div className="mt-16 flex-1 sm:mt-24">
        <h1 className="animate-fade-up font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink-100 sm:text-5xl">
          Say it once,
          <br />
          then it&apos;s <span className="text-gradient">gone.</span>
        </h1>
        <p
          className="mt-5 animate-fade-up text-balance text-base leading-relaxed text-ink-500"
          style={{ animationDelay: "80ms" }}
        >
          Turn a message into a one-time code. Whoever holds the code can read
          it exactly once — after that, or after three minutes, it&apos;s
          deleted for good. No accounts. No history.
        </p>

        <div
          className="mt-10 grid animate-fade-up gap-4"
          style={{ animationDelay: "160ms" }}
        >
          <Link href="/create">
            <Card className="group cursor-pointer transition-colors hover:border-signal-violet/50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-semibold text-ink-100">
                    Create a secret code
                  </p>
                  <p className="mt-1 text-sm text-ink-500">
                    Write a message, get a code to share.
                  </p>
                </div>
                <Arrow />
              </div>
            </Card>
          </Link>

          <Link href="/decode">
            <Card className="group cursor-pointer transition-colors hover:border-signal-violet/50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-display text-lg font-semibold text-ink-100">
                    Decode a secret code
                  </p>
                  <p className="mt-1 text-sm text-ink-500">
                    Paste a code, reveal the message once.
                  </p>
                </div>
                <Arrow />
              </div>
            </Card>
          </Link>

          <Link href="/room">
            <Card className="group cursor-pointer transition-colors hover:border-signal-violet/50">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-lg font-semibold text-ink-100">
                      Create a private room
                    </p>
                    <span className="rounded-full bg-signal-gradient-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-signal-violet">
                      New
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">
                    Live, end-to-end encrypted chat for two.
                  </p>
                </div>
                <Arrow />
              </div>
            </Card>
          </Link>
        </div>
      </div>

      <footer className="mt-16 flex items-center justify-between text-xs text-ink-700">
        <span>No login. No storage of anything you don&apos;t send.</span>
        <span className="font-mono">v0.1</span>
      </footer>
    </main>
  );
}

function Arrow() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-void-600 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:border-signal-violet/50 group-hover:text-ink-100">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
