import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { useSquirclePath } from "@/hooks/useSquirclePath";
import { useSwipeHint } from "@/hooks/useSwipeHint";
import type { TrendingRepo } from "@/data/trending_types";

export type TrendingCarouselHandle = { remeasure: () => void };

// Swipe carousel, structurally modeled on YoutubeCarousel.tsx (state-driven currentIndex, a
// keyed prev/current/next window, imperative-refs-only for the drag physics) rather than
// TriviaBoard.tsx's fully-imperative approach - RepoCard has neither a video player lifecycle nor
// a reveal-answer state machine, so there's no need for TriviaBoard's innerHTML-built preview
// slides. Kept as its own self-contained copy rather than a shared hook with
// ProductHuntCarousel.tsx, matching this codebase's established convention for carousels (see
// architecture.md's Component Conventions) - the two sources' cards differ enough (avatar stack
// vs. thumbnail image, stars vs. votes) that a forced shared abstraction would fight its own
// content more than it would save.
//
// Replaces the previous GithubTrendingList.tsx's grid + "Load more"/"Show less" button UI - see
// handoff.md's 2026-08-22 entry for why (the section broadened to include Product Hunt, and both
// sources now present the same way for a consistent section identity).

const CLICK_DRAG_THRESHOLD = 8;
const SWIPE_COMMIT_THRESHOLD = 50;
const SWIPE_AXIS_LOCK_THRESHOLD = 10;
const SWIPE_SETTLE_MS = 250;
// Same reasoning as YoutubeCarousel's own SLIDE_GAP_PX - inset padding inside each 100%-wide slide
// slot, not a track-level gap, so the drag/transform math (always exactly 100% per slide) stays
// correct while adjacent cards still get visible space between them.
const SLIDE_GAP_PX = 10;

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
  // clip-path only affects painted content, not where a border is stroked - Primer's .Box border
  // would still draw as a plain rectangle right through the squircle's curved corners, visibly
  // wrong. Dropped in favor of the box-shadow (already present via box-shadow-small) for edge
  // definition instead - a shadow doesn't have this problem since it's derived from the actual
  // clipped shape, not a separately-stroked rectangle.
  const { ref: squircleRef, clipPath } = useSquirclePath(24);

  // The whole card is one <a>, same pattern as before this became a carousel - but now a drag
  // that ends back over the card would otherwise still fire a click and navigate away mid-swipe.
  // Same guard as YoutubeCarousel's VideoCard.handlePlayClick: suppress navigation only when a
  // real drag just happened, so click/Enter/middle-click still work normally for a real tap.
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
      // Without this, a browser interprets a mousedown-then-move on an <a href> as starting a
      // native link-drag (dragging the link itself, like dragging a bookmark) instead of
      // continuing to dispatch regular mousemove/mouseup - confirmed via a real headless-browser
      // drag test: startSwipe and one moveSwipe fired, then nothing, endSwipe never called, the
      // carousel silently stuck. No other carousel in this codebase wraps its whole draggable
      // surface in an anchor (YoutubeCarousel's VideoCard keeps the interactive parts as buttons
      // inside a plain div), so this is a new failure mode specific to this card's own <a>-wraps-
      // everything shape, not something the existing swipe-physics code had to account for before.
      draggable={false}
      style={{ textDecoration: "none", display: "block", width: "100%", height: "100%" }}
    >
      {/* Primer's `a` selector sets a real blue link color, cascading to every piece of text
          inside unless overridden - text-gray already covers the metadata/personalization lines,
          title/hook get explicit color: var(--fg) / var(--fg-muted), matching MediumTray's own
          .medium-title/.medium-excerpt fix for the identical problem. */}
      <div
        ref={squircleRef}
        className="Box box-shadow-small p-4 text-left"
        style={{ width: "100%", height: "100%", boxSizing: "border-box", border: "none", clipPath }}
      >
        {/* Row 1: identity - owner avatar, rank, repo name. */}
        <div className="d-flex flex-items-center mb-1" style={{ gap: 8, minWidth: 0, flexWrap: "wrap" }}>
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

        {/* Row 2: supporting metadata - contributor stack, language, star count. */}
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
  );
}

