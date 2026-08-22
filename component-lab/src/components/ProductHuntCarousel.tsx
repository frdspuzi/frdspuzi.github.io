import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { useSquirclePath } from "@/hooks/useSquirclePath";
import { useSwipeHint } from "@/hooks/useSwipeHint";
import type { ProductHuntPost } from "@/data/producthunt_types";

export type TrendingCarouselHandle = { remeasure: () => void };

// Swipe carousel, structurally identical to GithubTrendingCarousel.tsx (same swipe physics, same
// prev/current/next window, same click-vs-drag guard) but kept as its own self-contained file per
// this codebase's carousel convention (see that file's own top comment for why) - the two cards
// differ enough in content (a real product thumbnail vs. a small owner avatar; maker avatars +
// vote count vs. contributor avatars + star count) that sharing a generic card component would
// need as many content-shape branches as just having two cards.

const CLICK_DRAG_THRESHOLD = 8;
const SWIPE_COMMIT_THRESHOLD = 50;
const SWIPE_AXIS_LOCK_THRESHOLD = 10;
const SWIPE_SETTLE_MS = 250;
const SLIDE_GAP_PX = 10;

function ProductCard({
  post,
  isActive,
  dragDistanceRef,
}: {
  post: ProductHuntPost;
  isActive: boolean;
  dragDistanceRef: React.MutableRefObject<number>;
}) {
  const { ref: squircleRef, clipPath } = useSquirclePath(24);

  function handleClick(e: React.MouseEvent) {
    if (dragDistanceRef.current > CLICK_DRAG_THRESHOLD) {
      e.preventDefault();
    }
  }

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={isActive ? 0 : -1}
      onClick={isActive ? handleClick : (e) => e.preventDefault()}
      // See GithubTrendingCarousel's identical prop for why this is required, not cosmetic - a
      // native link-drag silently swallows the swipe gesture otherwise (confirmed via a real
      // headless-browser test on that carousel).
      draggable={false}
      style={{ textDecoration: "none", display: "block", width: "100%", height: "100%" }}
    >
      <div
        ref={squircleRef}
        className="Box box-shadow-small p-4 text-left"
        style={{ width: "100%", height: "100%", boxSizing: "border-box", border: "none", clipPath }}
      >
        {/* Product Hunt has a real visual (a launch thumbnail/screenshot) GitHub repos don't -
            shown full-width above the text, the same "real signal over text" call the swipe
            carousel format has room for that the old grid card didn't. */}
        {post.thumbnailUrl && (
          <img
            src={post.thumbnailUrl}
            alt=""
            loading="lazy"
            className="rounded-2"
            // draggable is per-element, not inherited - the parent <a>'s draggable={false} above
            // doesn't cover this img, which defaults to natively draggable on its own and (being
            // the largest element in the card, right where a drag typically starts) was
            // confirmed via a real headless-browser test to swallow the swipe gesture the same
            // way the unfixed <a> did before.
            draggable={false}
            style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", marginBottom: 12 }}
          />
        )}

        {/* Row 1: identity - rank, product name. No owner avatar the way GitHub has one (a
            product doesn't have a single "owner" the way a repo does) - the maker stack below
            already covers "who built this." */}
        <div className="d-flex flex-items-center mb-1" style={{ gap: 8, minWidth: 0, flexWrap: "wrap" }}>
          <h3 className="trending-card-title text-bold lh-condensed mb-0" style={{ color: "var(--fg)", minWidth: 0 }}>
            <span className="text-gray" style={{ fontWeight: 400 }}>#{post.dailyRank}</span> {post.name}
          </h3>
        </div>

        {/* Row 2: supporting metadata - maker stack, first topic tag, vote count. Same overlapping
            avatar-stack pattern as GithubTrendingCarousel's contributor stack. */}
        <div className="trending-card-meta text-gray d-flex flex-items-center mb-2" style={{ gap: 8, flexWrap: "wrap" }}>
          {post.makerAvatarUrls.length > 0 && (
            <span className="d-flex flex-shrink-0">
              {post.makerAvatarUrls.slice(0, 4).map((url, i) => (
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
          {post.topics[0] && <span>{post.topics[0]}</span>}
          <span>▲ {post.votesCount.toLocaleString()} votes</span>
        </div>

        {/* Row 3: the description (hook). */}
        <p className="trending-card-hook mb-1" style={{ color: "var(--fg-muted)" }}>{post.hook}</p>

        {/* Row 4: the suggestion (personalization), when there's a genuine one. */}
        {post.personalization && (
          <p className="trending-card-personalization text-gray mb-0" style={{ fontStyle: "italic" }}>
            {post.personalization}
          </p>
        )}
      </div>
    </a>
  );
}

export const ProductHuntCarousel = forwardRef<TrendingCarouselHandle, { posts: ProductHuntPost[] }>(
  function ProductHuntCarousel({ posts }, ref) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const isFirstRender = useRef(true);

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
      const container = measureContainerRef.current;
      if (!container || container.offsetWidth === 0) return;
      measureNow();
    }, []);

    useImperativeHandle(ref, () => ({ remeasure: measureNow }));

    const viewportRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const markSwipeInteracted = useSwipeHint(trackRef, viewportRef);

    function navigate(direction: 1 | -1) {
      setCurrentIndex((prev) => (prev + direction + posts.length) % posts.length);
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
      if (!viewportEl || !trackEl || posts.length === 0) return;

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
        const committed = posts.length > 1 && Math.abs(netX) > SWIPE_COMMIT_THRESHOLD;

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
    }, [posts]);

    if (posts.length === 0) return null;

    const prevIndex = (currentIndex - 1 + posts.length) % posts.length;
    const nextIndex = (currentIndex + 1) % posts.length;
    const prevKey = prevIndex === currentIndex ? posts[prevIndex].name + "-prev" : posts[prevIndex].name;
    const nextKey =
      nextIndex === currentIndex || nextIndex === prevIndex ? posts[nextIndex].name + "-next" : posts[nextIndex].name;

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
          {posts.map((p) => (
            <ProductCard key={p.name} post={p} isActive={false} dragDistanceRef={dragDistanceRef} />
          ))}
        </div>

        <div ref={trackRef} style={{ display: "flex", height: "100%", transform: "translateX(-100%)" }}>
          <div key={prevKey} style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}>
            <ProductCard post={posts[prevIndex]} isActive={false} dragDistanceRef={dragDistanceRef} />
          </div>
          <div key={posts[currentIndex].name} style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}>
            <ProductCard post={posts[currentIndex]} isActive dragDistanceRef={dragDistanceRef} />
          </div>
          <div key={nextKey} style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}>
            <ProductCard post={posts[nextIndex]} isActive={false} dragDistanceRef={dragDistanceRef} />
          </div>
        </div>
      </div>
    );
  },
);
