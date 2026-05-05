import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  // Disable global base resets to avoid breaking the Sehati template
  corePlugins: {
    preflight: false,
  },
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        sh: {
          green: "#34C759",
          red: "#FF3B30",
          blue: "#007AFF",
          orange: "#FF9500",
          purple: "#5856D6",
          teal: "#30B0C7",
          bg: "var(--sh-bg)",
          card: "var(--sh-card-bg)",
          text: "var(--sh-text-main)",
          sub: "var(--sh-text-sub)",
          border: "var(--sh-border)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        google: {
          blue: "#1A73E8",
          red: "#EA4335",
          yellow: "#FBBC04",
          green: "#34A853",
          bg: "#FFFFFF",
          surface: "#F8F9FA",
          text: "#3C4043",
          subtext: "#70757A",
          border: "#DADCE0",
        },
        med: {
          blue: "#1967D2",
          light: "#E8F0FE",
        }
      },
      fontFamily: {
        google: ["'Google Sans'", "Roboto", "Arial", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        'sh': 'var(--sh-shadow)',
        'sh-hover': 'var(--sh-shadow-hover)',
        'google': '0 1px 2px 0 rgba(60,64,67,.30), 0 1px 3px 1px rgba(60,64,67,.15)',
        'clinical': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
};
export default config;
