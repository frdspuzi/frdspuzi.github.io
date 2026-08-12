import type { ReactNode } from "react";

// Ported from footer.html's shared goo-popover SVG filter def (invisible, ID-referenced from CSS
// via filter: url(#goo-popover-filter) — position-agnostic, one definition covers every (i)
// popover trigger on the page). The shared vanilla-JS scripts footer.html also loaded
// (accordion.js, goo-popover.js, etc.) become proper React hooks/components instead of <script
// src> tags, built alongside whichever section actually needs them.
//
// ThemeToggle now lives in FloatingNav (its real home, the Preview Rail) — no longer rendered
// here; this used to hold a temporary fixed-position copy before the rail existed.
export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <filter id="goo-popover-filter">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
    </>
  );
}
