export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 rounded-2xl bg-void-700 px-3 py-2">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" />
    </span>
  );
}
