const colors = require('tailwindcss/colors');
const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["src/**/*.{astro,html,js,ts,jsx,tsx}"],
  theme: {
    fontFamily: {
      sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      serif: ["Georgia", "Cambria", "Times New Roman", "Times", "serif"],
      mono: ["Fira Code", ...defaultTheme.fontFamily.mono],
    },
    extend: {
      colors: {
        neutral: colors.neutral,
        accent: "#EF476F"
      }
    }
  },
  plugins: [],
};
