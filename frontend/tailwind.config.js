/** @type {import('tailwindcss').Config} */

/**
 * Every colour resolves to a CSS custom property defined in index.css, so the
 * light/dark themes swap in one place and Tailwind classes stay theme-agnostic.
 * `<alpha-value>` keeps opacity modifiers (bg-panel/60) working.
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: token('canvas'),
        panel: token('panel'),
        raised: token('raised'),
        sunken: token('sunken'),
        hairline: token('hairline'),

        // Ink
        ink: {
          DEFAULT: token('ink'),
          soft: token('ink-soft'),
          muted: token('ink-muted'),
          faint: token('ink-faint'),
        },

        // Brand accent — UI chrome only, never a data-encoding channel.
        honey: {
          DEFAULT: token('honey'),
          strong: token('honey-strong'),
          ink: token('honey-ink'),
        },

        // Status scale — reserved meanings, always shipped with an icon + label.
        good: token('status-good'),
        warn: token('status-warning'),
        serious: token('status-serious'),
        critical: token('status-critical'),

        // Validated categorical series slots.
        series: {
          1: token('series-1'),
          2: token('series-2'),
          3: token('series-3'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        card: '18px',
        panel: '22px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        glow: 'var(--shadow-glow)',
      },
      transitionTimingFunction: {
        // A gentle overshoot-free curve used for everything that moves.
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        driftA: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(3%, -4%, 0) scale(1.08)' },
        },
        driftB: {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1.05)' },
          '50%': { transform: 'translate3d(-4%, 3%, 0) scale(1)' },
        },
        ridge: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        },
        sweep: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'drift-a': 'driftA 26s ease-in-out infinite',
        'drift-b': 'driftB 32s ease-in-out infinite',
        ridge: 'ridge 60s linear infinite',
        'pulse-ring': 'pulseRing 2s ease-out infinite',
        sweep: 'sweep 2.2s linear infinite',
      },
    },
  },
  plugins: [],
};
