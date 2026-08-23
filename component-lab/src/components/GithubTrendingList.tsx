import { useSquirclePath } from "@/hooks/useSquirclePath";
import type { TrendingRepo } from "@/data/trending_types";

const CLICK_DRAG_THRESHOLD = 8;

// One panel/slide of TrendingCarousel.tsx (not a carousel itself, despite the pre-2026-08-23
// history of this filename - the swipe mechanic now lives one level up, between this panel and
// ProductHuntList.tsx's, not between individual repos within this one). `isActive`/
// `dragDistanceRef` come from the outer carousel: isActive gates tab reachability (this panel is
// only ever fully visible half the time - GithubTrendingList vs. ProductHuntList), and
// dragDistanceRef is the same click-vs-drag guard every card needs since the whole panel sits
// inside the outer carousel's draggable viewport - see RepoCard's own comment for why.
function RepoCard({
  repo,
  rank,
  isActive,
  dragDistanceRef,
}: {
  repo: TrendingRepo;
  rank: number;
  isActive: boolean;
  dragDistanceRef: React.MutableRefObject<number>;
}) {
  const { ref: squircleRef, clipPath } = useSquirclePath(24);

  // A drag that ends back over this card would otherwise still fire a click and navigate away
  // mid-swipe (or after landing on the other panel) - suppress navigation only when the outer
  // carousel's drag actually moved past the threshold, so a real tap still works normally.
  function handleClick(e: React.MouseEvent) {
    if (dragDistanceRef.current > CLICK_DRAG_THRESHOLD) {
      e.preventDefault();
    }
  }

  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={isActive ? 0 : -1}
      onClick={isActive ? handleClick : (e) => e.preventDefault()}
      // Required, not cosmetic - without this a mousedown-then-move starting on the card hijacks
      // into a native link-drag instead of continuing to drive the outer carousel's swipe. See
      // architecture.md's Component Conventions for the full story (found via a real headless-
      // browser test, 2026-08-22).
      draggable={false}
      style={{ textDecoration: "none", display: "block", width: "100%" }}
    >
      <div
        ref={squircleRef}
        className="Box box-shadow-small p-4 text-left"
        style={{ width: "100%", boxSizing: "border-box", border: "none", clipPath }}
      >
        <div className="d-flex flex-items-center mb-3" style={{ gap: 8, minWidth: 0, flexWrap: "wrap" }}>
          {repo.ownerAvatarUrl && (
            <img
              src={repo.ownerAvatarUrl}
              alt=""
              width={28}
              height={28}
              className="rounded-full flex-shrink-0"
              loading="lazy"
              draggable={false}
            />
          )}
          <h3 className="trending-card-title text-bold lh-condensed mb-0" style={{ color: "var(--fg)", minWidth: 0 }}>
            <span className="text-gray" style={{ fontWeight: 400 }}>#{rank}</span> {repo.fullName}
          </h3>
        </div>

        <div className="trending-card-meta text-gray d-flex flex-items-center mb-2" style={{ gap: 8, flexWrap: "wrap" }}>
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
                  draggable={false}
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

        <p className="trending-card-hook mb-2" style={{ color: "var(--fg-muted)" }}>{repo.hook}</p>

        {repo.personalization && (
          <p className="trending-card-personalization text-gray mb-0" style={{ fontStyle: "italic" }}>
            {repo.personalization}
          </p>
        )}
      </div>
    </a>
  );
}

export function GithubTrendingList({
  repos,
  isActive,
  dragDistanceRef,
}: {
  repos: TrendingRepo[];
  isActive: boolean;
  dragDistanceRef: React.MutableRefObject<number>;
}) {
  return (
    <div className="d-flex flex-column" style={{ gap: 16, width: "100%" }}>
      <h3 className="f5 text-uppercase text-gray-light mb-0 tracking-wide" style={{ letterSpacing: 2 }}>
        Trending on GitHub · weekly
      </h3>
      {repos.map((repo, i) => (
        <RepoCard key={repo.fullName} repo={repo} rank={i + 1} isActive={isActive} dragDistanceRef={dragDistanceRef} />
      ))}
    </div>
  );
}
