import { lazy, Suspense, useState } from "react";
import { Accordion } from "@/components/Accordion";
import { isDesktopWidthAtMount } from "@/lib/viewport";
import trendingData from "../../../_data/trending.json";
import type { TrendingRepo } from "@/data/trending_types";

// Lazy so this section's own (small) chunk isn't shipped until opened - NOT dodging a new eager
// `motion` dependency the way PhotographyCanvas.tsx's split does, since `motion` is already
// unconditionally eager elsewhere (Masthead's shader background, MediumTray's pill tabs) - see
// GithubTrendingList.tsx's own comment for the corrected reasoning.
const GithubTrendingList = lazy(() =>
  import("@/components/GithubTrendingList").then((m) => ({ default: m.GithubTrendingList })),
);

// New homepage section, the 4th "groupable" one. Reuses the shared Accordion like the other 3 -
// unlike them, this has no Jekyll-era original to port from (built directly in component-lab).
export function GithubTrending() {
  const repos = (trendingData.repos ?? []) as TrendingRepo[];
  const [everOpened, setEverOpened] = useState(isDesktopWidthAtMount());

  return (
    <Accordion
      id="github-trending"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
      // onBeforeMeasure only fires on a REAL open transition (a click) - useAnimatedDisclosure's
      // isFirstRun path (the desktop defaultOpen-from-first-paint case, already handled by
      // everOpened's own useState initializer below) skips it entirely, so there's no double-
      // delay on first load. On a real transition, useAnimatedDisclosure captures scrollHeight
      // once, synchronously, right here, then locks the content to that height with
      // overflow:hidden until settle() releases it back to auto/visible - which happens via
      // anim.onfinish at OPEN_DURATION (580ms, confirmed in useAnimatedDisclosure.ts). Mounting
      // GithubTrendingList (and AnimatedList's own incremental-reveal growth) immediately here
      // would grow the content *during* that locked window - items added while `overflow:hidden`
      // holds the stale, one-card-tall measured height render clipped, then all pop into view at
      // once when settle() fires. That's exactly the "content growing post-measurement inside an
      // Accordion" class architecture.md's invariants #3/#4 warn about. Delaying past 580ms (a
      // 70ms buffer, not touching the shared Accordion/useAnimatedDisclosure code at all) means
      // AnimatedList only starts adding items once the container is already unlocked - the
      // stagger then just reflows a height:auto container normally, exactly as intended.
      onBeforeMeasure={() => {
        window.setTimeout(() => setEverOpened(true), 650);
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
      description="I used to doomscroll github.com/trending instead of shipping. This is that, but weekly and pre-digested — so refreshing a tab stops passing for research."
    >
      {repos.length === 0 ? (
        <p className="text-gray">No trending repos yet — check back after the next weekly run.</p>
      ) : (
        everOpened && (
          <Suspense fallback={null}>
            <GithubTrendingList repos={repos} />
          </Suspense>
        )
      )}
    </Accordion>
  );
}
