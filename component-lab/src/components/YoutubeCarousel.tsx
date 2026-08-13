import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { useSwipeHint } from "@/hooks/useSwipeHint";
import { toSentenceCase } from "@/lib/utils";

export type YoutubeCarouselHandle = { remeasure: () => void };
import youtubeData from "../../../_data/youtube.json";
import type { YoutubeVideo, YTPlayer } from "@/data/youtube_types";

// React port of youtube_feed.html's <script>. Originally transliterated close to 1:1 (imperative
// DOM mutation for the "current" card, a separate buildPreviewSlideHtml() raw-HTML-string builder
// for the prev/next peek slides) - that dual-rendering-path design was the root cause of a real,
// user-visible "not seamless" swap discrepancy (a padding !important fight was one provable bug;
// the peek slides also used a completely different thumbnail technique - background-image div vs
// this file's own <img>+CSS-class facade - a second latent source of drift between what you see
// mid-swipe and what you get once it settles). Rebuilt around a single VideoCard component
// instead: prev/current/next all render the *same* component, keyed by video id, so React's
// keyed-list reconciliation moves/preserves each card's state as the 3-video window slides rather
// than ever running two different code paths for "the same" card. Peek cards are inert (not
// clickable/focusable) until they become active - see VideoCard's isActive prop.
//
// The swipe/drag physics stay imperative (unchanged sequencing-sensitive code, moving trackEl's
// transform outside any render cycle) - see the big useLayoutEffect below. See DESIGN.md's Motion
// section for why each specific number/technique is what it is.

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
}

function isShortVideo(video: YoutubeVideo) {
  return !!(video.url && video.url.includes("/shorts/"));
}

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => 0.5 - Math.random());
}

const CLICK_DRAG_THRESHOLD = 8;
const SWIPE_COMMIT_THRESHOLD = 50;
const SWIPE_AXIS_LOCK_THRESHOLD = 10;
const SWIPE_SETTLE_MS = 250;
// Horizontal inset applied inside every slide slot (not a track-level `gap`, which would push
// each slide's flex-basis past the 100% the drag/transform math above assumes). Since each slide
// is still exactly 100% of the track's width, box-sizing: border-box padding on the *inside* of a
// slide keeps its outer edges flush with its neighbors while insetting the actual card - so two
// adjacent cards' padding combines into a visible gap between them, with no transform math to
// adjust. Without this, adjacent cards touched with zero space between them, so the current
// card's own rounded corners had nothing behind them but the next card's square edge - reading as
// an unrounded gray smudge rather than a corner. This exposes the page's own background there
// instead.
const SLIDE_GAP_PX = 10;

// Module-scoped singleton loader for the YouTube IFrame API script - shared across every
// VideoCard instance (only ever one at a time actually creates a player, but which instance that
// is changes as the user swipes, so the load can't be tied to one hardcoded card the way the
// original's single "current" card let it be).
type YTApiCallback = () => void;
let ytApiState: "idle" | "loading" | "ready" = "idle";
const ytApiCallbacks: YTApiCallback[] = [];

function requestYouTubeApi(callback: YTApiCallback) {
  if (ytApiState === "ready") {
    callback();
    return;
  }
  ytApiCallbacks.push(callback);
  if (ytApiState !== "idle") return;
  ytApiState = "loading";
  window.onYouTubeIframeAPIReady = () => {
    ytApiState = "ready";
    ytApiCallbacks.splice(0).forEach((cb) => cb());
  };
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName("script")[0];
  firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);
}

