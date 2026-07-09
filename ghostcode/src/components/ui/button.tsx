import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl font-medium tracking-tight transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
          size === "md" && "px-5 py-3 text-sm",
          size === "lg" && "px-7 py-4 text-base",
          variant === "primary" &&
            "bg-signal-gradient text-white shadow-glow hover:brightness-110 active:scale-[0.98]",
          variant === "secondary" &&
            "border border-void-600 bg-void-800 text-ink-100 hover:border-signal-violet/50 hover:bg-void-700 active:scale-[0.98]",
          variant === "ghost" &&
            "text-ink-300 hover:text-ink-100 hover:bg-void-800",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
