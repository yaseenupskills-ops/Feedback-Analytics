/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sentiment: {
          positive: {
            light: '#ecfdf5',
            DEFAULT: '#10b981',
            dark: '#065f46',
            border: '#a7f3d0',
          },
          negative: {
            light: '#fef2f2',
            DEFAULT: '#ef4444',
            dark: '#991b1b',
            border: '#fecaca',
          },
          neutral: {
            light: '#f3f4f6',
            DEFAULT: '#6b7280',
            dark: '#374151',
            border: '#e5e7eb',
          },
        },
      },
    },
  },
  plugins: [],
};
