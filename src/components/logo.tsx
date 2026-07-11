import { cn } from "@/lib/cn";

interface LogoProps {
  className?: string;
  withWordmark?: boolean;
}

/**
 * The ghost mark is a simple rounded silhouette built from CSS shapes so it
 * stays crisp at any size with no image asset. The subtle flicker animation
 * is the app's one signature motion cue, echoed later by the code-reveal
 * animation, and is skipped entirely for users who prefer reduced motion.
 */
export function Logo({ className, withWordmark = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <div className="relative h-8 w-8 shrink-0 animate-flicker">
        <div className="absolute inset-0 rounded-t-full rounded-b-md bg-signal-gradient" />
        <div className="absolute inset-x-[22%] bottom-0 flex h-[16%] justify-between">
          <span className="h-full w-[18%] rounded-full bg-void-900" />
          <span className="h-full w-[18%] rounded-full bg-void-900" />
          <span className="h-full w-[18%] rounded-full bg-void-900" />
        </div>
        <div className="absolute left-[30%] top-[38%] h-[12%] w-[12%] rounded-full bg-void-900" />
        <div className="absolute right-[30%] top-[38%] h-[12%] w-[12%] rounded-full bg-void-900" />
      </div>
      {withWordmark && (
        <span className="font-display text-lg font-semibold tracking-tight text-ink-100">
          Ghost<span className="text-gradient">Code</span>
        </span>
      )}
    </div>
  );
}
