/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          950: '#0a0a0f',
          900: '#12121a',
          800: '#1a1a26',
          700: '#242435',
          600: '#2e2e42',
        },
        text: {
          primary: '#e2e0ea',
          secondary: '#9896a3',
          muted: '#6b6978',
          faint: '#4a4856',
        },
        accent: {
          DEFAULT: '#8b5cf6',
          hover: '#7c3aed',
          glow: 'rgba(139, 92, 246, 0.15)',
          border: 'rgba(139, 92, 246, 0.25)',
        },
        success: {
          DEFAULT: '#14b8a6',
          glow: 'rgba(20, 184, 166, 0.15)',
          border: 'rgba(20, 184, 166, 0.25)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.25)',
        },
        danger: {
          DEFAULT: '#f43f5e',
          glow: 'rgba(244, 63, 94, 0.15)',
          border: 'rgba(244, 63, 94, 0.25)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
}
