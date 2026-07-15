"use client";

import { cn } from "@/lib/cn";

export type MessageStatus = "sending" | "sent" | "delivered" | "seen";

export interface ChatMessage {
  id: string;
  text: string;
  mine: boolean;
  createdAt: number;
  status: MessageStatus;
  replyTo?: { id: string; text: string; mine: boolean };
}

function StatusTicks({ status }: { status: MessageStatus }) {
  if (status === "sending") {
    return <span className="text-[11px] text-ink-700">sending…</span>;
  }
  const seen = status === "seen";
  const delivered = status === "delivered" || seen;

  return (
    <span
      className={cn(
        "inline-flex text-[13px] leading-none",
        seen ? "text-signal-blue" : "text-ink-700"
      )}
      aria-label={seen ? "Seen" : delivered ? "Delivered" : "Sent"}
    >
      {delivered ? "✓✓" : "✓"}
    </span>
  );
}

function truncate(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function MessageBubble({
  message,
  onReply,
}: {
  message: ChatMessage;
  onReply?: (message: ChatMessage) => void;
}) {
  return (
    <div
      className={cn(
        "flex animate-fade-up",
        message.mine ? "justify-end" : "justify-start"
      )}
    >
      <button
        type="button"
        onClick={() => onReply?.(message)}
        aria-label="Reply to this message"
        className={cn(
          "max-w-[78%] rounded-3xl px-4 py-2.5 text-left text-[15px] leading-relaxed shadow-sm transition-transform active:scale-[0.98]",
          message.mine
            ? "rounded-br-md bg-signal-gradient text-white"
            : "rounded-bl-md border border-void-600 bg-void-800 text-ink-100"
        )}
      >
        {message.replyTo && (
          <div
            className={cn(
              "mb-1.5 rounded-xl border-l-2 px-2.5 py-1.5 text-[13px]",
              message.mine
                ? "border-white/50 bg-black/15 text-white/80"
                : message.replyTo.mine
                ? "border-signal-violet/60 bg-signal-violet/10 text-ink-300"
                : "border-void-600 bg-void-900/50 text-ink-500"
            )}
          >
            {truncate(message.replyTo.text, 70)}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1.5",
            message.mine ? "justify-end" : "justify-start"
          )}
        >
          <span className={cn("text-[11px]", message.mine ? "text-white/70" : "text-ink-700")}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {message.mine && <StatusTicks status={message.status} />}
        </div>
      </button>
    </div>
  );
}
