import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#eef1f6', 100: '#d5dbe8', 200: '#aab7d1', 300: '#7f93ba', 400: '#546fa3', 500: '#2a4b8c', 600: '#1f3a70', 700: '#1B2A4A', 800: '#121d33', 900: '#0a101d' },
        brand: {
          blue: '#3B9AE1',
          green: '#43A047',
          orange: '#F7941D',
          yellow: '#FFC107',
          red: '#E53935',
          navy: '#1B2A4A',
        },
        blue: { 50: '#e8f4fd', 100: '#c5e3f9', 200: '#8ec8f3', 300: '#57aced', 400: '#3B9AE1', 500: '#2080c7', 600: '#1966a0', 700: '#134d78', 800: '#0c3351', 900: '#061a29' },
        green: { 50: '#e8f5e9', 100: '#c8e6c9', 200: '#a5d6a7', 300: '#81c784', 400: '#66bb6a', 500: '#43A047', 600: '#388E3C', 700: '#2E7D32', 800: '#1B5E20', 900: '#103813' },
        orange: { 50: '#fff8e8', 100: '#ffecc5', 200: '#ffd98a', 300: '#ffc44f', 400: '#F7941D', 500: '#e07e0f', 600: '#b8670c', 700: '#8f5009', 800: '#663906', 900: '#3d2204' },
        red: { 50: '#fdebed', 100: '#f9c7ca', 200: '#f08f95', 300: '#e75760', 400: '#E53935', 500: '#c62828', 600: '#a21f1f', 700: '#7d1717', 800: '#590f0f', 900: '#350808' },
        success: { 50: '#e8f5e9', 100: '#c8e6c9', 500: '#43A047' },
        warning: { 50: '#fff8e8', 100: '#ffecc5', 500: '#F7941D' },
        danger: { 50: '#fdebed', 100: '#f9c7ca', 500: '#E53935' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: {
        'pulse-bid': 'pulseBid 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'count-down': 'countDown 1s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
      },
      keyframes: {
        pulseBid: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
        slideUp: { '0%': { transform: 'translateY(24px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        countDown: { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)' } },
        fadeIn: { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};

export default config;
