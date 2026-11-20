/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { pixel: ['"Press Start 2P"', "monospace"], body: ['"VT323"', "monospace"] },
      colors: {
        ink: "#150b2e", night: "#1f1347", panel: "#2b1b5e", panel2: "#3a2680", edge: "#0b0520",
        gold: "#ffd23f", mint: "#3ddc84", ruby: "#ff4d6d", sky: "#35d0ff", tangerine: "#ff8a3d", bubble: "#ff5fa2", grape: "#9b6bff",
      },
    },
  },
  plugins: [],
};
