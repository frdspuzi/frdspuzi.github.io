import { Accordion } from "@/components/Accordion";
import { YoutubeCarousel } from "@/components/YoutubeCarousel";
import { isDesktopWidthAtMount } from "@/lib/viewport";
import youtubeData from "../../../_data/youtube.json";

// React port of youtube_feed.html. Reuses the shared Accordion (this is one of the 3 groupable
// homepage sections) instead of re-deriving the header/goo-popover/joined-border markup — only
// the swipeable video carousel itself (YoutubeCarousel) is section-specific.
//
// Deliberate simplification vs. the original: accordion.js's content-height resync while the
// section is already open (video swaps can change the info panel's height) isn't ported here.
// Our own useAnimatedDisclosure already clears the content height back to auto once its open
// animation settles (~1s after opening), well before a user could plausibly swipe — the original
// guarded a narrower race (a swap landing mid-animation) that isn't reachable through user
// interaction in practice.
export function YoutubeFeed() {
  if (!youtubeData.videos || youtubeData.videos.length === 0) return null;

  return (
    <Accordion
      id="reclaiming-algo"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
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
      <YoutubeCarousel />
    </Accordion>
  );
}
