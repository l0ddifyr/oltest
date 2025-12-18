/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#c59d24',
                'primary-dark': '#8a6d17',
                secondary: '#4a0404',
                bg: '#fdfbf7',
                surface: '#ffffff',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            borderRadius: {
                DEFAULT: '16px',
                'xl': '16px',
            }
        },
    },
    plugins: [],
}
