"use client";

import { useCountdown } from "@/hooks/use-countdown";
import { cn } from "@/lib/cn";

export function CountdownTimer({
  expiresAt,
  totalSeconds,
}: {
  expiresAt: string;
  totalSeconds: number;
}) {
  const { label, expired, totalSeconds: remaining } = useCountdown(expiresAt);
  const urgent = remaining <= 30 && !expired;

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-void-700">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-linear",
            urgent ? "bg-signal-red" : "bg-signal-gradient"
          )}
          style={{ width: `${Math.max(0, (remaining / totalSeconds) * 100)}%` }}
        />
      </div>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          urgent ? "text-signal-red" : "text-ink-300"
        )}
      >
        {expired ? "0:00" : label}
      </span>
    </div>
  );
}
