import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        guardian: {
          bg: "var(--guardian-bg)",
          card: "var(--guardian-card)",
          border: "var(--guardian-border)",
          safe: "var(--guardian-safe)",
          warning: "var(--guardian-warning)",
          critical: "var(--guardian-critical)",
          accent: "var(--guardian-accent)",
          text: "var(--guardian-text)",
          muted: "var(--guardian-muted)"
        }
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};
export default config;
