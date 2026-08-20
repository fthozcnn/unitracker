/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#172554',
                }
            }
        },
    },
    plugins: [],
    safelist: [
        {
            pattern: /(bg|text|border)-(blue|green|red|orange|purple|pink|amber|emerald|indigo|slate)-(50|100|200|300|400|500|600|700|800|900|950)/,
            variants: ['dark', 'hover', 'dark:hover'],
        },
        {
            pattern: /(bg|text|border)-(blue|green|red|orange|purple|pink|amber|emerald|indigo|slate)-(50|100|200|300|400|500|600|700|800|900|950)\/(10|20|30|40|50)/,
            variants: ['dark', 'hover', 'dark:hover'],
        },
    ],
}
