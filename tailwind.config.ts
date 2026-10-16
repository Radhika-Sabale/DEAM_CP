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
        'teal-2': 'var(--teal-2)', green: 'var(--green)', red: 'var(--red)', amber: 'var(--amber)',
        card: 'var(--card)',
        gray: { 50: '#f5fafa', 100: '#eaf4f4', 200: '#dcebec', 300: '#c6dddf', 400: '#a5c1c7', 500: '#587480', 600: '#45616d', 700: '#294954', 800: '#193844', 900: '#0c2a38', 950: '#081d26' },
        blue: { 50: '#eaf4f4', 100: '#d8eeee', 200: '#b4dddd', 300: '#82c6ca', 400: '#4baeb5', 500: '#0f7f8a', 600: '#0f7f8a', 700: '#0d6974', 800: '#0c5661', 900: '#0c3c49', 950: '#092c37' },
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
