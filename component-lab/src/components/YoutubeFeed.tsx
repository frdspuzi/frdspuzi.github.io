import { useMemo, useRef, useState } from "react";
import { Accordion } from "@/components/Accordion";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { YoutubeCarousel, type YoutubeCarouselHandle } from "@/components/YoutubeCarousel";
import { isDesktopWidthAtMount } from "@/lib/viewport";
import { toSentenceCase } from "@/lib/utils";
import youtubeData from "../../../_data/youtube.json";
import type { YoutubeVideo } from "@/data/youtube_types";

// React port of youtube_feed.html. Reuses the shared Accordion (this is one of the 3 groupable
// homepage sections) instead of re-deriving the header/goo-popover/joined-border markup — only
// the swipeable video carousel itself (YoutubeCarousel) is section-specific.
//
// Category filter (Tabs, same beui.dev pill-tabs component InsightsWriting/MediumTray uses) is
// new — youtube.json already tracks a `category` per video, the original vanilla site just never
// surfaced it as a filter the way thoughts.html's Medium tray does. `key={activeFilter}` on
// YoutubeCarousel forces a clean remount on filter change (fresh currentIndex/shuffle) rather
// than threading a reset effect through its own state — simpler, and filter switches aren't
// frequent enough for the remount cost to matter.
//
// Deliberate simplification vs. the original: accordion.js's content-height resync while the
// section is already open (video swaps can change the info panel's height) isn't ported here.
// Our own useAnimatedDisclosure already clears the content height back to auto once its open
// animation settles (~1s after opening), well before a user could plausibly swipe — the original
// guarded a narrower race (a swap landing mid-animation) that isn't reachable through user
// interaction in practice.
export function YoutubeFeed() {
  const [activeFilter, setActiveFilter] = useState("all");
  const carouselRef = useRef<YoutubeCarouselHandle>(null);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const v of youtubeData.videos as YoutubeVideo[]) {
      if (v.category && !seen.includes(v.category)) seen.push(v.category);
    }
    return seen;
  }, []);

  if (!youtubeData.videos || youtubeData.videos.length === 0) return null;

  return (
    <Accordion
      id="reclaiming-algo"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
      onBeforeMeasure={() => carouselRef.current?.remeasure()}
      title={
        <h2
          id="reclaiming-algo"
          className="f2 fw-bold theme-fg"
          style={{ marginBottom: "0 !important", borderBottom: "none" }}
        >
          Reclaiming the Algo
        </h2>
      }
      description="A mindful feed of highly valuable, self-improvement videos extracted from select channels (bypassing the YouTube algorithm)."
    >
      {categories.length > 0 && (
        // No flex-justify-center wrapper needed: TabsList itself is full-width and centers its
        // own triggers internally (only when they fit without scrolling) — see that component's
        // own comments for why centering moved there instead of living on this outer element.
        <Tabs value={activeFilter} onValueChange={setActiveFilter} variant="pill">
          <TabsList className="mb-3">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {toSentenceCase(cat)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <YoutubeCarousel ref={carouselRef} key={activeFilter} activeFilter={activeFilter} />
    </Accordion>
  );
}
