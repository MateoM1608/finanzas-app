/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#F7F8FA',
        surface: {
          DEFAULT: '#FFFFFF',
          hover: '#F1F3F6',
          raised: '#F3F5F8',
        },
        border: {
          DEFAULT: '#E7E9ED',
          strong: '#D6D9DF',
        },
        ink: {
          primary: '#14161F',
          secondary: '#6B7280',
          tertiary: '#9CA3AF',
        },
        accent: {
          DEFAULT: '#2F6FED',
          hover: '#2559C7',
          muted: 'rgba(47,111,237,0.10)',
        },
        positive: '#16A34A',
        negative: '#DC2626',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(20,22,31,0.04), 0 8px 24px -12px rgba(20,22,31,0.10)',
      },
    },
  },
  plugins: [],
};
