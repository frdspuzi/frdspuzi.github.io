import { lazy, Suspense, useState } from "react";
import { Accordion } from "@/components/Accordion";
import { isDesktopWidthAtMount } from "@/lib/viewport";

// Lazy, not a plain import, unlike YoutubeFeed/InsightsWriting's own inner content (left eager —
// see git history: splitting those out made things *worse* here, since they share heavy
// dependencies — motion/tabs, the shader library — with code Masthead/the filter UI already need
// eagerly, and Vite's automatic shared-chunk extraction turned those into extra modulepreload'd
// chunks competing for the same throttled main thread instead of actually deferring anything;
// confirmed via two separate real Lighthouse runs both showing Total Blocking Time nearly
// tripling). PhotographyCanvas is different: it imports nothing but React hooks and the raw
// Unsplash JSON data (hundreds of photos' worth of metadata) — no shared dependency with
// anything eager, so splitting it out doesn't trigger that same shared-chunk problem.
const PhotographyCanvas = lazy(() =>
  import("@/components/PhotographyCanvas").then((m) => ({ default: m.PhotographyCanvas })),
);

// React port of photography.html. Reuses the shared Accordion (the 3rd and last of the
// groupable homepage sections) — only the Infinite Image Field canvas itself is section-specific.
export function Photography() {
  // Seeded from isDesktopWidthAtMount() directly (matches Accordion's own defaultOpen prop) so
  // desktop, where this section opens immediately, renders PhotographyCanvas from the very first
  // pass — no lazy delay there. onBeforeMeasure already exists on Accordion for a different
  // reason (letting a child resync its own measured height right before the open animation
  // reads scrollHeight) but fires at exactly the moment this also needs: the instant the section
  // starts to open for real. A one-way latch, not a live mirror of open/closed — once
  // PhotographyCanvas has rendered once, it stays mounted even if the section closes again,
  // rather than unmounting and losing its state.
  const [everOpened, setEverOpened] = useState(isDesktopWidthAtMount());
  return (
    <Accordion
      id="photography"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
      onBeforeMeasure={() => setEverOpened(true)}
      title={
        <h2
          id="photography"
          className="f2 fw-bold theme-fg"
          style={{ marginBottom: "0 !important", borderBottom: "none" }}
        >
          Photography
        </h2>
      }
      description={
        <>
          Shots I've captured and shared on{" "}
          <a
            href="https://unsplash.com/@frdspuzi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-underline"
          >
            Unsplash
          </a>
          .
        </>
      }
    >
      {everOpened && (
        <Suspense fallback={null}>
          <PhotographyCanvas />
        </Suspense>
      )}
    </Accordion>
  );
}
