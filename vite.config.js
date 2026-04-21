import { defineConfig } from "vite";

export default defineConfig({
  root: "./src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:                  "./src/index.html",
        mentionsLegales:       "./src/mentions-legales.html",
        politiqueConfidentialie: "./src/politique-confidentialite.html",
      },
    },
  },
  server: {

    proxy: {
      // Proxifie les appels /api vers le serveur Express (port 3000)
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
