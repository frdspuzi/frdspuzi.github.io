import { useCallback, useEffect, useRef } from "react";

// Shared by YoutubeCarousel and TriviaBoard — both hide their track's own drag affordance
// completely (prev/next slides sit fully off-screen at rest, nothing peeks in), so a first-time
// visitor has no visual reason to suspect the card is swipeable at all, let alone that it's
// swipeable *both* ways. This plays a one-time "wiggle" the first time the carousel actually
// becomes visible on screen — not on mount, since both of these can mount while still inside a
// closed, zero-size accordion on mobile — that peeks the next slide, returns, then peeks the
// previous slide, then returns, so the demonstration covers both swipe directions rather than
// implying only "forward" is possible. Deliberately no persistence (no localStorage/
// sessionStorage) — plays fresh on every page load/refresh, not just a visitor's very first-ever
// visit; the IntersectionObserver disconnecting after its first hit is what keeps it to once per
// load, not a "seen it" flag surviving between loads.
const PEEK_PX = 36;
const STEP_MS = 380;
const VISIBLE_DELAY_MS = 500;
const EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// Peek next, back to center, peek prev, back to center.
const STEPS = [
  `calc(-100% - ${PEEK_PX}px)`,
  "-100%",
  `calc(-100% + ${PEEK_PX}px)`,
  "-100%",
];

export function useSwipeHint(
  trackRef: { current: HTMLDivElement | null },
  viewportRef: { current: HTMLDivElement | null },
): () => void {
  // Set by the caller's own startSwipe (real touch/mousedown), not inferred here — the hook has
  // no visibility into a carousel's own swipe state otherwise. Doubles as an interrupt: clears any
  // in-flight wiggle transition immediately, so a real drag that grabs the track mid-wiggle tracks
  // the pointer exactly instead of easing toward wherever the wiggle was headed.
  const hasInteractedRef = useRef(false);
  const markInteracted = useCallback(() => {
    hasInteractedRef.current = true;
    const trackEl = trackRef.current;
    if (trackEl) trackEl.style.transition = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Nothing to demonstrate for reduced-motion users via an animated peek — the drag gesture
    // itself is unaffected, just this one visual teaching aid, same "skip the flourish, keep the
    // function" convention as every other animation in this codebase.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    // Recurses through STEPS one transform-transition per call, checking hasInteractedRef before
    // every write — a real drag started mid-wiggle already wrote its own transform via moveSwipe,
    // so any step still in flight has to bail out rather than stomp the user's actual finger
    // position.
    function playStep(trackEl: HTMLDivElement, index: number) {
      if (hasInteractedRef.current) return;
      if (index >= STEPS.length) {
        trackEl.style.transition = "";
        return;
      }
      trackEl.style.transition = `transform ${STEP_MS}ms ${EASE}`;
      trackEl.style.transform = `translateX(${STEPS[index]})`;
      window.setTimeout(() => playStep(trackEl, index + 1), STEP_MS);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        window.setTimeout(() => {
          const trackEl = trackRef.current;
          if (hasInteractedRef.current || !trackEl) return;
          playStep(trackEl, 0);
        }, VISIBLE_DELAY_MS);
      },
      { threshold: 0.6 },
    );
    observer.observe(viewportEl);
    return () => observer.disconnect();
  }, []);

  return markInteracted;
}
