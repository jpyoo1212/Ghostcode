"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
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
import type { CreateRoomResponse, JoinRoomResponse } from "@/lib/rooms/types";

type Tab = "create" | "join";

function RoomLandingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillCode = normalizeRoomCode(searchParams.get("join") ?? "");

  const [tab, setTab] = useState<Tab>(prefillCode ? "join" : "create");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roomCode, setRoomCode] = useState(prefillCode);
  const [secretKey, setSecretKey] = useState("");
  const [recentRooms, setRecentRooms] = useState<RoomHistoryEntry[]>([]);

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

  async function handleJoin() {
    const code = normalizeRoomCode(roomCode);
    const key = secretKey.trim();
    if (!code || !key || joining) return;

    setJoining(true);
    setError(null);

    try {
      const resumed = await resumeSavedRoom(code);
      if (resumed) return;

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
        case "room_full":
          setError("This room is full.");
          return;
        case "invalid_key":
          setError("Incorrect Secret Room Key.");
          return;
        case "not_found":
          setError("No room found with that Room ID.");
          return;
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setJoining(false);
    }
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
              We&apos;ll generate a Room ID and a Secret Room Key. Share both
              with your friend — they&apos;ll need both to join.
            </p>
            {error && <p className="mt-3 text-xs text-signal-red">{error}</p>}
            <Button onClick={handleCreate} disabled={creating} size="lg" className="mt-4 w-full">
              {creating ? "Creating room…" : "Create Room"}
            </Button>
          </Card>
        ) : (
          <Card className="mt-6 space-y-4">
            <div>
              <label htmlFor="roomCode" className="mb-1.5 block text-xs uppercase tracking-wide text-ink-700">
                Room ID
              </label>
              <input
                id="roomCode"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="X7K2P9QZ"
                autoFocus
                className="w-full rounded-2xl border border-void-600 bg-void-900/80 p-4 font-mono text-base tracking-wider text-ink-100 placeholder:text-ink-700 focus:border-signal-violet/60"
              />
            </div>
            <div>
              <label htmlFor="secretKey" className="mb-1.5 block text-xs uppercase tracking-wide text-ink-700">
                Secret Room Key
              </label>
              <input
                id="secretKey"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Enter the key your friend shared"
                className="w-full rounded-2xl border border-void-600 bg-void-900/80 p-4 font-mono text-sm text-ink-100 placeholder:text-ink-700 focus:border-signal-violet/60"
              />
            </div>
            {error && <p className="text-xs text-signal-red">{error}</p>}
            <Button
              onClick={handleJoin}
              disabled={!roomCode.trim() || !secretKey.trim() || joining}
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
