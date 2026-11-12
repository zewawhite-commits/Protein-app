/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        raised: v('raised'),
        line: v('line'),
        ink: v('ink'),
        silver: v('silver'),
        dim: v('dim'),
        primary: v('primary'),
        'on-primary': v('on-primary'),
        accent: v('accent'),
        danger: v('danger'),
        warn: v('warn'),
      },
      fontFamily: { sans: ['"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(.2,.8,.2,1) both',
        'sheet-up': 'sheet-up .34s cubic-bezier(.2,.8,.2,1) both',
        fade: 'fade .2s both',
      },
    },
  },
  plugins: [],
};
