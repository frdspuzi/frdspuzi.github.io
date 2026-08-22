import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAccordionGroup } from "@/hooks/useAccordionGroup";
import { isDesktopWidthAtMount } from "@/lib/viewport";

// React port of floating_toc.html — the WHOLE thing, hand-built to match the original's own
// minimal tick-mark rail exactly (a small horizontal bar per section, no icons/text in the rail
// itself; label/description only ever show in the separate #rail-preview tooltip on hover/focus),
// including the mobile collapse/handle feature and the theme toggle living inside the same rail.
// A previous version of this component wrapped the real @beui/preview-rail component instead —
// removed: that component's own default preview-panel/rail visual language never matched this
// site's minimal design, and it had no equivalent for the mobile collapse feature at all. See
// site.scss's own "Preview Rail" section for the CSS (also ported close to 1:1 from the
// original's own <style> block) and ThemeToggle.tsx/useTheme.ts for the toggle itself, already an
// exact port and reused here unchanged.
const SECTIONS: { id: string; label: string; desc: string }[] = [
  { id: "about", label: "About", desc: "Bio & background" },
  { id: "gratitude", label: "Gratitude", desc: "A mindful pause" },
  { id: "reclaiming-algo", label: "Reclaiming the Algo", desc: "Curated, mindful YouTube picks" },
  { id: "my-writing", label: "Insights & Writing", desc: "Articles + AI trivia" },
  { id: "github-trending", label: "What the Internet's Building", desc: "Trending repos + Product Hunt launches" },
  { id: "photography", label: "Photography", desc: "Shots from Unsplash" },
];

const SCALE_BY_DISTANCE = [1, 0.68, 0.44, 0.25];
function scaleForDistance(d: number) {
  return SCALE_BY_DISTANCE[Math.min(d, SCALE_BY_DISTANCE.length - 1)];
}

// Which sections are accordion-controlled (need toggle() called before scrolling, if currently
// closed) and what defaultOpen fallback each needs — matches exactly what each section's own
// <Accordion> instance was registered with. "about" isn't an accordion at all, just scrolls.
function accordionDefaultFor(id: string): boolean | null {
  if (id === "gratitude") return false; // Gratitude never defaultOpens, any viewport
  if (id === "reclaiming-algo" || id === "my-writing" || id === "photography" || id === "github-trending") {
    return isDesktopWidthAtMount();
  }
  return null;
}

export function FloatingNav() {
  const { isOpen, toggle } = useAccordionGroup();
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [previewTop, setPreviewTop] = useState(24);
  const railRef = useRef<HTMLDivElement>(null);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Same scroll-spy as the original's updateActiveLink(): walk sections bottom-to-top, the first
  // one whose top has crossed 40% of the viewport height is "active" — checking from the bottom
  // means a section lower on the page wins as soon as it reaches that line, rather than the
  // topmost section staying active the whole time it's merely still partially visible.
  useEffect(() => {
    function updateActiveLink() {
      const windowH = window.innerHeight;
      let next = SECTIONS[0].id;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el && el.getBoundingClientRect().top <= windowH * 0.4) {
          next = SECTIONS[i].id;
          break;
        }
      }
      setActiveId(next);
    }
    updateActiveLink();
    window.addEventListener("scroll", updateActiveLink, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveLink);
  }, []);

  // Sync html.rail-pref-hidden + the rail's own `inert` from whatever was saved last visit — one
  // time, on mount, not reactive to state (matching the original: this doesn't retrigger the
  // slide animation, it only makes the non-animated `inert` property match a class the CSS has
  // already applied by the time this runs). Gated to mobile widths specifically: a railHidden
  // preference saved during an earlier mobile visit shouldn't leave the rail
  // visible-but-uninteractive if the same browser later loads this at a desktop width, since the
  // CSS transform that actually hides it is itself mobile-only.
  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem("railHidden") === "true";
    } catch {
      // localStorage can throw in some privacy modes — falls back to "not hidden".
    }
    document.documentElement.classList.toggle("rail-pref-hidden", stored);
    if (railRef.current) {
      railRef.current.inert = window.matchMedia("(max-width: 767px)").matches && stored;
    }
  }, []);

  // `inert` (not just the CSS transform) is what actually makes the collapsed rail's buttons
  // unreachable by Tab/screen readers while it's slid off-screen — transform alone only moves it
  // visually, the buttons underneath would still be in the normal focus order otherwise.
  function setRailHidden(hidden: boolean) {
    document.documentElement.classList.toggle("rail-pref-hidden", hidden);
    if (railRef.current) railRef.current.inert = hidden;
    try {
      localStorage.setItem("railHidden", hidden ? "true" : "false");
    } catch {
      // Same silent fallback as above — preference just doesn't persist this session.
    }
  }

  function scrollToSection(id: string) {
    if (id === "about") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const fallback = accordionDefaultFor(id);
    if (fallback !== null && !isOpen(id, fallback)) {
      toggle(id, fallback);
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showPreview(index: number) {
    setHoveredIndex(index);
    const tickEl = tickRefs.current[index];
    if (tickEl) {
      const rect = tickEl.getBoundingClientRect();
      setPreviewTop(Math.max(12, rect.top + rect.height / 2 - 20));
    }
  }

  function hidePreview() {
    setHoveredIndex(null);
  }

  return (
    <nav id="floating-toc" aria-label="Page navigation">
      <div
        id="preview-rail"
        ref={railRef}
        onMouseLeave={hidePreview}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hidePreview();
        }}
      >
        {/* Not class="rail-tick" — that class is what the proximity-scaling logic below treats
            as the section ticks; giving this button the same class would misalign every tick
            with its section by one. */}
        <button id="rail-collapse-btn" type="button" aria-label="Hide navigation" onClick={() => setRailHidden(true)}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M9.78 12.78a.75.75 0 0 1-1.06 0L4.47 8.53a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L6.06 8l3.72 3.72a.75.75 0 0 1 0 1.06Z"></path>
          </svg>
        </button>

        {SECTIONS.map((section, i) => {
          const isActive = section.id === activeId;
          const scale = hoveredIndex === null ? (isActive ? 1 : 0.8) : scaleForDistance(Math.abs(i - hoveredIndex));
          return (
            <button
              key={section.id}
              ref={(el) => {
                tickRefs.current[i] = el;
              }}
              className={"rail-tick" + (isActive ? " toc-active" : "")}
              aria-label={section.label}
              aria-current={isActive ? "true" : "false"}
              onMouseEnter={() => showPreview(i)}
              onFocus={() => showPreview(i)}
              onClick={() => scrollToSection(section.id)}
            >
              <span className="tick-mark" style={{ transform: `scale(${scale})` }}></span>
            </button>
          );
        })}

        <ThemeToggle />
      </div>

      <div id="rail-preview" className={hoveredIndex !== null ? "visible" : undefined} style={{ top: previewTop }}>
        <p id="rail-preview-label">{hoveredIndex !== null ? SECTIONS[hoveredIndex].label : ""}</p>
        <p id="rail-preview-desc">{hoveredIndex !== null ? SECTIONS[hoveredIndex].desc : ""}</p>
      </div>

      {/* Only ever visible while the rail itself is collapsed (see site.scss) — a small
          persistent tab at the same position so the rail can be brought back. */}
      <button id="rail-handle" type="button" aria-label="Show navigation" onClick={() => setRailHidden(false)}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path>
        </svg>
      </button>
    </nav>
  );
}
