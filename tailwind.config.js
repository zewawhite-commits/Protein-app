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
      // Readable minimums: body text 14px with generous line spacing.
      fontSize: {
        xs: ['13px', { lineHeight: '1.5' }],
        sm: ['14px', { lineHeight: '1.6' }],
        base: ['16px', { lineHeight: '1.6' }],
      },
      // Heavier weights (variable font): text reads bolder and more modern.
      fontWeight: { normal: '500', medium: '560', semibold: '670', bold: '760', extrabold: '840' },
      fontFamily: { sans: ['"Plus Jakarta Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        confetti: {
          '0%': { transform: 'translate(0,0) rotate(0)', opacity: 1 },
          '100%': { transform: 'translate(var(--dx), 70vh) rotate(var(--rot))', opacity: 0 },
        },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.06)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(.2,.8,.2,1) both',
        'sheet-up': 'sheet-up .34s cubic-bezier(.2,.8,.2,1) both',
        fade: 'fade .2s both',
        pop: 'pop .45s cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
};
