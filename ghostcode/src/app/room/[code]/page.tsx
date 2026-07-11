"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { EmojiPicker } from "@/components/room/emoji-picker";
import { TypingDots } from "@/components/room/typing-dots";
import { WaitingScreen } from "@/components/room/waiting-screen";
import { MessageBubble, type ChatMessage, type MessageStatus } from "@/components/room/message-bubble";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { deriveRoomKey, encryptText, decryptText } from "@/lib/crypto/room-crypto";
import { ROOM_MESSAGE_TTL_SECONDS } from "@/lib/rooms/constants";
import type { RoomRole, RoomMessageRecord } from "@/lib/rooms/types";
import { cn } from "@/lib/cn";

interface RoomSession {
  token: string;
  role: RoomRole;
  secretKey: string;
}

type Phase = "loading" | "invalid" | "waiting" | "connecting" | "connected" | "peer-offline";

function sessionKey(roomCode: string) {
  return `ghostcode-room:${roomCode.toUpperCase()}`;
}

function otherRole(role: RoomRole): RoomRole {
  return role === "creator" ? "joiner" : "creator";
}

export default function RoomChatPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const roomCode = (params.code ?? "").toUpperCase();

  const [session, setSession] = useState<RoomSession | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [justConnected, setJustConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [confirmingDestroy, setConfirmingDestroy] = useState(false);
  const [destroyedNotice, setDestroyedNotice] = useState(false);

  const cryptoKeyRef = useRef<CryptoKey | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const everConnectedRef = useRef(false);

  // ---- Load session (or bounce to join screen) ----
  useEffect(() => {
    if (!roomCode) return;
    try {
      const raw = sessionStorage.getItem(sessionKey(roomCode));
      if (!raw) {
        router.replace(`/room?join=${roomCode}`);
        return;
      }
      setSession(JSON.parse(raw) as RoomSession);
    } catch {
      router.replace(`/room?join=${roomCode}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  // ---- Validate session server-side + derive encryption key + load backup history ----
  useEffect(() => {
    if (!session || !roomCode) return;
    let cancelled = false;

    (async () => {
      const res = await fetch(`/api/rooms/${roomCode}/session`, {
        headers: { "x-room-token": session.token },
      });

      if (!res.ok) {
        if (!cancelled) {
          sessionStorage.removeItem(sessionKey(roomCode));
          router.replace(`/room?join=${roomCode}`);
        }
        return;
      }

      cryptoKeyRef.current = await deriveRoomKey(session.secretKey, roomCode);

      const historyRes = await fetch(`/api/rooms/${roomCode}/messages`, {
        headers: { "x-room-token": session.token },
      });

      if (historyRes.ok && !cancelled) {
        const { messages: records } = (await historyRes.json()) as { messages: RoomMessageRecord[] };
        const decrypted: ChatMessage[] = [];
        for (const record of records) {
          try {
            const text = await decryptText(record.ciphertext, record.iv, cryptoKeyRef.current);
            decrypted.push({
              id: record.id,
              text,
              mine: record.senderRole === session.role,
              createdAt: new Date(record.createdAt).getTime(),
              status: "delivered",
            });
          } catch {
            // Skip messages that fail to decrypt (e.g. corrupted row).
          }
        }
        setMessages(decrypted);
      }

      if (!cancelled) setPhase(session.role === "creator" ? "waiting" : "connecting");
    })();

    return () => {
      cancelled = true;
    };
  }, [session, roomCode, router]);

  // ---- Realtime channel: presence (online/typing) + broadcast (messages/acks/destroy) ----
  useEffect(() => {
    if (!session || !roomCode) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase.channel(`room:${roomCode}`, {
      config: { presence: { key: session.role } },
    });
    channelRef.current = channel;

    function updatePresence() {
      const state = channel.presenceState();
      const peerPresent = Object.prototype.hasOwnProperty.call(state, otherRole(session!.role));

      setPhase((prev) => {
        if (peerPresent) {
          if (prev !== "connected") {
            setJustConnected(true);
            setTimeout(() => setJustConnected(false), 2200);
          }
          everConnectedRef.current = true;
          return "connected";
        }
        return everConnectedRef.current
          ? "peer-offline"
          : session!.role === "creator"
          ? "waiting"
          : "connecting";
      });
    }

    channel
      .on("presence", { event: "sync" }, updatePresence)
      .on("presence", { event: "join" }, updatePresence)
      .on("presence", { event: "leave" }, updatePresence)
      .on("broadcast", { event: "message" }, async ({ payload }) => {
        if (!cryptoKeyRef.current) return;
        try {
          const text = await decryptText(payload.ciphertext, payload.iv, cryptoKeyRef.current);
          setMessages((prev) => [
            ...prev,
            { id: payload.id, text, mine: false, createdAt: Date.now(), status: "delivered" },
          ]);
          channel.send({
            type: "broadcast",
            event: "delivered",
            payload: { id: payload.id, role: session!.role },
          });
          if (document.visibilityState === "visible") {
            channel.send({ type: "broadcast", event: "seen", payload: { id: payload.id, role: session!.role } });
          }
        } catch {
          // Ignore messages we can't decrypt.
        }
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.role !== session!.role) setPeerTyping(Boolean(payload.isTyping));
      })
      .on("broadcast", { event: "delivered" }, ({ payload }) => {
        if (payload.role === session!.role) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === payload.id && m.status !== "seen" ? { ...m, status: "delivered" as MessageStatus } : m))
        );
      })
      .on("broadcast", { event: "seen" }, ({ payload }) => {
        if (payload.role === session!.role) return;
        setMessages((prev) => prev.map((m) => (m.id === payload.id ? { ...m, status: "seen" as MessageStatus } : m)));
      })
      .on("broadcast", { event: "destroy" }, () => {
        setMessages([]);
        setDestroyedNotice(true);
        setTimeout(() => setDestroyedNotice(false), 3000);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ role: session.role, online: true });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, roomCode]);

  // ---- Self-destruct sweep: drop messages older than the TTL, client-side ----
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - ROOM_MESSAGE_TTL_SECONDS * 1000;
      setMessages((prev) => prev.filter((m) => m.createdAt > cutoff));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ---- Autoscroll ----
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, peerTyping]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!session) return;
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { role: session.role, isTyping },
      });
    },
    [session]
  );

  function handleDraftChange(value: string) {
    setDraft(value);
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 1500);
  }

  async function handleSend() {
    const text = draft.trim();
    if (!text || !session || !cryptoKeyRef.current) return;

    setDraft("");
    sendTyping(false);

    const { ciphertext, iv } = await encryptText(text, cryptoKeyRef.current);
    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, text, mine: true, createdAt: Date.now(), status: "sending" },
    ]);

    try {
      const res = await fetch(`/api/rooms/${roomCode}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-room-token": session.token },
        body: JSON.stringify({ ciphertext, iv }),
      });
      const data = await res.json();
      const realId: string = res.ok ? data.message.id : tempId;

      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: realId, status: "sent" as MessageStatus } : m))
      );

      channelRef.current?.send({
        type: "broadcast",
        event: "message",
        payload: { id: realId, ciphertext, iv, role: session.role },
      });
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, status: "sent" as MessageStatus } : m)));
    }
  }

  async function handleDestroy() {
    if (!session) return;
    setConfirmingDestroy(false);
    try {
      await fetch(`/api/rooms/${roomCode}/messages`, {
        method: "DELETE",
        headers: { "x-room-token": session.token },
      });
    } finally {
      setMessages([]);
      channelRef.current?.send({ type: "broadcast", event: "destroy", payload: {} });
    }
  }

  const isPaused = phase === "peer-offline";

  const headerStatus = useMemo(() => {
    if (phase === "connected") return { label: "Online", dot: "bg-signal-mint" };
    if (phase === "peer-offline") return { label: "Offline", dot: "bg-signal-red" };
    return { label: "Connecting…", dot: "bg-ink-700" };
  }, [phase]);

  if (!session || phase === "loading") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-6">
        <p className="text-sm text-ink-500">Connecting to room…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 py-6 sm:py-10">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <button
          onClick={() => setConfirmingDestroy(true)}
          className="flex items-center gap-1.5 rounded-full border border-void-600 px-3 py-1.5 text-xs text-ink-500 hover:border-signal-red/50 hover:text-signal-red"
        >
          🗑 Destroy Chat
        </button>
      </div>

      {phase === "waiting" && session.role === "creator" ? (
        <WaitingScreen roomCode={roomCode} secretKey={session.secretKey} />
      ) : phase === "connecting" ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-ink-500">Connecting to your friend…</p>
        </div>
      ) : (
        <div className="mt-6 flex flex-1 flex-col">
          <div className="flex items-center justify-between rounded-2xl border border-void-600 bg-void-800/60 px-4 py-2.5">
            <div>
              <p className="font-display text-sm font-semibold text-ink-100">Private Room</p>
              <p className="font-mono text-xs text-ink-700">{roomCode}</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-ink-500">
              <span className={cn("h-2 w-2 rounded-full", headerStatus.dot)} />
              {headerStatus.label}
            </span>
          </div>

          {justConnected && (
            <div className="mt-3 animate-fade-up rounded-2xl border border-signal-mint/30 bg-signal-mint/10 px-4 py-2 text-center text-sm text-signal-mint">
              ✅ Secure Connection Established
            </div>
          )}

          {isPaused && (
            <div className="mt-3 animate-fade-up rounded-2xl border border-signal-red/30 bg-signal-red/10 px-4 py-2 text-center text-sm text-signal-red">
              Your friend went offline. Chat is paused until they reconnect.
            </div>
          )}

          {destroyedNotice && (
            <div className="mt-3 animate-fade-up rounded-2xl border border-void-600 bg-void-800 px-4 py-2 text-center text-sm text-ink-300">
              This chat was destroyed.
            </div>
          )}

          <div ref={scrollRef} className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1 no-scrollbar" style={{ maxHeight: "58vh" }}>
            {messages.length === 0 && (
              <p className="mt-10 text-center text-sm text-ink-700">
                No messages yet — say hello. Messages self-destruct after 3 minutes.
              </p>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {peerTyping && (
              <div className="flex justify-start">
                <TypingDots />
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-void-600 bg-void-800/60 p-2">
            <EmojiPicker onSelect={(emoji) => handleDraftChange(draft + emoji)} />
            <input
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isPaused}
              placeholder={isPaused ? "Waiting for your friend to reconnect…" : "Type a message"}
              className="flex-1 bg-transparent px-2 py-2 text-sm text-ink-100 placeholder:text-ink-700 focus:outline-none disabled:opacity-50"
            />
            <Button onClick={handleSend} disabled={!draft.trim() || isPaused} className="shrink-0">
              Send
            </Button>
          </div>
        </div>
      )}

      {confirmingDestroy && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-void-950/70 p-6 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-void-600 bg-void-800 p-6 shadow-card animate-fade-up">
            <p className="font-display text-lg font-semibold text-ink-100">Destroy this chat?</p>
            <p className="mt-2 text-sm text-ink-500">
              This permanently deletes all encrypted messages for both of you.
              This can&apos;t be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmingDestroy(false)}>
                Cancel
              </Button>
              <Button className="flex-1 !bg-signal-red !bg-none" onClick={handleDestroy}>
                Destroy
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
