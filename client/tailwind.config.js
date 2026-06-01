/** @type {import('tailwindcss').Config} */
// Single source of truth per SKILL.md §3.
// darkMode: 'class' is REQUIRED — the theme toggle manually adds/removes .dark
// on <html> via useTheme (§5.5). Without this, dark: variants follow OS only.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
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
