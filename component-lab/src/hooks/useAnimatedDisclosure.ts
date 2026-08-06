import { useLayoutEffect, useRef } from "react";

// Shared WAAPI bounce open/close (same curves/durations as accordion.js — see DESIGN.md's Motion
// section). Extracted out of Accordion.tsx so Gratitude's plain <details>-style disclosure (own
// header markup, same open/close mechanic) doesn't duplicate this ~35-line animation — matches
// the original site's own split: accordion.js's animation logic was always shared across every
// .animated-details, only the header HTML per include ever differed.
//
// This hook is the *sole* owner of `content.style.display` (and height/padding/overflow) for the
// element it's attached to — the JSX rendering that element must never also set a `display`
// style, reactively or otherwise. React writes its own inline styles synchronously during commit,
// before this hook's effect runs; a reactively-set `display` would already be flipped to `none`
// (or already visible at full, unclipped height) by the time the animation below tries to
// measure/transition it, breaking the animation outright. useLayoutEffect (not useEffect) so the
// very first correction — and every later one — happens before the browser paints, so owning this
// exclusively still never produces a flash of the wrong state.
export const OPEN_DURATION = 580;
export const CLOSE_DURATION = 460;
const OPEN: KeyframeAnimationOptions = {
  duration: OPEN_DURATION,
  easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  fill: "forwards",
};
const CLOSE: KeyframeAnimationOptions = {
  duration: CLOSE_DURATION,
  easing: "cubic-bezier(0.4, 0, 1, 1)",
  fill: "forwards",
};

export function useAnimatedDisclosure(open: boolean, onOpened?: () => void) {
  const contentRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const guardId = useRef(0);
  const isFirstRun = useRef(true);

  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    // The very first time this runs is always the *resting* initial state (open or closed —
    // `open` is correct from render 1 now, no lag; see useAccordionGroup's isOpen/toggle), never
    // a real transition — matches the original's native `<details open>`, which is simply
    // already open on first paint with no animation ever; only a later click (accordion.js's own
    // click handler) animates.
    if (isFirstRun.current) {
      isFirstRun.current = false;
      content.style.display = open ? "" : "none";
      if (open) onOpened?.();
      return;
    }

    if (reduceMotion) {
      content.style.display = open ? "" : "none";
      if (open) onOpened?.();
      return;
    }

    const thisGuard = ++guardId.current;
    function settle(isClose: boolean) {
      if (thisGuard !== guardId.current) return; // superseded by a newer toggle
      animRef.current?.cancel();
      content!.style.height = "";
      content!.style.paddingTop = "";
      content!.style.paddingBottom = "";
      content!.style.overflow = "";
      if (isClose) content!.style.display = "none";
    }

    if (open) {
      content.style.display = "";
      const target = content.scrollHeight;
      const computed = getComputedStyle(content);
      const padTop = computed.paddingTop;
      const padBottom = computed.paddingBottom;
      content.style.overflow = "hidden";
      const anim = content.animate(
        [
          { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" },
          { height: `${target}px`, opacity: 1, paddingTop: padTop, paddingBottom: padBottom },
        ],
        OPEN,
      );
      animRef.current = anim;
      anim.onfinish = () => settle(false);
      anim.oncancel = () => settle(false);
      window.setTimeout(() => settle(false), OPEN_DURATION + 400);
      onOpened?.();
    } else if (content.style.display !== "none") {
      const current = content.scrollHeight;
      const computed = getComputedStyle(content);
      const padTop = computed.paddingTop;
      const padBottom = computed.paddingBottom;
      content.style.overflow = "hidden";
      const anim = content.animate(
        [
          { height: `${current}px`, opacity: 1, paddingTop: padTop, paddingBottom: padBottom },
          { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" },
        ],
        CLOSE,
      );
      animRef.current = anim;
      anim.onfinish = () => settle(true);
      anim.oncancel = () => settle(true);
      window.setTimeout(() => settle(true), CLOSE_DURATION + 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return contentRef;
}
