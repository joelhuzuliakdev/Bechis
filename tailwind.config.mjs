/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
        extend: {
        colors: {
            // Identidad Bechis: minimalista, negro + amarillo con
            // disciplina, fondo claro para legibilidad y sensación
            // profesional (no un catálogo "todo negro").
            ink: {
            DEFAULT: "#141414", // header, textos de marca, botones oscuros
            soft: "#232323",
            muted: "#5C5C5C",
            },
            bechis: {
            yellow: "#FFC629",
            "yellow-dark": "#E9AE00",
            "yellow-soft": "#FFF6DE", // tinte muy sutil, para fondos puntuales
            },
            surface: {
            DEFAULT: "#FFFFFF",  // cards
            bg: "#FAFAF8",        // fondo general: blanco cálido, no gris ni negro
            line: "#ECEAE3",      // bordes/divisores
            },
            text: {
            DEFAULT: "#171717",
            muted: "#75726C",
            },
            success: "#1F9254",
            danger: "#C0392B",
            warning: "#8A6300",
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
            subtle: "0 1px 2px rgba(20,20,20,.04), 0 12px 28px rgba(20,20,20,.06)",
        },
        },
    },
    plugins: [],
};