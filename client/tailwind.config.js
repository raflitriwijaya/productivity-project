/** @type {import('tailwindcss').Config} */
// Single source of truth per SKILL.md §3.
// darkMode: 'class' is REQUIRED — the theme toggle manually adds/removes .dark
// on <html> via useTheme (§5.5). Without this, dark: variants follow OS only.
//
// "The Stoic Garden" palette — replaces the original Emerald accent system.
// moss      = nature / agritech / persistence + success states (former emerald role)
// terracotta = earth / craft / hardware & embedded engineering (secondary accent)
// ember     = fire of innovation / primary CTA & active highlights (primary buttons)
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        moss: {
          50: '#EDF2EE',
          100: '#D4E3D7',
          200: '#B5CFBB',
          300: '#8FB996',
          400: '#6BA37A',
          500: '#4A7C59', // base
          600: '#3D6548',
          700: '#304F39',
          800: '#233A2A',
          900: '#17271C',
          950: '#0E1912',
        },
        terracotta: {
          50: '#F9F2EC',
          100: '#F2E3D6',
          200: '#E6C7AD',
          300: '#D9AA84',
          400: '#CD8E5B',
          500: '#C67A4B', // base
          600: '#B36640',
          700: '#8F4E32',
          800: '#6B3A25',
          900: '#472618',
          950: '#2E1810',
        },
        ember: {
          50: '#FEF7EB',
          100: '#FCEDC6',
          200: '#F9DFA0',
          300: '#F5CE7A',
          400: '#F0BB54',
          500: '#E8A838', // base
          600: '#D4942E',
          700: '#B07A25',
          800: '#8C601D',
          900: '#684715',
          950: '#2E1F0A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out': {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'slide-up': 'slide-up 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-in forwards',
      },
    },
  },
  plugins: [],
};
