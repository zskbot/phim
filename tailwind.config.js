/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./data/**/*.{js,jsx}"],
  theme: { extend: { colors: { ink: "#08090d", panel: "#11131a", accent: "#e50914" } } },
  plugins: []
};