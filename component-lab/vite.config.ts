import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // e2e/ holds Playwright specs, which use Playwright's own `test()` - Vitest's default
    // include glob matches *.spec.ts regardless of directory, so without this exclude it tries
    // to run them too and fails with "Playwright Test did not expect test() to be called here".
    // Extends (not replaces) Vitest's own default exclude list - see
    // https://vitest.dev/config/#exclude.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cjs,mocha,eslint,prettier}.config.*",
      "**/e2e/**",
    ],
    // No committed tests yet - this whole suite is scaffolding for the "new features get tests
    // going forward" policy in .ai/architecture.md, not retroactive coverage. An empty suite
    // must still pass so `npm test` is a real, green CI/pre-commit gate from day one.
    passWithNoTests: true,
  },
  build: {
    // Lets Lighthouse/DevTools performance profiling point at real source file/line instead of
    // minified bundle offsets (e.g. the forced-reflow audit currently just says "line 2948,
    // column 235492") - not shipped to end users in any way that costs them anything, since
    // sourcemaps are only fetched by DevTools when actually opened, never during a normal page
    // load.
    sourcemap: true,
  },
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
