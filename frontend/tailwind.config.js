/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        pharma: {
          blue: '#0052CC',
          navy: '#172B4D',
          teal: '#00B8D9',
          green: '#36B37E',
          red: '#FF5630',
          orange: '#FF991F',
        },
      },
    },
  },
  plugins: [],
};
