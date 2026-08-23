import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { useSwipeHint } from "@/hooks/useSwipeHint";
import { GithubTrendingList } from "@/components/GithubTrendingList";
import { ProductHuntList } from "@/components/ProductHuntList";
import type { TrendingRepo } from "@/data/trending_types";
import type { ProductHuntPost } from "@/data/producthunt_types";

export type TrendingCarouselHandle = { remeasure: () => void };

// The one swipeable carousel for "What the Internet's Building" - exactly 2 fixed slides (GitHub,
// Product Hunt), not one carousel per source swiping through individual items (2026-08-23
// correction - an earlier version built two separate per-item carousels instead, which wasn't
// what was actually asked for). Each slide is a full list (GithubTrendingList/ProductHuntList),
// both defaulting to top-5 with a single SHARED "Load more" toggle (2026-08-23 - was two
// independent per-list flags at first, changed so swiping to the other slide always shows it in
// the same expanded/collapsed state, not whatever that slide happened to be left in). Tracked here
// (not inside each List) so a toggle can trigger remeasureNow() - the offscreen measure copies
// read the same expanded state as the visible track copies, so growing both lists' visible counts
// and remeasuring keeps the carousel's own height accurate without a swipe being required.
//
// Swipe physics are the same imperative-refs shape as YoutubeCarousel.tsx (state-driven
// currentIndex, keyed prev/current/next window, drag handled outside React's render cycle) - with
// only 2 real positions instead of N, prevIndex and nextIndex always collide on "the other slide",
// which is exactly the small-list edge case YoutubeCarousel's own key-suffixing already handles,
// reused unmodified here.

const SWIPE_COMMIT_THRESHOLD = 50;
const SWIPE_AXIS_LOCK_THRESHOLD = 10;
const SWIPE_SETTLE_MS = 250;
const SLIDE_GAP_PX = 10;
// Same insurance as TriviaBoard.tsx's own MEASURE_SAFETY_BUFFER_PX, same underlying cause: a
// small, real gap between the offscreen measurement pass and the real rendered layout. Here it's
// specifically because the "Load more" button's height:100%+marginTop:"auto" bottom-pinning
// (GithubTrendingList.tsx/ProductHuntList.tsx) can only take effect once the flex column's own
// height:100% resolves against a *definite* parent height - which is exactly the number this
// measurement is computing, so the offscreen pass (parent height still indefinite at that point)
// measures a few px short of what the real stretched-and-pinned layout ends up needing. Confirmed
// via real measurement: the button clipped 9px past the carousel viewport's bottom edge in the
// expanded state before this buffer was added. This is deliberately just rounding insurance, not
// the button's actual bottom padding - that's real, explicit paddingBottom on each List's own root
// (see GithubTrendingList.tsx/ProductHuntList.tsx), a separate concern this buffer can't cover
// since marginTop:"auto" always consumes 100% of whatever extra height this buffer adds, as blank
// space *above* the button, never room *below* it - bumping this value alone doesn't give the
// button breathing room, it was a dead end tried before the real paddingBottom fix.
const MEASURE_SAFETY_BUFFER_PX = 12;

const SLIDE_IDS = ["github", "producthunt"] as const;
type SlideId = (typeof SLIDE_IDS)[number];

