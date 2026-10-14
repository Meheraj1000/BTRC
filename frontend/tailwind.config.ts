import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "var(--ink-950)",
          900: "var(--brand-secondary)",
          800: "var(--brand-secondary-hover)",
          700: "var(--ink-700)",
        },
        brand: {
          400: "var(--brand-accent)",
          500: "var(--brand-primary-hover)",
          600: "var(--brand-primary)",
          700: "var(--brand-primary-active)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Segoe UI", "sans-serif"],
        sans: ["var(--font-body)", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 24px -16px rgb(11 31 51 / 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
