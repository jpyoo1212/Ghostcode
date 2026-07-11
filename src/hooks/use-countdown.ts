"use client";

import { useEffect, useState } from "react";

/**
 * Ticks down to a target ISO timestamp. Returns remaining seconds (clamped
 * at 0) and a formatted mm:ss string for display.
 */
export function useCountdown(targetIso: string) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, new Date(targetIso).getTime() - Date.now())
  );

  useEffect(() => {
    const target = new Date(targetIso).getTime();
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, target - Date.now()));
    }, 250);
    return () => clearInterval(interval);
  }, [targetIso]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return { remainingMs, totalSeconds, label, expired: remainingMs <= 0 };
}
