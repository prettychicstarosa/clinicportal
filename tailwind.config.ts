import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        beige: {
          50: "#FBF7F1",
          100: "#F6EFE4",
          200: "#EFE3D0",
          300: "#E4D2B6"
        },
        cream: {
          50: "#FFFBF4",
          100: "#FBF4E6",
          200: "#F4E9D2"
        },
        mocha: {
          50: "#F2EAE2",
          100: "#D9C7B6",
          200: "#B79A82",
          300: "#8E6A52",
          400: "#6B4A37",
          500: "#503626",
          600: "#3C281C",
          700: "#2B1C13"
        },
        rose: {
          accent: "#C18B7B"
        }
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Helvetica", "Arial"],
        serif: ["Cormorant Garamond", "Georgia", "serif"]
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(80,54,38,0.18)",
        card: "0 2px 12px -4px rgba(80,54,38,0.10)"
      },
      borderRadius: {
        xl2: "1.25rem"
      }
    }
  },
  plugins: []
};

export default config;