export const GithubTrendingCarousel = forwardRef<TrendingCarouselHandle, { repos: TrendingRepo[] }>(
  function GithubTrendingCarousel({ repos }, ref) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const isFirstRender = useRef(true);

    // Fixed viewport height, precomputed from the tallest card across the full set - same
    // approach as YoutubeCarousel's own maxCardHeight, measured off-screen using the real
    // RepoCard component so the measurement is pixel-identical to what actually renders.
    const [maxCardHeight, setMaxCardHeight] = useState<number | null>(null);
    const measureContainerRef = useRef<HTMLDivElement>(null);
    const dragDistanceRef = useRef(0);

    function measureNow() {
      const container = measureContainerRef.current;
      if (!container) return;
      const heights = Array.from(container.children).map((el) => (el as HTMLElement).offsetHeight);
      if (heights.length > 0) setMaxCardHeight(Math.max(...heights));
    }

    useLayoutEffect(() => {
      // Skipped when starting invisible (offsetWidth reads 0 - an ancestor accordion is closed)
      // for the same reason as YoutubeCarousel's identical guard - remeasure (below) covers the
      // real open transition synchronously instead.
      const container = measureContainerRef.current;
      if (!container || container.offsetWidth === 0) return;
      measureNow();
    }, []);

    useImperativeHandle(ref, () => ({ remeasure: measureNow }));

    const viewportRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const markSwipeInteracted = useSwipeHint(trackRef, viewportRef);

    function navigate(direction: 1 | -1) {
      setCurrentIndex((prev) => (prev + direction + repos.length) % repos.length);
    }

    useLayoutEffect(() => {
      if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
      }
      const trackEl = trackRef.current;
      if (!trackEl) return;
      trackEl.style.transition = "none";
      trackEl.style.transform = "translateX(-100%)";
      void trackEl.offsetWidth;
      trackEl.style.transition = "";
    }, [currentIndex]);

    useLayoutEffect(() => {
      const viewportEl = viewportRef.current;
      const trackEl = trackRef.current;
      if (!viewportEl || !trackEl || repos.length === 0) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let swiping = false;
      let swipeAxis: "horizontal" | "vertical" | null = null;
      let swipeStartX = 0;
      let swipeStartY = 0;
      let swipeLastX = 0;
      let swipeLastY = 0;

      function startSwipe(x: number, y: number) {
        swiping = true;
        swipeAxis = null;
        dragDistanceRef.current = 0;
        swipeStartX = x;
        swipeStartY = y;
        swipeLastX = x;
        swipeLastY = y;
        viewportEl!.style.cursor = "grabbing";
        markSwipeInteracted();
      }

      function moveSwipe(x: number, y: number) {
        if (!swiping) return;
        dragDistanceRef.current += Math.abs(x - swipeLastX) + Math.abs(y - swipeLastY);
        swipeLastX = x;
        swipeLastY = y;

        if (swipeAxis === null) {
          const totalX = Math.abs(swipeLastX - swipeStartX);
          const totalY = Math.abs(swipeLastY - swipeStartY);
          if (totalX + totalY > SWIPE_AXIS_LOCK_THRESHOLD) {
            swipeAxis = totalX > totalY ? "horizontal" : "vertical";
          }
        }
        if (swipeAxis === "vertical") return;

        if (!reduceMotion) {
          const dx0 = swipeLastX - swipeStartX;
          const maxDx = viewportEl!.getBoundingClientRect().width;
          const dx = Math.max(-maxDx, Math.min(maxDx, dx0));
          trackEl!.style.transform = "translateX(calc(-100% + " + dx + "px))";
        }
      }

      function endSwipe() {
        if (!swiping) return;
        swiping = false;
        viewportEl!.style.cursor = "grab";
        if (swipeAxis === "vertical") return;
        const netX = swipeLastX - swipeStartX;
        const committed = repos.length > 1 && Math.abs(netX) > SWIPE_COMMIT_THRESHOLD;

        if (!committed) {
          if (!reduceMotion) {
            trackEl!.style.transition = "transform " + SWIPE_SETTLE_MS + "ms ease-out";
            trackEl!.style.transform = "translateX(-100%)";
            setTimeout(() => {
              trackEl!.style.transition = "";
            }, SWIPE_SETTLE_MS);
          }
          return;
        }

        const direction: 1 | -1 = netX > 0 ? -1 : 1;

        if (reduceMotion) {
          navigate(direction);
          return;
        }

        const targetPercent = netX > 0 ? "0%" : "-200%";
        trackEl!.style.transition = "transform " + SWIPE_SETTLE_MS + "ms ease-out";
        trackEl!.style.transform = "translateX(" + targetPercent + ")";
        setTimeout(() => {
          navigate(direction);
        }, SWIPE_SETTLE_MS);
      }

      function onMouseDown(e: MouseEvent) {
        startSwipe(e.clientX, e.clientY);
      }
      function onMouseMove(e: MouseEvent) {
        moveSwipe(e.clientX, e.clientY);
      }
      function onTouchStart(e: TouchEvent) {
        if (e.touches.length !== 1) return;
        startSwipe(e.touches[0].clientX, e.touches[0].clientY);
      }
      function onTouchMove(e: TouchEvent) {
        if (!swiping || e.touches.length !== 1) return;
        moveSwipe(e.touches[0].clientX, e.touches[0].clientY);
        if (swipeAxis === "horizontal") e.preventDefault();
      }

      viewportEl.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", endSwipe);
      viewportEl.addEventListener("touchstart", onTouchStart, { passive: true });
      viewportEl.addEventListener("touchmove", onTouchMove, { passive: false });
      viewportEl.addEventListener("touchend", endSwipe);
      viewportEl.addEventListener("touchcancel", endSwipe);

      return () => {
        viewportEl.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", endSwipe);
        viewportEl.removeEventListener("touchstart", onTouchStart);
        viewportEl.removeEventListener("touchmove", onTouchMove);
        viewportEl.removeEventListener("touchend", endSwipe);
        viewportEl.removeEventListener("touchcancel", endSwipe);
      };
    }, [repos]);

    if (repos.length === 0) return null;

    const prevIndex = (currentIndex - 1 + repos.length) % repos.length;
    const nextIndex = (currentIndex + 1) % repos.length;
    // Same small-list key-collision handling as YoutubeCarousel - with very few repos, prev/next
    // can collide with current or each other; suffixing only the colliding slot keeps the
    // current<->prev/next identity handoff intact for the pairing that actually matters.
    const prevKey = prevIndex === currentIndex ? repos[prevIndex].fullName + "-prev" : repos[prevIndex].fullName;
    const nextKey =
      nextIndex === currentIndex || nextIndex === prevIndex
        ? repos[nextIndex].fullName + "-next"
        : repos[nextIndex].fullName;

    return (
      <div
        ref={viewportRef}
        style={{
          overflow: "hidden",
          position: "relative",
          cursor: "grab",
          userSelect: "none",
          height: maxCardHeight ? maxCardHeight + "px" : undefined,
        }}
      >
        <div
          ref={measureContainerRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            visibility: "hidden",
            pointerEvents: "none",
            top: 0,
            left: 0,
            width: "100%",
            zIndex: -1,
            padding: `0 ${SLIDE_GAP_PX}px`,
            boxSizing: "border-box",
          }}
        >
          {repos.map((r, i) => (
            <RepoCard key={r.fullName} repo={r} rank={i + 1} isActive={false} dragDistanceRef={dragDistanceRef} />
          ))}
        </div>

        <div ref={trackRef} style={{ display: "flex", height: "100%", transform: "translateX(-100%)" }}>
          <div key={prevKey} style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}>
            <RepoCard repo={repos[prevIndex]} rank={prevIndex + 1} isActive={false} dragDistanceRef={dragDistanceRef} />
          </div>
          <div
            key={repos[currentIndex].fullName}
            style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}
          >
            <RepoCard repo={repos[currentIndex]} rank={currentIndex + 1} isActive dragDistanceRef={dragDistanceRef} />
          </div>
          <div key={nextKey} style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}>
            <RepoCard repo={repos[nextIndex]} rank={nextIndex + 1} isActive={false} dragDistanceRef={dragDistanceRef} />
          </div>
        </div>
      </div>
    );
  },
);
