/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          400: '#8eed0b',
          500: '#7ddc09',
          600: '#68b807',
        },
        pink: {
          500: '#f50569',
          600: '#db045d',
        }
      },
    },
  },
  plugins: [],
}