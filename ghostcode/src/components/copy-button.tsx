"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copy code",
  copiedLabel = "Copied",
  variant = "secondary",
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button variant={variant} onClick={handleCopy} aria-live="polite" className={className}>
      {copied ? copiedLabel : label}
    </Button>
  );
}
