import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identidad UTSC — mismos valores que :root en src/index.css.
        pri: {
          DEFAULT: '#FF8300',   // naranja de marca: solo relleno
          hover:   '#EE7A00',
          active:  '#D66D00',
          ink:     '#AD4E00',   // naranja como texto (AA sobre claro)
        },
        sec: {
          DEFAULT: '#0C7669',   // turquesa como texto (AA sobre claro)
          brand:   '#49C2B3',   // turquesa de marca: solo relleno
        },
        navy: {
          DEFAULT: '#30466F',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
