"use client";
// beui.dev/components/motion/tabs

import { motion, MotionConfig, useReducedMotion, type Transition } from "motion/react";
import { createContext, useCallback, useContext, useId, useMemo, useState, type ReactNode } from "react";
import { useHorizontalScrollFade } from "@/hooks/useHorizontalScrollFade";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type Variant = "pill" | "underline" | "segment";

type Ctx = {
  value: string;
  setValue: (v: string) => void;
  layoutId: string;
  variant: Variant;
};

const TabsCtx = createContext<Ctx | null>(null);

function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error("Tabs.* must be used inside <Tabs>");
  return ctx;
}

// Weighty spring for the active-tab indicator: a touch of overshoot so it
// settles with life instead of snapping.
const transition: Transition = {
  type: "spring",
  stiffness: 170,
  damping: 24,
  mass: 1.2,
};

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  variant = "pill",
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const layoutId = useId();
  const reduce = useReducedMotion();
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const setValue = useCallback(
    (v: string) => {
      if (!controlled) setInternal(v);
      onValueChange?.(v);
    },
    [controlled, onValueChange],
  );
  const contextValue = useMemo(
    () => ({ value: current, setValue, layoutId, variant }),
    [current, layoutId, setValue, variant],
  );
  return (
    <MotionConfig transition={reduce ? { duration: 0 } : transition}>
      <TabsCtx.Provider value={contextValue}>
        {/* layoutRoot: the indicator's layoutId measures in page coordinates, so
            inside fixed/scrolled containers it would replay scroll offsets as
            movement. The pill only ever travels within the list, so scoping
            projection to the Tabs wrapper is always correct. */}
        <motion.div layoutRoot className={className}>
          {children}
        </motion.div>
      </TabsCtx.Provider>
    </MotionConfig>
  );
}

// bg-card/border-border swapped for this site's own CSS custom properties, not shadcn's —
// shadcn's tokens only flip for dark mode via a `.dark` ancestor class, which nothing on this
// site ever sets (it uses its own `[data-theme="dark"]` attribute instead) — same fix already
// applied to preview-rail.tsx for the same reason.
// overflow-x-auto + flex-nowrap on pill/segment (not underline, which doesn't share this
// problem): both use one continuously-rounded background wrapping every trigger as a single
// shape, which only reads correctly as a single row — wrapped onto 2-3 rows on a narrow screen,
// rounded-full's corner radius stretches into an odd tall capsule instead of looking like several
// rows of buttons. Scrolling horizontally instead keeps the pill shape correct at any width; a
// non-scrolling row plus overflow-hidden would just clip triggers with no way to reach them.
// Scrollbar hidden (both properties needed - scrollbar-width for Firefox, ::-webkit-scrollbar
// for Chrome/Safari/Edge), same convention as .custom-scrollbar's own mobile treatment elsewhere
// on this site: a visible horizontal scrollbar track adds its own height below the pills, so the
// gradient overlay (which spans this element's full height) ends up taller than the pills
// themselves, visibly misaligned. Hiding it removes that extra space entirely - the fade+scroll
// gesture is the intended affordance here anyway, not a visible track.
// inline-flex + max-w-full, not a forced w-full: the pill's own rounded background should hug
// its triggers (shrink-to-fit) and only grow up to the row's full width once it actually needs
// to. An earlier version of this forced the row to always be full-width to fix what looked like
// a centering bug in the Medium tray — that turned out to be a real, separate bug one level up
// (.right-column-content silently rendering wider than its own parent column; see that fix in
// site.scss) that made the *reference frame* wrong, not this row's shrink-to-fit sizing. With
// the reference frame now correctly bounded, centering a shrink-wrapped pill inside a full-width
// *wrapper* (TabsList's own outer div, via flex justify-center) is what actually gives the
// "hugs its content, but centered in the available space" look — not stretching the pill itself.
const listClasses: Record<Variant, string> = {
  pill: "inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--surface)] p-1 overflow-x-auto flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  underline: "inline-flex items-center gap-1 border-b border-[var(--border)]",
  segment: "inline-flex max-w-full items-center gap-0 rounded-lg bg-[var(--surface)] p-0.5 overflow-x-auto flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
};

