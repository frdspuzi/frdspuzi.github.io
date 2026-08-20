import { AnimatedList } from "@/components/ui/animated-list";
import type { TrendingRepo } from "@/data/trending_types";

// Split out of GithubTrending.tsx so this can be lazy-loaded until the section actually opens —
// unlike PhotographyCanvas.tsx's split, this ISN'T dodging a shared-eager-chunk problem: `motion`
// itself is already unconditionally eager (shader-background.tsx for Masthead, tabs.tsx for
// MediumTray both import it directly, no lazy boundary anywhere for either). What this defers is
// only this file's own small chunk (~6kB) - a plain "don't ship below-the-fold JS until it's
// needed" call, not the PhotographyCanvas-style "avoid a shared-chunk regression" one. Confirmed
// via a real build: dist/assets/GithubTrendingList-*.js is its own separate chunk.
function RepoCard({ repo }: { repo: TrendingRepo }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none", display: "block", width: "100%" }}
    >
      <div className="Box box-shadow-small p-3 text-left" style={{ width: "100%" }}>
        <div className="d-flex flex-justify-between flex-items-start mb-1" style={{ gap: 8 }}>
          <h3 className="f4 text-bold lh-condensed mb-0">{repo.fullName}</h3>
          <span className="f6 text-gray flex-shrink-0 d-flex flex-items-center" style={{ gap: 8 }}>
            {repo.language && <span>{repo.language}</span>}
            <span>★ {repo.starsThisWeek.toLocaleString()} this week</span>
          </span>
        </div>
        <p className="f6 mb-1">{repo.hook}</p>
        {repo.personalization && <p className="f6 text-gray mb-0" style={{ fontStyle: "italic" }}>{repo.personalization}</p>}
      </div>
    </a>
  );
}

// Fed the real, un-repeated repo list directly - AnimatedList plays through it once (staggered
// entrance, ~every `delay`ms) and stops; it does NOT loop on its own despite the demo's own
// "notification feed" example looking like it does (that demo manually repeats a 4-item array
// 10x to fake an endless stream - confirmed by reading the actual component source, not assumed
// from the docs). No fixed-height/overflow wrapper here either, for the same reason: this list is
// meant to be read in full at your own pace, not a fixed-height ambient feed with a fade-out.
export function GithubTrendingList({ repos }: { repos: TrendingRepo[] }) {
  return (
    <AnimatedList delay={120} className="items-stretch w-full">
      {repos.map((repo) => (
        <RepoCard key={repo.fullName} repo={repo} />
      ))}
    </AnimatedList>
  );
}