function Slide({
  id,
  repos,
  posts,
  isActive,
  dragDistanceRef,
  expanded,
  onToggleExpanded,
}: {
  id: SlideId;
  repos: TrendingRepo[];
  posts: ProductHuntPost[];
  isActive: boolean;
  dragDistanceRef: React.MutableRefObject<number>;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  return id === "github" ? (
    <GithubTrendingList
      repos={repos}
      isActive={isActive}
      dragDistanceRef={dragDistanceRef}
      expanded={expanded}
      onToggleExpanded={onToggleExpanded}
    />
  ) : (
    <ProductHuntList
      posts={posts}
      isActive={isActive}
      dragDistanceRef={dragDistanceRef}
      expanded={expanded}
      onToggleExpanded={onToggleExpanded}
    />
  );
}

export const TrendingCarousel = forwardRef<
  TrendingCarouselHandle,
  { repos: TrendingRepo[]; posts: ProductHuntPost[] }
>(function TrendingCarousel({ repos, posts }, ref) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isFirstRender = useRef(true);

  const [maxSlideHeight, setMaxSlideHeight] = useState<number | null>(null);
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const dragDistanceRef = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = () => setExpanded((e) => !e);

  function measureNow() {
    const container = measureContainerRef.current;
    if (!container) return;
    const heights = Array.from(container.children).map((el) => (el as HTMLElement).offsetHeight);
    if (heights.length > 0) setMaxSlideHeight(Math.max(...heights) + MEASURE_SAFETY_BUFFER_PX);
  }

  useLayoutEffect(() => {
    const container = measureContainerRef.current;
    if (!container || container.offsetWidth === 0) return;
    measureNow();
  }, []);

  // Re-measure whenever the shared expanded state changes - the offscreen measure copies below
  // read the same expanded state as the visible track copies, so by the time this runs (post-DOM-
  // update, pre-paint) they already reflect the new item count.
  useLayoutEffect(() => {
    if (isFirstRender.current) return; // covered by the mount effect above
    measureNow();
  }, [expanded]);

  useImperativeHandle(ref, () => ({ remeasure: measureNow }));

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const markSwipeInteracted = useSwipeHint(trackRef, viewportRef);

  function navigate(direction: 1 | -1) {
    setCurrentIndex((prev) => (prev + direction + SLIDE_IDS.length) % SLIDE_IDS.length);
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
    if (!viewportEl || !trackEl) return;

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
      const committed = Math.abs(netX) > SWIPE_COMMIT_THRESHOLD;

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
  }, []);

  const prevIndex = (currentIndex - 1 + SLIDE_IDS.length) % SLIDE_IDS.length;
  const nextIndex = (currentIndex + 1) % SLIDE_IDS.length;
  // With exactly 2 slides, prevIndex and nextIndex always collide on "the other one" - same
  // small-list key-collision handling as YoutubeCarousel, unavoidable here rather than an edge
  // case, so both peek slots are always suffixed.
  const prevKey = SLIDE_IDS[prevIndex] + "-prev";
  const nextKey = SLIDE_IDS[nextIndex] + "-next";

  return (
    <div>
      {/* Reuses TriviaBoard's own .trivia-dot/.trivia-dot.active CSS - same "which of a small,
          fixed set of pages am I on" affordance, just React-rendered instead of imperatively
          built (this carousel already keeps currentIndex as real state, no need for
          TriviaBoard's own DOM-building approach here). */}
      <div className="d-flex flex-justify-center mb-3">
        <div className="d-flex flex-items-center" style={{ gap: 6 }}>
          {SLIDE_IDS.map((id, i) => (
            <div key={id} className={"trivia-dot" + (i === currentIndex ? " active" : "")}></div>
          ))}
        </div>
      </div>

      <div
        ref={viewportRef}
        style={{
          overflow: "hidden",
          position: "relative",
          cursor: "grab",
          userSelect: "none",
          height: maxSlideHeight ? maxSlideHeight + "px" : undefined,
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
        {SLIDE_IDS.map((id) => (
          <div key={id}>
            <Slide
              id={id}
              repos={repos}
              posts={posts}
              isActive={false}
              dragDistanceRef={dragDistanceRef}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
            />
          </div>
        ))}
      </div>

      <div ref={trackRef} style={{ display: "flex", height: "100%", transform: "translateX(-100%)" }}>
        <div key={prevKey} style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}>
          <Slide
            id={SLIDE_IDS[prevIndex]}
            repos={repos}
            posts={posts}
            isActive={false}
            dragDistanceRef={dragDistanceRef}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
          />
        </div>
        <div key={SLIDE_IDS[currentIndex]} style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}>
          <Slide
            id={SLIDE_IDS[currentIndex]}
            repos={repos}
            posts={posts}
            isActive
            dragDistanceRef={dragDistanceRef}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
          />
        </div>
        <div key={nextKey} style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}>
          <Slide
            id={SLIDE_IDS[nextIndex]}
            repos={repos}
            posts={posts}
            isActive={false}
            dragDistanceRef={dragDistanceRef}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
          />
        </div>
      </div>
      </div>
    </div>
  );
});
