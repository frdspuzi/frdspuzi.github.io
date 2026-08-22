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

type AccordionGroupState = {
  // `defaultOpen` is a fallback for ids never explicitly toggled yet — the caller (<Accordion>)
  // always knows its own defaultOpen prop synchronously and passes it directly, so this is
  // correct from the very first render. Previously the initial state was seeded by a mount
  // effect calling toggle() a render late, which made `open` visibly lag true by one render for
  // every defaultOpen accordion — the root cause of this session's whole run of accordion bugs
  // (a spurious close-then-reopen flash, a stale animation clobbering that fix, then React's own
  // reactive display style racing the imperative animation). Removing the lag removes all of it.
  isOpen: (id: string, defaultOpen?: boolean) => boolean;
  toggle: (id: string, defaultOpen?: boolean) => void;
  register: (id: string, groupable: boolean, defaultOpen: boolean, el: HTMLElement | null) => void;
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
  // Only read by isJoinedTop/Bottom below, for a *different* id than the one asking — that case
  // can't take defaultOpen as a direct call argument the way isOpen/toggle do, since it doesn't
  // have access to the neighbor's own prop value.
  const defaultOpenRef = useRef<Record<string, boolean>>({});
  const elRef = useRef<Record<string, HTMLElement | null>>({});
  // register() only mutates the refs above — cheap, but that also means it never causes a
  // re-render on its own. Every accordion registers from its own mount effect, which fires
  // *after* the very first render, so isJoinedTop/isJoinedBottom below (computed during render)
  // see empty orderRef/groupableRef on that first pass and every section reads as having no
  // groupable neighbor — a real bug, not just a first-frame flicker: nothing re-renders these
  // consumers afterward until the *first* toggle() anywhere changes openMap, so a page that's
  // never been interacted with stays stuck showing every section as a separate, gapped card
  // instead of the joined list. This counter exists purely to force that recompute once
  // registration data is actually populated — bumped by every register() call; React 18 batches
  // the 3 near-simultaneous mount-effect calls (one per homepage section) into a single re-render.
  const [registerVersion, setRegisterVersion] = useState(0);

  const register = useCallback(
    (id: string, groupable: boolean, defaultOpen: boolean, el: HTMLElement | null) => {
      if (!orderRef.current.includes(id)) orderRef.current.push(id);
      groupableRef.current[id] = groupable;
      defaultOpenRef.current[id] = defaultOpen;
      elRef.current[id] = el;
      setRegisterVersion((v) => v + 1);
    },
    [],
  );

  const isOpen = useCallback(
    (id: string, defaultOpen = false) => (id in openMap ? openMap[id] : defaultOpen),
    [openMap],
  );

  const toggle = useCallback((id: string, defaultOpen = false) => {
    setOpenMap((prev) => {
      const currentlyOpen = id in prev ? prev[id] : defaultOpen;
      const opening = !currentlyOpen;
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

  // Scroll-into-view once a section opens on mobile, once the page has actually finished
  // settling — NOT a fixed OPEN_MS delay (a real, prior version of this function). OPEN_MS alone
  // matches this accordion's own WAAPI open-animation duration, which is right for sections whose
  // content is already fully sized the instant they open, but wrong for sections whose content
  // keeps growing past that point (an image canvas still loading, avatar images still resolving,
  // a ResizeObserver-driven layout recalculating) — confirmed via real headless-browser
  // measurement: Photography settled at top:662px instead of 0, a GithubTrending section settled
  // at top:546px instead of 0, both on a genuine first open, both landing correctly only on a
  // second open once that same content was already loaded/settled from the first time.
  //
  // ResizeObserver on document.body, debounced, is the actual settlement signal - it keeps firing
  // for as long as ANYTHING on the page is still resizing (this accordion's own open animation,
  // a sibling's auto-close on mobile single-open, slow-loading content inside), and the scroll
  // only fires once a DEBOUNCE_MS gap has passed with no further resize activity. MAX_WAIT_MS is
  // a hard ceiling so a page that never fully stops (unlikely, but not provably impossible) can't
  // leave the scroll stuck forever - it fires anyway once the ceiling is hit, same "good enough"
  // floor the old fixed-delay version already accepted.
  //
  // Doesn't need this file's own architecture.md invariant #4 (ResizeObserver + a `> 0` height
  // guard) - that guard exists specifically for observers watching an element an ancestor's
  // display:none can hide (which reports a stale 0). document.body is never itself hidden by an
  // ancestor, so its scrollHeight is never spuriously 0 the way a hidden accordion's own content
  // element would be.
  const scrollIntoViewIfMobile = useCallback((id: string) => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = elRef.current[id];
    if (!el) return;

    if (reduceMotion) {
      el.scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }

    const DEBOUNCE_MS = 150;
    const MAX_WAIT_MS = 2500;
    let settled = false;
    let debounceTimer: number;

    const doScroll = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(maxWaitTimer);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const observer = new ResizeObserver(() => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(doScroll, DEBOUNCE_MS);
    });
    observer.observe(document.body);
    // Armed immediately too, in case nothing ever resizes at all (a section whose content was
    // already fully sized before this even ran) - without this, doScroll would only ever fire
    // via the MAX_WAIT_MS ceiling for that case, turning an instant scroll into a 2.5s stall.
    debounceTimer = window.setTimeout(doScroll, DEBOUNCE_MS);
    const maxWaitTimer = window.setTimeout(doScroll, MAX_WAIT_MS);
  }, []);

  const effectiveOpenById = useCallback(
    (id: string) => (id in openMap ? openMap[id] : !!defaultOpenRef.current[id]),
    [openMap],
  );

  // registerVersion in both dep arrays, unused inside the callback bodies themselves — its only
  // job is forcing a new function reference (and so a new context value, via the useMemo below)
  // once registration data that these callbacks read from refs has actually changed. Without it
  // these would keep the exact same reference across the mount-time registrations, since
  // effectiveOpenById (their only "real" dependency) doesn't change until the first toggle.
  const isJoinedTop = useCallback(
    (id: string) => {
      if (!groupableRef.current[id] || effectiveOpenById(id)) return false;
      const idx = orderRef.current.indexOf(id);
      const prevId = idx > 0 ? orderRef.current[idx - 1] : null;
      return !!prevId && groupableRef.current[prevId] === true && !effectiveOpenById(prevId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveOpenById, registerVersion],
  );

  const isJoinedBottom = useCallback(
    (id: string) => {
      if (!groupableRef.current[id] || effectiveOpenById(id)) return false;
      const idx = orderRef.current.indexOf(id);
      const nextId = idx < orderRef.current.length - 1 ? orderRef.current[idx + 1] : null;
      return !!nextId && groupableRef.current[nextId] === true && !effectiveOpenById(nextId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveOpenById, registerVersion],
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
