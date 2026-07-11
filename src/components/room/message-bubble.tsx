"use client";

import { cn } from "@/lib/cn";

export type MessageStatus = "sending" | "sent" | "delivered" | "seen";

export interface ChatMessage {
  id: string;
  text: string;
  mine: boolean;
  createdAt: number;
  status: MessageStatus;
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

export function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <div
      className={cn(
        "flex animate-fade-up",
        message.mine ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm",
          message.mine
            ? "rounded-br-md bg-signal-gradient text-white"
            : "rounded-bl-md border border-void-600 bg-void-800 text-ink-100"
        )}
      >
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
      </div>
    </div>
  );
}
