import { useRef, useState } from "react";
import { Accordion } from "@/components/Accordion";
import { isDesktopWidthAtMount } from "@/lib/viewport";
import { matchedTrendingCount } from "@/lib/trendingCount";
import { GithubTrendingCarousel } from "@/components/GithubTrendingCarousel";
import { ProductHuntCarousel } from "@/components/ProductHuntCarousel";
import type { TrendingCarouselHandle as GithubCarouselHandle } from "@/components/GithubTrendingCarousel";
import type { TrendingCarouselHandle as ProductHuntCarouselHandle } from "@/components/ProductHuntCarousel";
import trendingData from "../../../_data/trending.json";
import type { TrendingRepo } from "@/data/trending_types";
import producthuntData from "../../../_data/producthunt.json";
import type { ProductHuntPost } from "@/data/producthunt_types";

const MOBILE_COUNT = 5;

// Renamed from GithubTrending.tsx (2026-08-22) once the section genuinely broadened to represent
// both open-source code AND product/startup launches, not just GitHub - see handoff.md's own entry
// for the full decision trail. The Accordion `id`/anchor stays "github-trending" unchanged (not
// renamed to match) to avoid breaking any existing deep link to this section - the id is an
// internal wiring detail, not something a visitor reads.
//
// Both carousels: eager, not React.lazy() - same reasoning as the old GithubTrending.tsx's own
// comment (small chunks, lazy-loading actively caused a scrollHeight-measurement race before).
// `everOpened` keeps both carousels unmounted until the section is actually opened once, on any
// viewport - not a lazy-loading mechanism, just avoids running the height-measurement pass in
// GithubTrendingCarousel/ProductHuntCarousel for content nobody's looked at yet.
export function TrendingSection() {
  const allRepos = (trendingData.repos ?? []) as TrendingRepo[];
  const allPosts = (producthuntData.posts ?? []) as ProductHuntPost[];
  const [everOpened, setEverOpened] = useState(isDesktopWidthAtMount());
  const githubCarouselRef = useRef<GithubCarouselHandle>(null);
  const productHuntCarouselRef = useRef<ProductHuntCarouselHandle>(null);

  // Mobile always caps both lists to a fixed top 5. Desktop caps both to whichever source
  // currently has fewer items, so the two carousels always cover the same range rather than one
  // running noticeably deeper than the other - decided once at mount, matching this codebase's
  // existing isDesktopWidthAtMount() convention (no reactive resize-tracking elsewhere either).
  const isDesktop = isDesktopWidthAtMount();
  const visibleCount = isDesktop ? matchedTrendingCount(allRepos.length, allPosts.length) : MOBILE_COUNT;
  const repos = allRepos.slice(0, visibleCount);
  const posts = allPosts.slice(0, visibleCount);

  return (
    <Accordion
      id="github-trending"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
      onBeforeMeasure={() => {
        setEverOpened(true);
        githubCarouselRef.current?.remeasure();
        productHuntCarouselRef.current?.remeasure();
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
        everOpened && (
          <div className="d-flex flex-column" style={{ gap: 32 }}>
            {repos.length > 0 && (
              <div>
                <h3 className="f5 text-uppercase text-gray-light mb-2 tracking-wide" style={{ letterSpacing: 2 }}>
                  Trending on GitHub · weekly
                </h3>
                <GithubTrendingCarousel ref={githubCarouselRef} repos={repos} />
              </div>
            )}
            {posts.length > 0 && (
              <div>
                <h3 className="f5 text-uppercase text-gray-light mb-2 tracking-wide" style={{ letterSpacing: 2 }}>
                  Launched on Product Hunt · daily
                </h3>
                <ProductHuntCarousel ref={productHuntCarouselRef} posts={posts} />
              </div>
            )}
          </div>
        )
      )}
    </Accordion>
  );
}
