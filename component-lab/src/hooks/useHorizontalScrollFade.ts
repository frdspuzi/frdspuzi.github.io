import { useCallback, useEffect, useRef, useState } from "react";

// Extracted from motion/tabs.tsx's TabsList, which needed this exact mechanism first (the pill
// filter row's scroll-edge fade) and went through a long chain of real bugs getting it right —
// see that component's own git history/comments for the full story. Shared here so any other
// horizontally-scrolling row (e.g. the Medium mobile story tray) gets the same already-fixed
// behavior instead of re-discovering the same bugs independently:
//  - min-w-0 needed on whatever wraps the scrollable element, or a flex item won't shrink below
//    its content's natural size and the element never actually overflows itself.
//  - the scrollbar itself reserves extra height that a full-height fade overlay would otherwise
//    inherit — hide it at the call site (scrollbar-width: none + ::-webkit-scrollbar hidden).
//  - don't trust an ancestor's "auto" height for the fade's own sizing; measure the scrollable
//    element's real clientHeight directly.
//  - a ResizeObserver, not just scroll/resize listeners: this can live inside an accordion that
//    defaults closed, so the first measurement can run against a genuinely 0×0 element with
//    nothing else ever re-triggering it once the section opens later.
//  - an explicit z-index on the fade overlay - content inside the row can carry its own z-index
//    for unrelated reasons (e.g. an active-state indicator), which can otherwise end up above a
//    z-index: auto overlay despite coming later in DOM order.
export function useHorizontalScrollFade<T extends HTMLElement>() {
  const scrollRef = useRef<T>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    setContentHeight(el.clientHeight);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  return { scrollRef, canScrollLeft, canScrollRight, contentHeight };
}
