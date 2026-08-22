import { useState } from "react";
import { Accordion } from "@/components/Accordion";
import { isDesktopWidthAtMount } from "@/lib/viewport";
import { GithubTrendingList } from "@/components/GithubTrendingList";
import trendingData from "../../../_data/trending.json";
import type { TrendingRepo } from "@/data/trending_types";

// Eager, not React.lazy() (unlike an earlier version of this file) - GithubTrendingList's own
// chunk is small (~2.6kB, nowhere near PhotographyCanvas.tsx's 159kB, the case lazy-loading
// actually earns its keep for), and lazy-loading it was found to actively cause a real bug: the
// Suspense boundary resolves asynchronously, so on a real click-to-open, useAnimatedDisclosure's
// synchronous scrollHeight measurement fired while the Suspense fallback (null, zero height) was
// still showing - the real cards then mounted ~200ms later, after the open animation had already
// locked to that near-zero target. Confirmed via a real headless-browser click-to-open test
// sampling rendered card count over time. Removing the lazy boundary fixes this at the root
// (nothing async between the section opening and its real content existing) rather than patching
// around the timing with another delay.
export function GithubTrending() {
  const repos = (trendingData.repos ?? []) as TrendingRepo[];
  const [everOpened, setEverOpened] = useState(isDesktopWidthAtMount());

  return (
    <Accordion
      id="github-trending"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
      onBeforeMeasure={() => setEverOpened(true)}
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
        everOpened && <GithubTrendingList repos={repos} />
      )}
    </Accordion>
  );
}
