import { useEffect, useMemo, useState } from "react";
import { PreviewRail, type PreviewRailItem } from "@/components/motion/preview-rail";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAccordionGroup } from "@/hooks/useAccordionGroup";
import { isDesktopWidthAtMount } from "@/lib/viewport";

// React port of floating_toc.html, adapted onto the real @beui/preview-rail component instead of
// hand-building the proximity-scaling/preview-panel mechanics — the original's own code comments
// ("distance === 1 ? 0.68 : distance === 2 ? 0.44 : 0.25") are the *exact same numbers* this real
// component uses, strongly suggesting the original vanilla port was itself hand-modeled on this
// same beui.dev reference. Must be rendered inside the same AccordionGroupProvider as the 3
// groupable sections (YoutubeFeed/InsightsWriting/Photography) — clicking a tick for a currently-
// closed section needs to call toggle() on that same context before scrolling to it.
//
// Known gap, not ported: the original's mobile-only collapse/handle feature (a small tab that
// slides the whole rail off-screen, persisted via localStorage `railHidden`) has no equivalent in
// the real component and wasn't added here — the rail is always visible on every viewport width
// for now.
const SECTIONS: { id: string; label: string; description: string }[] = [
  { id: "about", label: "About", description: "Bio & background" },
  { id: "gratitude", label: "Gratitude", description: "A mindful pause" },
  { id: "reclaiming-algo", label: "Reclaiming the Algo", description: "Curated, mindful YouTube picks" },
  { id: "my-writing", label: "Insights & Writing", description: "Articles + AI trivia" },
  { id: "photography", label: "Photography", description: "Shots from Unsplash" },
];

// Which sections are accordion-controlled (need toggle() called before scrolling, if currently
// closed) and what defaultOpen fallback each needs — matches exactly what each section's own
// <Accordion> instance was registered with. "about" isn't an accordion at all, just scrolls.
function accordionDefaultFor(id: string): boolean | null {
  if (id === "gratitude") return false; // Gratitude never defaultOpens, any viewport
  if (id === "reclaiming-algo" || id === "my-writing" || id === "photography") {
    return isDesktopWidthAtMount();
  }
  return null;
}

export function FloatingNav() {
  const { isOpen, toggle } = useAccordionGroup();
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

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

  const items: PreviewRailItem[] = useMemo(
    () =>
      SECTIONS.map((s) => ({
        id: s.id,
        label: s.label,
        ariaLabel: s.label,
        description: s.description,
      })),
    [],
  );

  return (
    <PreviewRail
      items={items}
      activeId={activeId}
      highlightActive
      onItemSelect={(item) => scrollToSection(item.id)}
      className="fixed top-6 left-0 z-[1000] min-h-0 w-auto"
      railClassName="gap-3 rounded-r-xl border border-l-0 border-[var(--border)] bg-[var(--surface)] py-3 shadow-md"
    >
      <ThemeToggle />
    </PreviewRail>
  );
}
