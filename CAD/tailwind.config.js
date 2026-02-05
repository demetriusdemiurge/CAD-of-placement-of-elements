/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#1e1e1e',
        'dark-panel': '#252526',
        'dark-hover': '#2a2d2e',
        'border-color': '#3e3e42',
      }
    },
  },
  plugins: [],
}

