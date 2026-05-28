/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Arial', 'sans-serif']
      },
      colors: {
        ink: '#172033',
        panel: '#ffffff',
        line: '#d8dee8',
        gain: '#168a57',
        loss: '#c2413c',
        signal: '#2563eb',
        amber: '#b7791f'
      },
      boxShadow: {
        soft: '0 10px 28px rgba(23, 32, 51, 0.08)'
      }
    }
  },
  plugins: []
};
