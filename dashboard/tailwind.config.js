/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#05070d",
        paper2: "#0b0e15",
        paper3: "#12161d",
        ink: "#f0f2f6",
        ink2: "#cdd1d8",
        muted: "#9aa1aa",
        brass: "#ff8c3f",
        brassink: "#1a0b04",
        coral: "#ea6972",
        ok: "#79c289",
        warn: "#eba941",
        danger: "#ec5b57",
        err: "#ec5b57",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderColor: {
        rule: "var(--color-rule)",
        rule2: "var(--color-rule-2)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        input: "var(--radius-input)",
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade': 'fadeIn 0.3s ease-out',
        'scan': 'scan 2.5s linear infinite',
        'scan-overlay': 'scanOverlay 2.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scan: {
          '0%': { top: '0%' },
          '100%': { top: '100%' },
        },
        scanOverlay: {
          '0%': { top: '0%', opacity: '0.4' },
          '50%': { opacity: '0.8' },
          '100%': { top: '85%', opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
}
