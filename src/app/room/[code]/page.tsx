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
import { ROOM_MESSAGE_RETENTION_LABEL, ROOM_MESSAGE_TTL_SECONDS } from "@/lib/rooms/constants";
import {
  getRoomSession,
  removeRoomSession,
  saveRoomSession,
  type StoredRoomSession,
} from "@/lib/rooms/client-storage";
import type { RoomRole, RoomMessageRecord } from "@/lib/rooms/types";
import { cn } from "@/lib/cn";

type Phase = "loading" | "invalid" | "waiting" | "connecting" | "connected" | "peer-offline";

function otherRole(role: RoomRole): RoomRole {
  return role === "creator" ? "joiner" : "creator";
}

export default function RoomChatPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const roomCode = (params.code ?? "").toUpperCase();

  const [session, setSession] = useState<StoredRoomSession | null>(null);
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

  // Pulls the encrypted backup from the server, decrypts it, and merges it
  // into whatever's already on screen (by id, keeping the richer local
  // status like "seen" if we have it). This is what makes reconnects
  // trustworthy: the live broadcast channel is fast but best-effort — if a
  // message arrives while a tab is backgrounded/suspended (common on
  // mobile) or during a brief drop, this backfills it instead of it just
  // being gone until a manual refresh.
  const refreshHistory = useCallback(async () => {
    if (!session || !cryptoKeyRef.current) return;

    try {
      const historyRes = await fetch(`/api/rooms/${roomCode}/messages`, {
        headers: { "x-room-token": session.token },
      });
      if (!historyRes.ok) return;

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
          // Skip messages that fail to decrypt (e.g. a corrupted row).
        }
      }

      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m] as const));
        for (const incoming of decrypted) {
          const existing = byId.get(incoming.id);
          byId.set(incoming.id, existing ? { ...incoming, status: existing.status } : incoming);
        }
        return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
      });
    } catch {
      // Best-effort background sync — a transient failure here shouldn't
      // interrupt the live chat, the next trigger will try again.
    }
  }, [session, roomCode]);

  const refreshHistoryRef = useRef(refreshHistory);
  useEffect(() => {
    refreshHistoryRef.current = refreshHistory;
  }, [refreshHistory]);

  // Re-sync whenever the tab becomes visible again — covers phones where
  // the browser suspends background tabs and may silently drop realtime
  // events while the person was in another app.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") refreshHistoryRef.current?.();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // ---- Load session (or bounce to join screen) ----
  // Phase is seeded here, synchronously, the moment we know the role — not
  // after any network call. This is the ONLY place that sets a "guess"
  // phase; from here on, the realtime presence effect is the sole owner of
  // phase transitions. That split used to be blurred (the history-loading
  // effect also set phase after its fetches resolved), which raced against
  // presence and could silently stomp a correct "connected" back to
  // "waiting" — the bug behind "shows waiting even though my friend is on,
  // only a refresh fixes it."
  useEffect(() => {
    if (!roomCode) return;
    const savedSession = getRoomSession(roomCode);
    if (!savedSession) {
      router.replace(`/room?join=${roomCode}`);
      return;
    }
    setSession(savedSession);
    setPhase(savedSession.role === "creator" ? "waiting" : "connecting");
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
          removeRoomSession(roomCode);
          router.replace(`/room?join=${roomCode}`);
        }
        return;
      }

      cryptoKeyRef.current = await deriveRoomKey(session.secretKey, roomCode);
      saveRoomSession(roomCode, session);

      if (!cancelled) await refreshHistoryRef.current?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [session, roomCode, router]);

  // ---- Realtime channel: presence (online/typing) + broadcast (messages/acks/destroy) ----
  useEffect(() => {
    if (!session || !roomCode) return;

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

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
            refreshHistoryRef.current?.();
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
        if (cancelled) return;

        if (status === "SUBSCRIBED") {
          retryCount = 0;
          await channel.track({ role: session.role, online: true });
          // Presence sync should fire on its own after tracking, but check
          // once immediately too — this is what makes reconnects feel
          // instant instead of depending on an event that might be a beat
          // late.
          updatePresence();
          return;
        }

        // CHANNEL_ERROR / TIMED_OUT / CLOSED can happen on flaky networks,
        // tab throttling, or a brief Supabase hiccup. Instead of leaving the
        // UI stuck (which is what used to force a manual refresh), retry
        // with a short backoff a few times.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (retryCount >= 5) return;
          retryCount += 1;
          retryTimeout = setTimeout(() => {
            if (!cancelled) channel.subscribe();
          }, Math.min(1000 * retryCount, 4000));
        }
      });

    // Safety net: re-derive phase from the locally cached presence state
    // every few seconds. This is a pure local read (no network call), so
    // it's essentially free — but it means even a missed or out-of-order
    // presence event self-corrects within a few seconds on its own,
    // instead of requiring the person to refresh the page.
    const presenceSafetyNet = setInterval(updatePresence, 3000);

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      clearInterval(presenceSafetyNet);
      channel.untrack();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, roomCode]);

  // ---- Keep the UI aligned with the server-side encrypted backup retention. ----
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
                No messages yet. Messages stay available for{" "}
                {ROOM_MESSAGE_RETENTION_LABEL} or until Destroy Chat.
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
