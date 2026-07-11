"use client";

import { useEffect, useState } from "react";
import { CODE_ALPHABET } from "@/lib/constants";

/**
 * The app's signature moment: the freshly generated code materializes
 * character-by-character out of scrambled glyphs, underscoring that this
 * string is meaningless noise until it settles — echoing what the code
 * actually is (an opaque pointer, not the message itself).
 */
export function CodeReveal({ code }: { code: string }) {
  const [display, setDisplay] = useState(() => scramble(code.length));
  const [settledCount, setSettledCount] = useState(0);

  useEffect(() => {
    setSettledCount(0);
    let frame = 0;
    const totalFrames = code.length * 3;

    const interval = setInterval(() => {
      frame += 1;
      const settled = Math.min(code.length, Math.floor((frame / totalFrames) * code.length));
      setSettledCount(settled);

      setDisplay((prev) =>
        code
          .split("")
          .map((char, i) => (i < settled ? char : CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]))
          .join("")
      );

      if (settled >= code.length) clearInterval(interval);
    }, 35);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <div
      className="select-all break-all rounded-2xl border border-void-600 bg-void-900/80 px-5 py-4 font-mono text-lg tracking-wider text-ink-100 sm:text-xl"
      aria-label="Generated secret code"
    >
      {display.split("").map((char, i) => (
        <span key={i} className={i < settledCount ? "text-gradient" : "text-ink-700"}>
          {char}
        </span>
      ))}
    </div>
  );
}

function scramble(length: number): string {
  return Array.from({ length }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
}
