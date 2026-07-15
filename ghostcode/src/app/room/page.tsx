"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  getRoomHistory,
  getRoomSession,
  normalizeRoomCode,
  removeRoomSession,
  saveRoomSession,
  type RoomHistoryEntry,
} from "@/lib/rooms/client-storage";
import { resolveJoinInput } from "@/lib/rooms/join-code";
import type { CreateRoomResponse, JoinRoomResponse } from "@/lib/rooms/types";

type Tab = "create" | "join";

function RoomLandingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const joinParam = searchParams.get("j") ?? "";

  const [tab, setTab] = useState<Tab>(joinParam ? "join" : "create");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoJoining, setAutoJoining] = useState(Boolean(joinParam));

  const [joinInput, setJoinInput] = useState(joinParam);
  const [recentRooms, setRecentRooms] = useState<RoomHistoryEntry[]>([]);
  const autoJoinAttempted = useRef(false);

  useEffect(() => {
    setRecentRooms(getRoomHistory());
  }, []);

  async function resumeSavedRoom(code: string) {
    const normalizedCode = normalizeRoomCode(code);
    const saved = getRoomSession(normalizedCode);
    if (!saved) return false;

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(normalizedCode)}/session`, {
        headers: { "x-room-token": saved.token },
      });

      if (!res.ok) {
        removeRoomSession(normalizedCode);
        setRecentRooms(getRoomHistory());
        return false;
      }

      saveRoomSession(normalizedCode, saved);
      router.push(`/room/${normalizedCode}`);
      return true;
    } catch {
      setError("Couldn't check your saved room. Check your connection and try again.");
      return true;
    }
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const data = (await res.json()) as CreateRoomResponse | { error: string };

      if (!res.ok || !("roomCode" in data)) {
        setError("error" in data ? data.error : "Couldn't create a room. Try again.");
        return;
      }

      saveRoomSession(data.roomCode, {
        token: data.token,
        role: data.role,
        secretKey: data.secretKey,
      });
      router.push(`/room/${data.roomCode}`);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(rawInput?: string) {
    const input = (rawInput ?? joinInput).trim();
    if (!input || joining) return;

    const resolved = resolveJoinInput(input);
    if (!resolved) {
      setError("That doesn't look like a valid invite link or join code.");
      return;
    }
    const { roomCode: code, secretKey: key } = resolved;

    setJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(code)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secretKey: key }),
      });
      const data = (await res.json()) as JoinRoomResponse | { error?: string };

      if (!("status" in data)) {
        setError(data.error ?? "Couldn't join this room. Try again.");
        return;
      }

      switch (data.status) {
        case "ok":
          saveRoomSession(code, { token: data.token, role: data.role, secretKey: key });
          router.push(`/room/${code}`);
          return;
        case "room_full": {
          // We might already be this room's joiner from an earlier visit
          // (e.g. reopening after clearing a tab). If we have a saved
          // session for this exact room, resume it instead of hard-failing.
          const resumed = await resumeSavedRoom(code);
          if (!resumed) setError("This room is full.");
          return;
        }
        case "invalid_key":
          setError("Incorrect Secret Room Key.");
          return;
        case "not_found":
          setError("No room found with that invite.");
          return;
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setJoining(false);
    }
  }

  // Arrived via a tapped invite link (?j=...) — join automatically instead
  // of making them paste the code back in manually.
  useEffect(() => {
    if (!joinParam || autoJoinAttempted.current) return;
    autoJoinAttempted.current = true;
    (async () => {
      await handleJoin(joinParam);
      setAutoJoining(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinParam]);

  if (autoJoining) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-6 h-14 w-14">
          <div className="absolute inset-0 animate-ping rounded-full bg-signal-violet/30" />
          <div className="relative grid h-14 w-14 place-items-center rounded-full bg-signal-gradient text-xl shadow-glow">
            🔒
          </div>
        </div>
        <p className="text-sm text-ink-500">Joining your friend&apos;s room…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 py-10 sm:py-16">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/" className="text-sm text-ink-500 hover:text-ink-100">
          Cancel
        </Link>
      </div>

      <div className="mt-12 flex-1">
        <h1 className="font-display text-2xl font-semibold text-ink-100">Private Room</h1>
        <p className="mt-2 text-sm text-ink-500">
          A live, end-to-end encrypted chat for exactly two people. Nothing is
          readable by the server — not even by us.
        </p>

        <div className="mt-6 flex gap-2 rounded-2xl border border-void-600 bg-void-800/60 p-1">
          <button
            onClick={() => setTab("create")}
            className={cn(
              "flex-1 rounded-xl py-2 text-sm font-medium transition-colors",
              tab === "create" ? "bg-signal-gradient text-white" : "text-ink-500 hover:text-ink-100"
            )}
          >
            Create a Room
          </button>
          <button
            onClick={() => setTab("join")}
            className={cn(
              "flex-1 rounded-xl py-2 text-sm font-medium transition-colors",
              tab === "join" ? "bg-signal-gradient text-white" : "text-ink-500 hover:text-ink-100"
            )}
          >
            Join a Room
          </button>
        </div>

        {recentRooms.length > 0 && (
          <Card className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-display text-base font-semibold text-ink-100">Recent Rooms</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  Reopen your last private room on this device.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {recentRooms.map((room) => (
                <button
                  key={room.roomCode}
                  onClick={() => {
                    setError(null);
                    void resumeSavedRoom(room.roomCode);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-void-600 bg-void-900/60 px-4 py-3 text-left transition-colors hover:border-signal-violet/50"
                >
                  <span>
                    <span className="block font-mono text-sm tracking-wider text-ink-100">
                      {room.roomCode}
                    </span>
                    <span className="text-xs capitalize text-ink-700">{room.role}</span>
                  </span>
                  <span className="text-xs font-medium text-signal-violet">Resume</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {tab === "create" ? (
          <Card className="mt-6">
            <p className="text-sm text-ink-500">
              We&apos;ll generate an invite link and a join code. Share
              either one with your friend — both get them in.
            </p>
            {error && <p className="mt-3 text-xs text-signal-red">{error}</p>}
            <Button onClick={handleCreate} disabled={creating} size="lg" className="mt-4 w-full">
              {creating ? "Creating room…" : "Create Room"}
            </Button>
          </Card>
        ) : (
          <Card className="mt-6 space-y-4">
            <div>
              <label htmlFor="joinInput" className="mb-1.5 block text-xs uppercase tracking-wide text-ink-700">
                Invite link or join code
              </label>
              <textarea
                id="joinInput"
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                placeholder="Paste what your friend sent you"
                rows={3}
                autoFocus
                className="w-full resize-none rounded-2xl border border-void-600 bg-void-900/80 p-4 font-mono text-sm text-ink-100 placeholder:text-ink-700 focus:border-signal-violet/60"
              />
            </div>
            {error && <p className="text-xs text-signal-red">{error}</p>}
            <Button
              onClick={() => handleJoin()}
              disabled={!joinInput.trim() || joining}
              size="lg"
              className="w-full"
            >
              {joining ? "Joining…" : "Join Room"}
            </Button>
          </Card>
        )}
      </div>
    </main>
  );
}

export default function RoomLandingPage() {
  return (
    <Suspense fallback={null}>
      <RoomLandingInner />
    </Suspense>
  );
}
