import { useState } from "react";
import { motion } from "motion/react";
import { useSquirclePath } from "@/hooks/useSquirclePath";
import type { TrendingRepo } from "@/data/trending_types";

const INITIAL_COUNT = 10;

// Kept as its own file (not inlined into GithubTrending.tsx) for readability, NOT for a
// React.lazy() split - an earlier version lazy-loaded this, which turned out to actively cause a
// bug (see GithubTrending.tsx's own comment: the Suspense boundary's async resolution raced
// useAnimatedDisclosure's synchronous scrollHeight measurement). This file's own chunk was only
// ~2.6kB - nowhere near PhotographyCanvas.tsx's 159kB, the case where deferring actually earns
// its keep - so eager-importing it costs effectively nothing and removes the race entirely.
//
// Originally built on MagicUI's real AnimatedList component (per this repo's component-sourcing
// rule - checked registries before hand-porting), but that component's own reveal mechanism is a
// pure time-based cascade (mounts one child every `delay`ms, regardless of scroll position) - it
// doesn't know or care whether anyone's actually looking. On real user feedback ("fix to load on
// scroll") this was replaced with `whileInView` per card instead: each card only animates in when
// it's actually scrolled into the viewport, genuinely tied to scroll position rather than a clock.
// Deviation called out explicitly here per architecture.md's own convention for exactly this case.
function RepoCard({ repo, rank }: { repo: TrendingRepo; rank: number }) {
  // clip-path only affects painted content, not where a border is stroked - Primer's .Box border
  // would still draw as a plain rectangle right through the squircle's curved corners, visibly
  // wrong. Dropped in favor of the box-shadow (already present via box-shadow-small) for edge
  // definition instead - a shadow doesn't have this problem since it's derived from the actual
  // clipped shape, not a separately-stroked rectangle.
  const { ref: squircleRef, clipPath } = useSquirclePath(24);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ type: "spring", stiffness: 350, damping: 40, delay: 1 }}
      style={{ transformOrigin: "top center" }}
    >
      <a
        href={repo.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: "none", display: "block", width: "100%" }}
      >
        {/* The whole card is one <a> (same pattern MediumTray's RowCard uses) - Primer's `a`
            selector sets a real blue link color, and that cascades to every piece of text inside
            unless something overrides it back. text-gray already did that for the metadata/
            personalization lines, but the title and hook text had nothing overriding it - fine in
            dark mode (close enough to the theme's own foreground color not to stand out much),
            genuinely broken-looking in light mode (every line of text rendering as an underline-
            free but still obviously-blue hyperlink). Matches MediumTray's own fix for the same
            problem (.medium-title/.medium-excerpt in site.scss) - explicit color: var(--fg) /
            var(--fg-muted) on anything that isn't already covered by text-gray. */}
        <div
          ref={squircleRef}
          className="Box box-shadow-small p-4 text-left"
          style={{ width: "100%", border: "none", clipPath }}
        >
          {/* Four deliberate rows (real user feedback: the original one generic flex-wrap row
              fragmented unpredictably into 4 rows anyway once wrapping kicked in on mobile, but
              grouped nothing on purpose - avatar+rank landed alone, name alone, contributor stack
              alone). Explicit rows group what actually belongs together instead of leaving it to
              wherever flex-wrap happens to break. */}

          {/* Row 1: identity - owner avatar, rank, repo name. minWidth: 0 is the standard flexbox
              fix that lets this row's own content wrap/shrink instead of forcing the row wider
              than the card (a flex child's default min-width is its content's natural width). */}
          <div className="d-flex flex-items-center mb-1" style={{ gap: 8, minWidth: 0, flexWrap: "wrap" }}>
            {repo.ownerAvatarUrl && (
              <img
                src={repo.ownerAvatarUrl}
                alt=""
                width={28}
                height={28}
                className="rounded-full flex-shrink-0"
                loading="lazy"
              />
            )}
            <h3
              className="trending-card-title text-bold lh-condensed mb-0"
              style={{ color: "var(--fg)", minWidth: 0 }}
            >
              <span className="text-gray" style={{ fontWeight: 400 }}>#{rank}</span> {repo.fullName}
            </h3>
          </div>

          {/* Row 2: supporting metadata - contributor stack, language, star count. All secondary
              context about the repo, grouped together rather than split across two rows. */}
          <div className="trending-card-meta text-gray d-flex flex-items-center mb-2" style={{ gap: 8, flexWrap: "wrap" }}>
            {/* Real "Built by" avatars, honest about what they are - never a "+N" count, since
                GitHub's own page caps this list regardless of true contributor count (confirmed
                against real data - see fetch_github.js's own comment). A small overlapping stack
                reads as "some people worked on this," not a specific claim. Pattern matches the
                one at 21st.dev/@originui/components/avatar/group-of-avatars (flex + negative
                spacing + ring border) - simple enough to hand-build directly rather than install,
                per this repo's own "don't over-engineer" convention. */}
            {repo.contributorAvatarUrls.length > 0 && (
              <span className="d-flex flex-shrink-0">
                {repo.contributorAvatarUrls.slice(0, 4).map((url, i) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    width={18}
                    height={18}
                    loading="lazy"
                    className="rounded-full"
                    style={{
                      marginLeft: i === 0 ? 0 : -6,
                      border: "2px solid var(--surface-page)",
                      zIndex: 4 - i,
                      position: "relative",
                    }}
                  />
                ))}
              </span>
            )}
            {repo.language && <span>{repo.language}</span>}
            <span>★ {repo.starsThisWeek.toLocaleString()} this week</span>
          </div>

          {/* Row 3: the description (hook). */}
          <p className="trending-card-hook mb-1" style={{ color: "var(--fg-muted)" }}>{repo.hook}</p>

          {/* Row 4: the suggestion (personalization), when there's a genuine one. */}
          {repo.personalization && (
            <p className="trending-card-personalization text-gray mb-0" style={{ fontStyle: "italic" }}>
              {repo.personalization}
            </p>
          )}
        </div>
      </a>
    </motion.div>
  );
}

// Top INITIAL_COUNT shown immediately (fewer DOM nodes up front than rendering all 18), the rest
// behind a single expand/collapse toggle button rather than auto-revealing on scroll - a real,
// deliberate switch away from an earlier scroll-triggered version. That version kept needing
// tuning (batch size, trigger margin) to avoid cascading through most of the list on a single
// tall viewport (confirmed via a real scripted test: 15 of 18 loaded within 800ms of opening even
// after fixing the margin once) - a button sidesteps all of that ambiguity entirely: it
// loads/collapses exactly when clicked, nothing else to tune. Doesn't contradict "show
// everything, no curation" - every repo is still one click away, just not auto-mounted. Cards
// past INITIAL_COUNT unmount on collapse (not just visually hidden), so `whileInView`'s
// `once: true` on RepoCard replays the entrance animation fresh each time they're re-expanded,
// rather than only ever animating in once for the whole page lifetime.
export function GithubTrendingList({ repos }: { repos: TrendingRepo[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = expanded ? repos.length : Math.min(INITIAL_COUNT, repos.length);
  const visibleRepos = repos.slice(0, visibleCount);
  const hiddenCount = repos.length - visibleCount;

  return (
    <div className="d-flex flex-column" style={{ gap: 16, width: "100%" }}>
      {visibleRepos.map((repo, i) => (
        <RepoCard key={repo.fullName} repo={repo} rank={i + 1} />
      ))}
      {(hiddenCount > 0 || expanded) && repos.length > INITIAL_COUNT && (
        <button
          type="button"
          className="btn"
          style={{ alignSelf: "center" }}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Show less" : `Load ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
