import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
// Primer (self-hosted, same file as the live Jekyll site's assets/vendor/primer.css) first,
// then the site's own custom SCSS on top — matches the live site's own cascade order (Primer's
// base styles, then site.scss's design tokens/overrides layered after). Tailwind's own reset
// (Preflight, pulled in via index.css's `@import "tailwindcss"`) loads before both; Primer's own
// normalize + explicit element rules re-establish its expected baseline for anything using
// Primer classes, so the two reset systems don't fight — Tailwind utilities are only used by the
// shadcn-sourced components (e.g. the shader background), not by anything wearing Primer classes.
import './styles/primer.css'
import './styles/site.scss'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
