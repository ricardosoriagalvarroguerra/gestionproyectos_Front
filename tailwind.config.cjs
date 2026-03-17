/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--bg-surface)",
        panel: "var(--bg-panel)",
        muted: "var(--bg-muted)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        "border-muted": "var(--border-muted)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
      },
    },
  },
  plugins: [],
};
