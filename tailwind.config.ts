import type { Config } from 'tailwindcss';

// Palette sampled from the Brainbric logo (a yellow-to-red flame). The flame hue is kept for data:
// the pipeline, the ready-to-send queue and fit. Chrome stays neutral.
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
          ink: '#9A3412',
          tint: '#FFF1E6',
        },
        ink: {
          950: '#141215',
          900: '#1D1A1E',
          800: '#2A262C',
          700: '#45404A',
          500: '#66606B',
          400: '#8E8893',
        },
        paper: {
          DEFAULT: '#F7F6F4',
          card: '#FFFFFF',
          line: '#E7E4E1',
          rule: '#F0EEEB',
          active: '#ECE9E5',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
};

export default config;
