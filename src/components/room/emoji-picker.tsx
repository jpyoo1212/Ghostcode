"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const EMOJIS = [
  "😀", "😂", "😍", "😘", "😉", "😎", "🤔", "😅",
  "😭", "😡", "🥳", "😴", "👍", "👎", "👏", "🙏",
  "❤️", "🔥", "🎉", "✨", "💀", "😬", "🤝", "👋",
];

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Insert emoji"
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg transition-colors",
          open ? "bg-void-700 text-ink-100" : "text-ink-500 hover:bg-void-800 hover:text-ink-100"
        )}
      >
        🙂
      </button>

      {open && (
        <div className="absolute bottom-12 right-0 z-20 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-void-600 bg-void-800 p-3 shadow-card animate-fade-up">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="grid h-7 w-7 place-items-center rounded-lg text-lg hover:bg-void-700"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
