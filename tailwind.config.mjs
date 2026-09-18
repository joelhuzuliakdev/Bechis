/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
        extend: {
        colors: {
            // Identidad Bechis: todo el sitio en negro, con amarillo como
            // único acento y blanco para el texto. Tres tonos de negro
            // (no uno solo) para poder diferenciar secciones y cards sin
            // recurrir a otro color.
            ink: {
            DEFAULT: "#0D0D0D", // el negro más oscuro: header, hero, footer
            soft: "#1A1A1A",    // un escalón más claro: cards, secciones alternadas
            muted: "#2A2A2A",   // bordes/divisores sobre negro
            },
            bechis: {
            yellow: "#FFC629",
            "yellow-dark": "#E9AE00",
            "yellow-soft": "#FFF3D6", // reservado para chips puntuales
            },
            surface: {
            DEFAULT: "#1A1A1A", // fondo de las cards (= ink.soft)
            bg: "#0D0D0D",       // fondo general de página (= ink.DEFAULT)
            line: "#2A2A2A",     // bordes (= ink.muted)
            },
            text: {
            DEFAULT: "#FFFFFF",
            muted: "#9E9E9E",
            },
            success: "#3FBE7A",
            danger: "#FF6B5B",
            warning: "#FFC629",
        },
        fontFamily: {
            display: ["'Archivo Black'", "Inter", "sans-serif"],
            sans: ["Inter", "system-ui", "sans-serif"],
        },
        borderRadius: {
            sm: "10px",
            DEFAULT: "14px",
            lg: "20px",
        },
        boxShadow: {
            subtle: "0 1px 2px rgba(0,0,0,.5), 0 12px 32px rgba(0,0,0,.4)",
        },
        },
    },
    plugins: [],
};