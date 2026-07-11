import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-void-600/60 bg-void-800/60 p-6 shadow-card backdrop-blur-sm sm:p-8",
        className
      )}
      {...props}
    />
  );
}
