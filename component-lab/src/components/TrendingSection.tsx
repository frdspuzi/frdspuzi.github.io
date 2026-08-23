import { useRef, useState } from "react";
import { Accordion } from "@/components/Accordion";
import { isDesktopWidthAtMount } from "@/lib/viewport";
import { TrendingCarousel, type TrendingCarouselHandle } from "@/components/TrendingCarousel";
import trendingData from "../../../_data/trending.json";
import type { TrendingRepo } from "@/data/trending_types";
import producthuntData from "../../../_data/producthunt.json";
import type { ProductHuntPost } from "@/data/producthunt_types";

// Renamed from GithubTrending.tsx (2026-08-22) once the section genuinely broadened to represent
// both open-source code AND product/startup launches, not just GitHub - see handoff.md's own entry
// for the full decision trail. The Accordion `id`/anchor stays "github-trending" unchanged (not
// renamed to match) to avoid breaking any existing deep link to this section - the id is an
// internal wiring detail, not something a visitor reads.
//
// One swipeable carousel with exactly 2 slides (GitHub, Product Hunt), not two separate per-item
// carousels - corrected 2026-08-23 after an earlier version of this feature built the wrong shape.
// Each list is passed in full and defaults to its own top-5-plus-"Load more" (see
// GithubTrendingList.tsx/ProductHuntList.tsx) - no more viewport-dependent count-matching here
// (matchedTrendingCount()/trendingCount.ts, removed 2026-08-23): both lists start at the same
// visible count by construction (5 each), and TrendingCarousel.tsx remeasures its own height
// whenever either list's "Load more" is toggled, so the swipe-consistency goal that motivated the
// old matching logic is now handled per-toggle instead of by capping the data up front.
//
// Eager, not React.lazy() - same reasoning as the old GithubTrending.tsx's own comment (small
// chunks, lazy-loading actively caused a scrollHeight-measurement race before). `everOpened` keeps
// the carousel unmounted until the section is actually opened once, on any viewport - not a
// lazy-loading mechanism, just avoids running TrendingCarousel's height-measurement pass for
// content nobody's looked at yet.
export function TrendingSection() {
  const repos = (trendingData.repos ?? []) as TrendingRepo[];
  const posts = (producthuntData.posts ?? []) as ProductHuntPost[];
  const [everOpened, setEverOpened] = useState(isDesktopWidthAtMount());
  const carouselRef = useRef<TrendingCarouselHandle>(null);

  return (
    <Accordion
      id="github-trending"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
      onBeforeMeasure={() => {
        setEverOpened(true);
        carouselRef.current?.remeasure();
      }}
      title={
        <h2
          id="github-trending"
          className="f2 fw-bold theme-fg"
          style={{ marginBottom: "0 !important", borderBottom: "none" }}
        >
          What the Internet's Building
        </h2>
      }
      description="I used to doomscroll github.com/trending and Product Hunt instead of shipping. This is that, but pre-digested — so refreshing a tab stops passing for research."
    >
      {repos.length === 0 && posts.length === 0 ? (
        <p className="text-gray">No trending data yet — check back after the next scheduled run.</p>
      ) : (
        everOpened && <TrendingCarousel ref={carouselRef} repos={repos} posts={posts} />
      )}
    </Accordion>
  );
}
