// tailwind.config.cjs
module.exports = {
    content: [
        "./src/**/*.{astro,html,js,jsx,ts,tsx}" // Escanea todos tus archivos en src
    ],
    theme: {
        extend: {
        colors: {
            brand: "#1e40af", // ejemplo: color personalizado
        },
        fontFamily: {
            sans: ["Inter", "system-ui", "sans-serif"], // tipografía personalizada
        },
        },
    },
    plugins: [],
};