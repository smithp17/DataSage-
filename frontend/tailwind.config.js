/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void:    "#000000",
        carbon:  "#050505",
        graphite:"#0D0D0D",
        smoke:   "#1A1A1A",
        ash:     "#2A2A2A",
        acid:    "#DFFF00",
        lime:    "#CCFF00",
        volt:    "#AAFF00",
        cyan:    "#00FFFF",
        plasma:  "#BF5AF2",
        ember:   "#FF6B35",
        ice:     "#E0F7FA",
      },
      fontFamily: {
        hero:    ["Space Grotesk", "sans-serif"],
        display: ["Syncopate", "sans-serif"],
        body:    ["DM Sans", "sans-serif"],
        mono:    ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "grad-acid":   "linear-gradient(135deg, #DFFF00, #CCFF00)",
        "grad-cyan":   "linear-gradient(135deg, #00FFFF, #BF5AF2)",
        "grad-fire":   "linear-gradient(135deg, #FF6B35, #DFFF00)",
        "grad-void":   "linear-gradient(135deg, #050505, #0D0D0D)",
      },
    },
  },
  plugins: [],
};
