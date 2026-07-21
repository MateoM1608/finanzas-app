/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#0A0A0B',
        surface: {
          DEFAULT: '#131316',
          hover: '#1B1B1F',
          raised: '#1F1F24',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          strong: 'rgba(255,255,255,0.14)',
        },
        ink: {
          primary: '#F5F5F4',
          secondary: '#9B9BA3',
          tertiary: '#68686F',
        },
        accent: {
          DEFAULT: '#D4AF37',
          hover: '#E4C158',
          muted: 'rgba(212,175,55,0.12)',
        },
        positive: '#34D399',
        negative: '#F87171',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -8px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
