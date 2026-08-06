import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

// React port of accordion-grouping.js + accordion-mobile-single-open.js — both coordinate STATE
// ACROSS SIBLING accordion sections (which one is open affects the others' joined-border classes
// and, on mobile, forces others closed). The vanilla version did this via DOM queries across
// independent <details> elements; in React this is the natural "lift state up" case instead —
// one provider tracks every accordion's open/closed state, each <Accordion> just reads/writes it.
//
// Mobile single-open + scroll-into-view applies to every accordion registered here (matches
// accordion-mobile-single-open.js targeting ALL details.animated-details, e.g. Gratitude too).
// Joined-border modifiers (group-joined-top/bottom) only apply to accordions that opt in via
// `groupable` (the 3 main homepage sections) — matches accordion-grouping.js's own scoping to
// .js-accordion-group specifically, a narrower set than the mobile-single-open behavior.
const OPEN_MS = 580; // matches accordion.js's own OPEN.duration exactly

type AccordionGroupState = {
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  register: (id: string, groupable: boolean, el: HTMLElement | null) => void;
  isJoinedTop: (id: string) => boolean;
  isJoinedBottom: (id: string) => boolean;
  // Called by <Accordion>'s own effect once it observes itself transitioning to open — state
  // setters (toggle, above) stay pure; this is the one place that actually schedules a timer/
  // touches the DOM, kept separate on purpose.
  scrollIntoViewIfMobile: (id: string) => void;
};

const AccordionGroupContext = createContext<AccordionGroupState | null>(null);

export function AccordionGroupProvider({ children }: { children: ReactNode }) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  // Registration order matters for computing joined-top/bottom (needs to know each accordion's
  // immediate neighbor) — same as accordion-grouping.js's own "one contiguous list" assumption.
  const orderRef = useRef<string[]>([]);
  const groupableRef = useRef<Record<string, boolean>>({});
  const elRef = useRef<Record<string, HTMLElement | null>>({});

  const register = useCallback((id: string, groupable: boolean, el: HTMLElement | null) => {
    if (!orderRef.current.includes(id)) orderRef.current.push(id);
    groupableRef.current[id] = groupable;
    elRef.current[id] = el;
  }, []);

  const isOpen = useCallback((id: string) => !!openMap[id], [openMap]);

  const toggle = useCallback((id: string) => {
    setOpenMap((prev) => {
      const opening = !prev[id];
      const next = { ...prev, [id]: opening };

      // Mobile-only: opening one closes every other currently-open accordion (regardless of
      // `groupable` — matches the original targeting every details.animated-details, not just
      // the 3 grouped ones).
      if (opening && window.matchMedia("(max-width: 767px)").matches) {
        orderRef.current.forEach((otherId) => {
          if (otherId !== id) next[otherId] = false;
        });
      }
      return next;
    });
  }, []);

  // Scroll-into-view after OPEN_MS once a section opens on mobile — same delay reasoning as the
  // original (waits for both this section's expansion and any auto-closed sibling's collapse to
  // settle before measuring position). Reduced motion skips the delay entirely, matching
  // accordion.js never animating for those users either. Called from <Accordion>'s own effect,
  // not from toggle() above, so the state update itself stays a pure reducer.
  const scrollIntoViewIfMobile = useCallback((id: string) => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = elRef.current[id];
    if (!el) return;
    window.setTimeout(
      () => {
        el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      },
      reduceMotion ? 0 : OPEN_MS,
    );
  }, []);

  const isJoinedTop = useCallback(
    (id: string) => {
      if (!groupableRef.current[id] || openMap[id]) return false;
      const idx = orderRef.current.indexOf(id);
      const prevId = idx > 0 ? orderRef.current[idx - 1] : null;
      return !!prevId && groupableRef.current[prevId] === true && !openMap[prevId];
    },
    [openMap],
  );

  const isJoinedBottom = useCallback(
    (id: string) => {
      if (!groupableRef.current[id] || openMap[id]) return false;
      const idx = orderRef.current.indexOf(id);
      const nextId = idx < orderRef.current.length - 1 ? orderRef.current[idx + 1] : null;
      return !!nextId && groupableRef.current[nextId] === true && !openMap[nextId];
    },
    [openMap],
  );

  const value = useMemo(
    () => ({ isOpen, toggle, register, isJoinedTop, isJoinedBottom, scrollIntoViewIfMobile }),
    [isOpen, toggle, register, isJoinedTop, isJoinedBottom, scrollIntoViewIfMobile],
  );

  return <AccordionGroupContext.Provider value={value}>{children}</AccordionGroupContext.Provider>;
}

export function useAccordionGroup() {
  const ctx = useContext(AccordionGroupContext);
  if (!ctx) throw new Error("useAccordionGroup must be used within an AccordionGroupProvider");
  return ctx;
}

export { OPEN_MS };
