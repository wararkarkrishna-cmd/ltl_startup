/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-montserrat)', 'Montserrat', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        display: ['var(--font-playfair)', 'Playfair Display', 'Georgia', 'serif'],
        mono: ['var(--font-space-grotesk)', 'Space Grotesk', 'monospace'],
        number: ['var(--font-space-grotesk)', 'Space Grotesk', 'sans-serif'],
      },
      colors: {
        obsidian: {
          950: '#050507',
          900: '#09090b',
          850: '#0f0f12',
          800: '#141418',
          700: '#1e1e24',
          600: '#272730',
        },
      },
    },
  },
  plugins: [],
};
