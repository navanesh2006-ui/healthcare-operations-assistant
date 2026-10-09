/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#07161A",
        deep: "#0B1F22",
        surface: "#102A2A",
        elevated: "#163B33",
        forest: "#1E4A38",
        primaryGreen: "#4CAF50",
        limeAccent: "#8BC34A",
        mintGlow: "#7CF2B0",
        textLight: "#E9F6EC",
        mutedText: "#8FB3A0",
        // Legacy alias compatibility
        darkBg: "#0B1F22",
        panelBg: "#102A2A",
        forestGreen: "#1E4A38",
        // Status tokens
        pendingAmber: "#F5B942",
        scheduledBlue: "#3DD6C6",
        completedGreen: "#4CAF50",
        reviewOrange: "#FF8A3D",
        declinedRed: "#FF5A5F",
        // Light mode specific tokens
        lightBase: "#F4FAF5",
        lightSurface: "#E8F4EA",
        lightElevated: "#D6EBD9",
        lightText: "#0F291E",
      },
      fontFamily: {
        heading: ["'Space Grotesk'", "'Sora'", "sans-serif"],
        sans: ["'Inter'", "'Manrope'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(7, 22, 26, 0.37)',
        'glow-mint': '0 0 20px -3px rgba(124, 242, 176, 0.3)',
        'glow-primary': '0 0 20px -3px rgba(76, 175, 80, 0.35)',
      },
      backgroundImage: {
        'aurora-dark': 'radial-gradient(ellipse at 20% 10%, rgba(30, 74, 56, 0.45) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(16, 42, 42, 0.6) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(7, 22, 26, 0.95) 0%, #0B1F22 100%)',
        'aurora-light': 'radial-gradient(ellipse at 20% 10%, rgba(139, 195, 74, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(76, 175, 80, 0.1) 0%, transparent 50%), linear-gradient(135deg, #F4FAF5 0%, #E8F4EA 100%)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.04)' },
        },
        floatSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        }
      },
      animation: {
        'shimmer': 'shimmer 1.8s infinite',
        'pulse-glow': 'pulseGlow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'floatSubtle 4s ease-in-out infinite',
      }
    },
  },
  plugins: [],
}
