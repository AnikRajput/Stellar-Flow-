import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef4ff",
          100: "#d8e4ff",
          200: "#b4c8ff",
          300: "#86a5ff",
          400: "#5b7bf5",
          500: "#3e59db",
          600: "#3044b3",
          700: "#27358d",
          800: "#1d2764",
          900: "#11183c"
        },
        ink: {
          50: "#f4f7fb",
          100: "#e8eef7",
          200: "#c8d4e6",
          300: "#9caec9",
          400: "#6f84a6",
          500: "#506684",
          600: "#3d4f69",
          700: "#2e3b4f",
          800: "#1d2635",
          900: "#0d1320"
        },
        accent: {
          50: "#fff7eb",
          100: "#ffeed0",
          200: "#ffd89a",
          300: "#ffbd5c",
          400: "#f89b24",
          500: "#e47f0e",
          600: "#c36309",
          700: "#9c490b",
          800: "#7e3910",
          900: "#672f11"
        }
      },
      boxShadow: {
        glow: "0 20px 60px -30px rgba(62, 89, 219, 0.45)"
      },
      backgroundImage: {
        "hero-grid": "radial-gradient(circle at top, rgba(255, 189, 92, 0.16), transparent 32%), linear-gradient(135deg, rgba(17, 24, 60, 0.95), rgba(13, 19, 32, 1))"
      }
    }
  },
  plugins: []
};

export default config;
