import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node";

// Usamos output "server" porque el panel admin/empleado necesita
// leer sesión y rol en cada request (middleware) y las API routes
// (crear pedidos, cobrar, mover stock) corren en el servidor.
// El catálogo público sigue siendo rápido: Astro solo manda JS
// donde nosotros lo pedimos explícitamente (islas puntuales).
export default defineConfig({
  output: "server",
  adapter: node({
    mode: "standalone",
  }),
  integrations: [
    tailwind({
      // Aplicamos nuestras clases base manualmente en globals.css,
      // así evitamos que Tailwind inyecte su propio reset por encima.
      applyBaseStyles: false,
    }),
  ],
  server: {
    port: 4321,
  },
  vite: {
    ssr: {
      // Evita que Vite intente bundlear el cliente de Supabase server-side
      // de forma incorrecta en dev.
      noExternal: ["@supabase/supabase-js"],
    },
  },
});