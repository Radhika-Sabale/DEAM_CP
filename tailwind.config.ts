import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)', muted: 'var(--muted)', line: 'var(--line)', teal: 'var(--teal)',
        'teal-2': 'var(--teal-2)',
        card: 'var(--card)',
        gray: { 50: '#f5fafa', 100: '#eaf4f4', 200: '#dcebec', 300: '#c6dddf', 400: '#a5c1c7', 500: '#587480', 600: '#45616d', 700: '#294954', 800: '#193844', 900: '#0c2a38', 950: '#081d26' },
        blue: { 50: '#eaf4f4', 100: '#d8eeee', 200: '#b4dddd', 300: '#82c6ca', 400: '#4baeb5', 500: '#0f7f8a', 600: '#0f7f8a', 700: '#0d6974', 800: '#0c5661', 900: '#0c3c49', 950: '#092c37' },
        red: { 50: 'color-mix(in srgb, var(--red) 8%, var(--card))', 100: 'color-mix(in srgb, var(--red) 14%, var(--card))', 200: 'color-mix(in srgb, var(--red) 24%, var(--card))', 300: 'color-mix(in srgb, var(--red) 40%, var(--card))', 400: 'var(--red)', 500: 'var(--red)', 600: 'var(--red)', 700: 'var(--red)', 800: 'color-mix(in srgb, var(--red) 80%, var(--ink))', 900: 'color-mix(in srgb, var(--red) 55%, var(--ink))', 950: 'color-mix(in srgb, var(--red) 30%, var(--ink))' },
        green: { 50: 'color-mix(in srgb, var(--green) 8%, var(--card))', 100: 'color-mix(in srgb, var(--green) 14%, var(--card))', 200: 'color-mix(in srgb, var(--green) 24%, var(--card))', 300: 'color-mix(in srgb, var(--green) 40%, var(--card))', 400: 'var(--green)', 500: 'var(--green)', 600: 'var(--green)', 700: 'var(--green)', 800: 'color-mix(in srgb, var(--green) 80%, var(--ink))', 900: 'color-mix(in srgb, var(--green) 55%, var(--ink))', 950: 'color-mix(in srgb, var(--green) 30%, var(--ink))' },
        amber: { 50: 'color-mix(in srgb, var(--amber) 8%, var(--card))', 100: 'color-mix(in srgb, var(--amber) 14%, var(--card))', 200: 'color-mix(in srgb, var(--amber) 24%, var(--card))', 300: 'color-mix(in srgb, var(--amber) 40%, var(--card))', 400: 'var(--amber)', 500: 'var(--amber)', 600: 'var(--amber)', 700: 'var(--amber)', 800: 'color-mix(in srgb, var(--amber) 80%, var(--ink))', 900: 'color-mix(in srgb, var(--amber) 55%, var(--ink))', 950: 'color-mix(in srgb, var(--amber) 30%, var(--ink))' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: { panel: 'var(--shadow)' },
      borderRadius: { panel: '20px' },
    },
  },
  plugins: [],
};

export default config;
