import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: {
          950: "#06070D",
          900: "#0B0E1A",
          800: "#12162A",
          700: "#1B2038",
          600: "#262C48",
        },
        ink: {
          100: "#E9EBF6",
          300: "#B7BCD6",
          500: "#8B90A8",
          700: "#5C6180",
        },
        signal: {
          blue: "#4F7CFF",
          violet: "#8B5CF6",
          magenta: "#C155F0",
          mint: "#3DDC97",
          red: "#FB5B6E",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "signal-gradient": "linear-gradient(135deg, #4F7CFF 0%, #8B5CF6 55%, #C155F0 100%)",
        "signal-gradient-soft": "linear-gradient(135deg, rgba(79,124,255,0.16) 0%, rgba(139,92,246,0.16) 55%, rgba(193,85,240,0.16) 100%)",
        "void-radial": "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.25), transparent)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(139,92,246,0.15), 0 8px 40px -8px rgba(79,124,255,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%": { opacity: "1" },
          "93%": { opacity: "0.4" },
          "94%": { opacity: "1" },
          "96%": { opacity: "0.6" },
          "97%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-slow": "pulse-slow 3.5s ease-in-out infinite",
        flicker: "flicker 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