// Fade hint at the scroll edges, pill/segment only: overflow-x-auto (above) fixed the "odd tall
// capsule" shape when triggers don't fit in one row, but scrolling instead of wrapping traded
// away visibility of what's off-screen - "Fin..." just gets cut off flush with the container edge,
// no signal that Finance/Islamic studies/etc. are reachable by scrolling. The gradient fades the
// last visible pill toward the container's own background color, the standard "there's more here"
// cue (same idea as a horizontally-scrolling app store row). Tracked via real scroll position, not
// just "always show at the end" - so it disappears once you've actually scrolled all the way,
// rather than permanently implying more content that isn't there.
export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  const { variant } = useTabs();
  const scrollable = variant === "pill" || variant === "segment";
  // Shared with the Medium mobile story tray (useHorizontalScrollFade) - see that hook's own
  // comment for the full list of bugs this mechanism already went through and fixed once.
  const { scrollRef, canScrollLeft, canScrollRight, contentHeight: tablistHeight } =
    useHorizontalScrollFade<HTMLDivElement>();

  if (!scrollable) {
    return (
      <div role="tablist" className={cn(listClasses[variant], className)}>
        {children}
      </div>
    );
  }

  const edgeRadiusLeft = variant === "pill" ? "rounded-l-full" : "rounded-l-lg";
  const edgeRadiusRight = variant === "pill" ? "rounded-r-full" : "rounded-r-lg";

  return (
    // w-full + flex justify-center on the WRAPPER, not the scrollable row itself: this is what
    // centers a shrink-wrapped pill within the full-width space its column actually has, without
    // needing the pill's own background to stretch to fill it (see listClasses' own comment).
    // min-w-0 for the same reason as always - this wrapper is a flex item of Tabs' own container,
    // and flex items default to min-width: auto (won't shrink below content's natural size).
    <div className="relative flex min-w-0 w-full justify-center">
      <div role="tablist" ref={scrollRef} className={cn(listClasses[variant], className)}>
        {children}
      </div>
      <span
        aria-hidden="true"
        // w-12 (48px), not w-8: short trigger labels like "Fin[ance]" are barely wider than a
        // 32px fade zone, so almost the whole visible word sat inside it - technically fading,
        // but with no un-faded text before the fade starts, it just read as the same abrupt
        // cutoff as before rather than a perceptible transition.
        // z-20, explicit: TabsTrigger's own button has z-10 (needed so its text/pill-color
        // indicator stack correctly within itself) - without an explicit, higher z-index here,
        // this gradient (z-index: auto) was rendering underneath the buttons despite coming
        // later in DOM order, invisible even with every measured value (opacity, height,
        // position) otherwise correct.
        className={cn("pointer-events-none absolute left-0 top-0 z-20 w-12 transition-opacity duration-200", edgeRadiusLeft)}
        style={{
          height: tablistHeight ?? undefined,
          background: "linear-gradient(to right, var(--surface), transparent)",
          opacity: canScrollLeft ? 1 : 0,
        }}
      />
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute right-0 top-0 z-20 w-12 transition-opacity duration-200", edgeRadiusRight)}
        style={{
          height: tablistHeight ?? undefined,
          background: "linear-gradient(to left, var(--surface), transparent)",
          opacity: canScrollRight ? 1 : 0,
        }}
      />
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  indicatorClassName,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  indicatorClassName?: string;
}) {
  const { value: current, setValue, layoutId, variant } = useTabs();
  const active = current === value;

  if (variant === "underline") {
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setValue(value)}
        className={cn(
          "relative isolate px-3 pb-2.5 pt-1 -mb-px text-sm font-medium transition-colors min-h-[44px] inline-flex items-center",
          active ? "text-[var(--fg)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
          className,
        )}
      >
        {children}
        {active ? (
        <motion.span
          layoutId={layoutId}
          className={cn(
            "absolute -bottom-px left-0 right-0 h-px bg-[var(--accent-solid)]",
            indicatorClassName,
          )}
        />
        ) : null}
      </button>
    );
  }

  const radius = variant === "pill" ? "rounded-full" : "rounded-md";

  return (
    <div className="relative">
      {active ? (
        <motion.span
          layoutId={layoutId}
          style={{ borderRadius: variant === "pill" ? 9999 : 8 }}
          className={cn(
            "absolute inset-0 bg-[var(--accent-solid)]",
            radius,
            indicatorClassName,
          )}
        />
      ) : null}
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setValue(value)}
        className={cn(
          "relative z-10 inline-flex items-center justify-center whitespace-nowrap bg-transparent px-3.5 py-1.5 text-sm font-medium outline-none",
          "transition-colors",
          // white, not a token: matches .medium-filter-btn.active's own existing color: white
          // for text sitting on the same --accent-solid fill elsewhere on this site.
          active
            ? "text-white"
            : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
          radius,
          className,
        )}
      >
        {children}
      </button>
    </div>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value: current } = useTabs();
  const reduce = useReducedMotion();
  const active = current === value;
  // Inactive panels stay mounted but hidden, so their content (e.g. source
  // code) is present in the server-rendered HTML for crawlers and assistive
  // tech, instead of being dropped from the DOM.
  if (!active) {
    return (
      <div hidden className={className}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      key={value}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className={cn("mt-4", className)}
    >
      {children}
    </motion.div>
  );
}
