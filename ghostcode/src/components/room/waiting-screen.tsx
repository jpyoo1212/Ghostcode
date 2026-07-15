"use client";

import { CopyButton } from "@/components/copy-button";
import { encodeJoinCode, buildInviteLink } from "@/lib/rooms/join-code";

export function WaitingScreen({
  roomCode,
  secretKey,
}: {
  roomCode: string;
  secretKey: string;
}) {
  const joinCode = encodeJoinCode(roomCode, secretKey);
  const inviteLink = buildInviteLink(roomCode, secretKey);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative mb-6 h-16 w-16">
        <div className="absolute inset-0 animate-ping rounded-full bg-signal-violet/30" />
        <div className="relative grid h-16 w-16 place-items-center rounded-full bg-signal-gradient text-2xl shadow-glow">
          🔒
        </div>
      </div>

      <h1 className="font-display text-xl font-semibold text-ink-100">
        Waiting for your friend…
      </h1>
      <p className="mt-2 max-w-xs text-sm text-ink-500">
        Send either one below — a tap on the link joins instantly, or they
        can paste the code. Nothing starts until they open it.
      </p>

      <div className="mt-8 w-full max-w-xs space-y-3">
        <div className="rounded-2xl border border-void-600 bg-void-900/80 p-4 text-left">
          <p className="text-xs uppercase tracking-wide text-ink-700">Invite link</p>
          <p className="mt-1 truncate font-mono text-sm text-ink-100">{inviteLink}</p>
        </div>
        <CopyButton value={inviteLink} label="Copy link" variant="primary" className="w-full" />

        <div className="rounded-2xl border border-void-600 bg-void-900/80 p-4 text-left">
          <p className="text-xs uppercase tracking-wide text-ink-700">Join code</p>
          <p className="mt-1 break-all font-mono text-sm text-gradient">{joinCode}</p>
        </div>
        <CopyButton value={joinCode} label="Copy code" variant="secondary" className="w-full" />
      </div>
    </div>
  );
}
