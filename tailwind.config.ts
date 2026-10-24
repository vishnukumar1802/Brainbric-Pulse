import type { Config } from 'tailwindcss';

// Palette sampled from the Brainbric logo: a yellow-to-red flame gradient.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        flame: {
          yellow: '#FDE11B',
          amber: '#FCB216',
          orange: '#FB8C14',
          red: '#FF3A08',
          deep: '#D92E06',
        },
        ink: {
          950: '#121013',
          900: '#1B181C',
          800: '#26222A',
          700: '#38333D',
          500: '#6F6875',
          400: '#958E9B',
        },
        paper: {
          DEFAULT: '#F6F5F7',
          card: '#FFFFFF',
          line: '#E6E3E9',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        flame: 'linear-gradient(180deg, #FDE11B 0%, #FB8C14 55%, #FF3A08 100%)',
        'flame-x': 'linear-gradient(90deg, #FCB216 0%, #FB8C14 45%, #FF3A08 100%)',
      },
      boxShadow: {
        card: '0 1px 2px rgba(18,16,19,0.04), 0 1px 1px rgba(18,16,19,0.03)',
      },
    },
  },
  plugins: [],
};

export default config;
