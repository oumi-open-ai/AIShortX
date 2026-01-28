/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-page': 'var(--color-bg-page)',
        'bg-card': 'var(--color-bg-card)',
        'bg-element': 'var(--color-bg-element)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'primary': 'var(--color-primary)',
        'border': 'var(--color-border)',
      }
    },
  },
  plugins: [],
}
