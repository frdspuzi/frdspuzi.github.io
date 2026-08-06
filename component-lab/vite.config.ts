import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    fs: {
      // Sections import ../_data/*.json directly (one source of truth with the live Jekyll
      // site, which GitHub Actions regenerates twice daily) instead of duplicating those files
      // into component-lab — needs the dev server allowed to read outside its own root.
      allow: [path.resolve(import.meta.dirname, ".."), import.meta.dirname],
    },
  },
})
