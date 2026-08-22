import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy/charcoal backgrounds
        surface: {
          0: "#0a0e1a",
          1: "#0f1424",
          2: "#141a2e",
          3: "#1a2038",
          4: "#212842",
          5: "#28304c",
        },
        // Primary accent — Stellar-inspired purple/blue gradient
        accent: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          // Gradient endpoints
          gradient: {
            from: "#6366f1",
            via: "#8b5cf6",
            to: "#3b82f6",
          },
        },
        // Semantic success
        success: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        // Semantic warning
        warning: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
        },
        // Semantic error
        error: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
        },
        // Text colors
        text: {
          primary: "#f1f5f9",
          secondary: "#94a3b8",
          tertiary: "#64748b",
          muted: "#475569",
        },
        // Border colors
        border: {
          subtle: "rgba(255, 255, 255, 0.06)",
          default: "rgba(255, 255, 255, 0.1)",
          strong: "rgba(255, 255, 255, 0.15)",
          accent: "rgba(99, 102, 241, 0.3)",
        },
      },
      boxShadow: {
        glow: "0 20px 60px -30px rgba(99, 102, 241, 0.4)",
        "glow-sm": "0 10px 30px -15px rgba(99, 102, 241, 0.3)",
        "glow-lg": "0 30px 80px -20px rgba(99, 102, 241, 0.5)",
        card: "0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)",
        "card-hover":
          "0 4px 12px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.2)",
      },
      backgroundImage: {
        "hero-gradient":
          "linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.04), transparent)",
        "card-gradient":
          "linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent)",
        "accent-gradient":
          "linear-gradient(135deg, #6366f1, #8b5cf6, #3b82f6)",
        "accent-gradient-subtle":
          "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.08))",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        shimmer: "shimmer 2s infinite linear",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
