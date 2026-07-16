/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7C3AED',
        secondary: '#A855F7',
        accent: '#C084FC',
        indigo: '#5B21B6',
        surface: '#ffffff',
        bg: '#FAFAFC',
        background: '#FAFAFC'
      },
      boxShadow: {
        'soft': '0 8px 30px rgba(11,8,28,0.06)',
        'elev': '0 14px 40px rgba(91,33,182,0.08)'
      },
      borderRadius: {
        'lg-18': '18px',
        'xl-20': '20px'
      },
      transitionDuration: { '250': '250ms' }
    }
  },
  plugins: [],
}
