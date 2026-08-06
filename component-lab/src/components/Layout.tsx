import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

// Ported from footer.html's shared goo-popover SVG filter def (invisible, ID-referenced from CSS
// via filter: url(#goo-popover-filter) — position-agnostic, one definition covers every (i)
// popover trigger on the page). The shared vanilla-JS scripts footer.html also loaded
// (accordion.js, goo-popover.js, etc.) become proper React hooks/components instead of <script
// src> tags, built alongside whichever section actually needs them (Phase 2 of the build order).
//
// ThemeToggle's real home is the Preview Rail (not yet built, see the build order) — placed here
// only as a temporary, minimal spot to verify data-theme toggling actually works end-to-end
// before the rail exists to properly contain it.
export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 50 }}>
        <ThemeToggle />
      </div>
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