function VideoCard({
  video,
  isActive,
  dragDistanceRef,
  onNavigate,
}: {
  video: YoutubeVideo;
  isActive: boolean;
  dragDistanceRef: React.MutableRefObject<number>;
  onNavigate: (direction: 1 | -1) => void;
}) {
  const [showFacade, setShowFacade] = useState(true);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  // Never show a live player for a peeked (non-active) card - always inert facade there,
  // regardless of whether this exact video was previously playing before a swipe carried it out
  // of the center slot. Swapping back in re-requests a fresh player rather than resuming; matches
  // the original's own "switching mid-playback via swipe isn't supported" behavior.
  const showingPlayer = isActive && !showFacade;

  useEffect(() => {
    if (!showingPlayer) return;
    let cancelled = false;
    requestYouTubeApi(() => {
      if (cancelled || ytPlayerRef.current || !playerContainerRef.current) return;
      ytPlayerRef.current = new window.YT.Player(playerContainerRef.current, {
        videoId: video.videoId,
        playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1, autoplay: 1 },
        events: {
          onReady: () => {
            if (pendingSeekRef.current !== null) {
              ytPlayerRef.current!.seekTo(pendingSeekRef.current, true);
              pendingSeekRef.current = null;
            }
          },
          onStateChange: (event) => {
            if (event.data === 5 || event.data === 1) {
              const duration = ytPlayerRef.current?.getDuration();
              if (duration && duration > 0) setVideoDuration(duration);
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      ytPlayerRef.current?.destroy?.();
      ytPlayerRef.current = null;
    };
  }, [showingPlayer, video.videoId]);

  function handlePlayClick() {
    if (dragDistanceRef.current > CLICK_DRAG_THRESHOLD) return;
    setShowFacade(false);
  }

  function handleSeek(t: number) {
    setShowFacade(false);
    if (ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(t, true);
      ytPlayerRef.current.playVideo();
    } else {
      pendingSeekRef.current = t;
    }
  }

  function handleFacadeKeydown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onNavigate(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onNavigate(1);
    }
  }

  const isShort = isShortVideo(video);
  const isMobileNow = window.matchMedia("(max-width: 767px)").matches;
  const keepFacadeLandscape = isShort && isMobileNow && !showingPlayer;
  const isPortrait = isShort && !keepFacadeLandscape;
  // Self-hosted, not hotlinked from i.ytimg.com: that CDN sets no meaningful cache-control
  // headers and contributes a third-party cookie, both real Lighthouse Best Practices/Performance
  // findings. fetch_youtube.js downloads this for every video actually in the final feed before
  // youtube.json is ever written, so by the time a videoId appears in the data, its thumbnail is
  // already committed alongside it - no fallback to the remote URL needed.
  const thumbUrl = "/assets/youtube-thumbnails/" + video.videoId + ".jpg";
  const timestamps = video.timestamps || [];
  // Optimistic (shows everything) until the player reports a real duration, then filters out any
  // timestamp past the end - same behavior as the original's renderTimestamps(), just expressed
  // as derived state instead of an imperative re-render of the timestamps list.
  const visibleTimestamps =
    videoDuration === null ? timestamps : timestamps.filter((ts) => (ts.startTime ?? ts.time ?? 0) <= videoDuration);

  return (
    <div
      className="Box box-shadow-large theme-surface theme-border"
      style={{ borderRadius: 12, padding: "24px 24px 36px", height: "100%", boxSizing: "border-box" }}
    >
      <div className="d-flex flex-column flex-lg-row flex-items-center" style={{ gap: 32, height: "100%", boxSizing: "border-box" }}>
        <div
          className="col-12 col-lg-6 flex-shrink-0"
          style={
            isPortrait
              ? { aspectRatio: "9/16", maxWidth: 320, margin: "0 auto", borderRadius: 8, overflow: "hidden", position: "relative" }
              : { aspectRatio: "16/9", maxWidth: "100%", margin: 0, borderRadius: 8, overflow: "hidden", position: "relative" }
          }
        >
          {/* Both always mounted, visibility toggled by CSS rather than conditionally rendering
              one or the other — critical for the player container specifically. The real
              YouTube IFrame API doesn't render *into* the element it's given; per its own docs
              it *replaces* that element outright with an <iframe>, detaching the original div
              from the DOM without React's knowledge. If this div were conditionally unmounted
              (the swipe-away path — the VideoCard instance itself persists via its keyed slot,
              React just re-renders it with isActive: false), React would try to remove a node
              it thinks is still attached where it left it, throw `NotFoundError: Failed to
              execute 'removeChild' on 'Node': The node to be removed is not a child of this
              node` (already detached from under it), and crash the whole tree uncaught — the
              exact "swipe away after pressing play shows a blank page" bug this fixes. Keeping
              this div permanently in the same JSX position means React's reconciliation never
              revisits it once handed off, regardless of what the YT API does inside it. */}
          <div
            ref={playerContainerRef}
            style={{ width: "100%", height: "100%", display: showingPlayer ? "block" : "none" }}
          />
          <button
            type="button"
            className={"yt-facade" + (keepFacadeLandscape ? " yt-facade-short" : "")}
            aria-label="Play video"
            tabIndex={isActive ? 0 : -1}
            onClick={isActive ? handlePlayClick : undefined}
            onKeyDown={isActive ? handleFacadeKeydown : undefined}
            style={{ display: showingPlayer ? "none" : undefined }}
          >
            <img className="yt-facade-thumb" src={thumbUrl} alt={video.title} />
            <span className="yt-facade-play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28">
                <path d="M8 5v14l11-7z" fill="#fff"></path>
              </svg>
            </span>
          </button>
        </div>

        <div className="col-12 col-lg-6 d-flex flex-column flex-justify-center text-left">
          <div className="mb-2">
            <span
              className="d-inline-block text-uppercase text-bold f6"
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                backgroundColor: "var(--accent-bg)",
                color: "var(--accent)",
                border: "1px solid var(--accent-border)",
                letterSpacing: "0.5px",
              }}
            >
              {toSentenceCase(video.category)}
            </span>
          </div>

          <h3 className="f3 mb-2 lh-condensed theme-fg" style={{ fontWeight: 600 }}>
            {video.title}
          </h3>

          <p className="f5 mb-3 text-gray">
            By <strong>{video.channel}</strong>
          </p>

          <div className="flash yt-flash mb-4" style={{ borderColor: "var(--border)", borderRadius: 8 }}>
            <p className="f5 mb-0" style={{ lineHeight: 1.6, color: "var(--fg)" }}>
              {video.summary}
            </p>

            {visibleTimestamps.length > 0 && (
              <>
                <div className="mt-3">
                  <strong className="f6 text-gray-light">Key Moments:</strong>
                </div>
                <div className="mt-2 f6">
                  {visibleTimestamps.map((ts, i) => {
                    const t = ts.startTime ?? ts.time ?? 0;
                    return (
                      <button
                        key={i}
                        type="button"
                        className="btn-link text-left d-block f6 mb-2"
                        style={{
                          color: "var(--accent)",
                          textDecoration: "none",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          lineHeight: 1.4,
                          width: "100%",
                          padding: 0,
                        }}
                        tabIndex={isActive ? 0 : -1}
                        onClick={isActive ? () => handleSeek(t) : undefined}
                      >
                        <span style={{ display: "flex", gap: 6 }}>
                          <span style={{ flexShrink: 0 }}>▶</span>
                          <span style={{ fontFamily: "monospace", flexShrink: 0 }}>[{formatTime(t)}]</span>
                          <span>{ts.topic}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const YoutubeCarousel = forwardRef<YoutubeCarouselHandle, { activeFilter: string }>(function YoutubeCarousel(
  { activeFilter },
  ref,
) {
  // Filtered once, at mount — the parent (YoutubeFeed) remounts this component via key=
  // {activeFilter} whenever the filter changes, so there's no need to react to activeFilter
  // changing here directly (fresh currentIndex/shuffle come for free with the remount).
  const [videos] = useState<YoutubeVideo[]>(() => {
    const shuffled = shuffle(youtubeData.videos as YoutubeVideo[]);
    return activeFilter === "all" ? shuffled : shuffled.filter((v) => v.category === activeFilter);
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const isFirstRender = useRef(true);

  // Fixed viewport height, precomputed once from the tallest card across *every* video in the
  // full, unfiltered set (not just whichever category is currently active) - so switching filters
  // never resizes the carousel, matching TriviaBoard's own "benchmark against everything, not
  // just what's currently shown" height fix. Measured off-screen using the real VideoCard
  // component itself (isActive=false), so the measurement is pixel-identical to what actually
  // renders rather than a separately-maintained approximation of it.
  const [maxCardHeight, setMaxCardHeight] = useState<number | null>(null);
  const measureContainerRef = useRef<HTMLDivElement>(null);

  function measureNow() {
    const container = measureContainerRef.current;
    if (!container) return;
    const heights = Array.from(container.children).map((el) => (el as HTMLElement).offsetHeight);
    if (heights.length > 0) setMaxCardHeight(Math.max(...heights));
  }

  useLayoutEffect(() => {
    // Skipped when starting invisible (offsetWidth reads 0 — an ancestor accordion is closed,
    // the common case on mobile, where every homepage section starts closed) rather than run
    // unconditionally: measuring every VideoCard's real rendered height here is expensive (this
    // is a full React component tree per video, not a lightweight synthetic string like
    // TriviaBoard's own measurement), and a Lighthouse mobile run traced real main-thread cost to
    // this exact class of work — React's initial commit doesn't paint partial trees, so this was
    // delaying first paint for the entire page, not just this carousel. remeasure (exposed via
    // the imperative handle below, called from Accordion's onBeforeMeasure) computes the real
    // value synchronously the moment this section actually opens, so skipping here only ever
    // leaves an invisible element unmeasured, never a visible one.
    const container = measureContainerRef.current;
    if (!container || container.offsetWidth === 0) return;
    measureNow();
  }, []);

  useImperativeHandle(ref, () => ({ remeasure: measureNow }));

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragDistanceRef = useRef(0);
  const markSwipeInteracted = useSwipeHint(trackRef, viewportRef);

  function navigate(direction: 1 | -1) {
    setCurrentIndex((prev) => (prev + direction + videos.length) % videos.length);
  }

  // Snaps the track's transform back to center the instant currentIndex actually changes -
  // useLayoutEffect (not the swipe-commit setTimeout the original reset it inside) so this only
  // ever runs after React has already re-rendered the new video into the center slot. Resetting
  // the transform first and letting the state update land afterwards would show the *old* video
  // freshly recentered for a frame before flashing to the new one - a worse regression than the
  // discrepancy this refactor set out to fix.
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
    if (!viewportEl || !trackEl || videos.length === 0) return;

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
      // With only 1 video (e.g. a filtered category with a single entry), navigate() has
      // nowhere to go — currentIndex never actually changes, so the useLayoutEffect that resets
      // the track's transform on [currentIndex] never re-fires, leaving it stuck at the
      // just-committed 0%/-200% instead of snapping back to center. Since there's nothing to
      // swipe to anyway, always treat it as uncommitted so the existing snap-back path handles it.
      const committed = videos.length > 1 && Math.abs(netX) > SWIPE_COMMIT_THRESHOLD;

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
  }, [videos]);

  if (videos.length === 0) return null;

  const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
  const nextIndex = (currentIndex + 1) % videos.length;

  // With very small filtered categories (1-2 videos), the peek slots can't help repeating
  // content — prevIndex/currentIndex/nextIndex collide by construction (e.g. with exactly 2
  // videos, prev and next always land on the same "other" video). Keying naively by videoId
  // then gives sibling slides duplicate `key`s, which breaks React's reconciliation on the next
  // swipe (confirmed via a real drag test: the track gained an extra untracked child and its
  // transform never reset, so the carousel looked stuck). Suffixing only the slot that collides
  // with `current` keeps the current<->prev/next identity handoff (a VideoCard's state carrying
  // over as the window slides) intact for the pairing that actually matters, and only forces a
  // fresh mount for the redundant duplicate peek — harmless, since peek cards are always inert.
  const prevKey = prevIndex === currentIndex ? videos[prevIndex].videoId + "-prev" : videos[prevIndex].videoId;
  const nextKey =
    nextIndex === currentIndex || nextIndex === prevIndex
      ? videos[nextIndex].videoId + "-next"
      : videos[nextIndex].videoId;

  return (
    <div
      id="yt-carousel-viewport"
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
        {(youtubeData.videos as YoutubeVideo[]).map((v) => (
          <VideoCard key={v.videoId} video={v} isActive={false} dragDistanceRef={dragDistanceRef} onNavigate={() => {}} />
        ))}
      </div>

      <div id="yt-carousel-track" ref={trackRef} style={{ display: "flex", height: "100%", transform: "translateX(-100%)" }}>
        <div
          key={prevKey}
          style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}
        >
          <VideoCard video={videos[prevIndex]} isActive={false} dragDistanceRef={dragDistanceRef} onNavigate={navigate} />
        </div>
        <div
          key={videos[currentIndex].videoId}
          style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}
        >
          <VideoCard video={videos[currentIndex]} isActive dragDistanceRef={dragDistanceRef} onNavigate={navigate} />
        </div>
        <div
          key={nextKey}
          style={{ flex: "0 0 100%", padding: `0 ${SLIDE_GAP_PX}px`, boxSizing: "border-box" }}
        >
          <VideoCard video={videos[nextIndex]} isActive={false} dragDistanceRef={dragDistanceRef} onNavigate={navigate} />
        </div>
      </div>
    </div>
  );
});
