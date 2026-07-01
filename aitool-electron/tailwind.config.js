/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'bg-light': '#F9FAFB',
        'bg-dark': '#1A1A2E',
        'sidebar-light': '#FFFFFF',
        'sidebar-dark': '#16213E',
        'user-bubble-light': '#3B82F6',
        'user-bubble-dark': '#2563EB',
        'ai-bubble-light': '#FFFFFF',
        'ai-bubble-dark': '#0F3460',
        'tool-badge-light-bg': '#F0FDF4',
        'tool-badge-light-border': '#15803D',
        'tool-badge-dark-bg': '#052E16',
        'tool-badge-dark-border': '#4ADE80',
      },
      animation: {
        'cursor-blink': 'blink 1s step-end infinite',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
