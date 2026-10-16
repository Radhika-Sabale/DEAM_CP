import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)', muted: 'var(--muted)', line: 'var(--line)', teal: 'var(--teal)',
        'teal-2': 'var(--teal-2)',
        bg: 'var(--bg)', sidebar: 'var(--sidebar)', card: 'var(--card)',
        header: 'var(--header)', soft: 'var(--soft)',
        gray: { 50: 'var(--soft)', 100: 'var(--header)', 200: 'var(--line)', 300: 'var(--line)', 400: 'var(--muted)', 500: 'var(--muted)', 600: 'color-mix(in srgb, var(--ink) 76%, var(--muted))', 700: 'var(--ink)', 800: 'var(--ink)', 900: 'var(--bg)', 950: 'var(--bg)' },
        blue: { 50: '#eaf4f4', 100: '#d8eeee', 200: '#b4dddd', 300: '#82c6ca', 400: '#4baeb5', 500: '#0f7f8a', 600: '#0f7f8a', 700: '#0d6974', 800: '#0c5661', 900: '#0c3c49', 950: '#092c37' },
        red: { 50: 'color-mix(in srgb, var(--red) 8%, var(--card))', 100: 'color-mix(in srgb, var(--red) 14%, var(--card))', 200: 'color-mix(in srgb, var(--red) 24%, var(--card))', 300: 'color-mix(in srgb, var(--red) 40%, var(--card))', 400: 'var(--red)', 500: 'var(--red)', 600: 'var(--red)', 700: 'var(--red)', 800: 'color-mix(in srgb, var(--red) 80%, var(--ink))', 900: 'color-mix(in srgb, var(--red) 55%, var(--ink))', 950: 'color-mix(in srgb, var(--red) 30%, var(--ink))' },
        green: { 50: 'color-mix(in srgb, var(--green) 8%, var(--card))', 100: 'color-mix(in srgb, var(--green) 14%, var(--card))', 200: 'color-mix(in srgb, var(--green) 24%, var(--card))', 300: 'color-mix(in srgb, var(--green) 40%, var(--card))', 400: 'var(--green)', 500: 'var(--green)', 600: 'var(--green-text)', 700: 'var(--green-text)', 800: 'color-mix(in srgb, var(--green) 80%, var(--ink))', 900: 'color-mix(in srgb, var(--green) 55%, var(--ink))', 950: 'color-mix(in srgb, var(--green) 30%, var(--ink))' },
        amber: { 50: 'color-mix(in srgb, var(--amber) 8%, var(--card))', 100: 'color-mix(in srgb, var(--amber) 14%, var(--card))', 200: 'color-mix(in srgb, var(--amber) 24%, var(--card))', 300: 'color-mix(in srgb, var(--amber) 40%, var(--card))', 400: 'var(--amber)', 500: 'var(--amber)', 600: 'var(--amber-text)', 700: 'var(--amber-text)', 800: 'color-mix(in srgb, var(--amber) 80%, var(--ink))', 900: 'color-mix(in srgb, var(--amber) 55%, var(--ink))', 950: 'color-mix(in srgb, var(--amber) 30%, var(--ink))' },
      },
      fontFamily: {
        sans: ['var(--ui)'],
        heading: ['var(--hd)'],
        mono: ['var(--mono)'],
      },
      boxShadow: { panel: 'var(--shadow)' },
      borderRadius: { panel: '20px' },
    },
  },
  plugins: [],
};

export default config;
