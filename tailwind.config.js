/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      },
      colors: {
        agro: {
          50: '#f2fbf5',
          100: '#e1f7e8',
          500: '#22c55e',
          700: '#15803d',
          900: '#14532d',
        },
        earth: {
          800: '#4a4036',
        }
      }
    },
  },
  plugins: [],
}