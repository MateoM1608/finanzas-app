/** @type {import('tailwindcss').Config} */

// Todos los colores salen de variables CSS (canales RGB) definidas en
// src/assets/main.css para :root (claro) y .dark (oscuro). Así una misma clase
// (`bg-surface`, `text-ink-secondary`, `bg-negative/10`…) sirve en los dos
// temas y el cambio de tema no toca ningún componente.
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: v('canvas'),
        surface: {
          DEFAULT: v('surface'),
          hover: v('surface-hover'),
          raised: v('surface-raised'),
          sunken: v('surface-sunken'),
        },
        border: {
          DEFAULT: v('border'),
          strong: v('border-strong'),
        },
        ink: {
          primary: v('ink-primary'),
          secondary: v('ink-secondary'),
          tertiary: v('ink-tertiary'),
        },
        accent: {
          DEFAULT: v('accent'),
          hover: v('accent-hover'),
          muted: 'rgb(var(--c-accent) / 0.12)',
          on: v('on-accent'),
        },
        positive: v('positive'),
        negative: v('negative'),
        warning: v('warning'),
        overlay: v('overlay'),
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      fontSize: {
        display: ['2.5rem', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '600' }],
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
