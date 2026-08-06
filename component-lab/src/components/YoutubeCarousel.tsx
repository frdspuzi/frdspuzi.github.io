import { useLayoutEffect, useRef, useState } from "react";
import youtubeData from "../../../_data/youtube.json";
import type { YoutubeVideo, YTPlayer } from "@/data/youtube_types";

// React port of youtube_feed.html's <script> — transliterated close to 1:1, refs standing in for
// getElementById and plain mutable refs standing in for the original's module-scoped `var`s,
// rather than modeling currentIndex/ytPlayer/etc. as React state. Everything here is imperative
// DOM mutation exactly like the original (loadVideo() writes textContent directly, the swipe
// handlers move the track via style.transform outside any render cycle) — the choreography
// between the swipe-settle animation and swapping in the next video's data is precisely
// sequenced (see endSwipe() below), and re-deriving that as reactive state risked breaking the
// sequencing for no visual benefit. See DESIGN.md's Motion section and this file's own comments
// (carried over from the original) for why each specific number/technique is what it is.

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
}

function isShortVideo(video: YoutubeVideo) {
  return !!(video.url && video.url.includes("/shorts/"));
}

// Builds the peek content for a neighboring (not "current") slide — same structure/classes as
// the real card, just non-interactive (no play button, plain-text timestamps) and none of the
// real card's element ids, since the real card is the only one ever mounted as actual React
// content — these are raw HTML strings written directly into the prev/next slide divs, rebuilt
// from scratch on every navigation, matching the original exactly.
function buildPreviewSlideHtml(video: YoutubeVideo): string {
  const thumbUrl = "https://i.ytimg.com/vi/" + video.videoId + "/hqdefault.jpg";
  const isShort = isShortVideo(video);
  const isMobileNow = window.matchMedia("(max-width: 767px)").matches;
  const keepPreviewLandscape = isShort && isMobileNow;
  let thumbStyle: string;
  if (isShort && !keepPreviewLandscape) {
    thumbStyle =
      "aspect-ratio: 9/16; max-width: 320px; margin: 0 auto; overflow: hidden; " +
      "border-radius: 8px; position: relative; background-image: url('" + thumbUrl + "'); " +
      "background-size: cover; background-position: center; background-repeat: no-repeat;";
  } else if (isShort) {
    thumbStyle =
      "aspect-ratio: 16/9; overflow: hidden; border-radius: 8px; position: relative; " +
      "background-image: url('" + thumbUrl + "'); background-size: contain; " +
      "background-position: center; background-repeat: no-repeat; background-color: #000;";
  } else {
    thumbStyle =
      "aspect-ratio: 16/9; overflow: hidden; border-radius: 8px; position: relative; " +
      "background-image: url('" + thumbUrl + "'); background-size: cover; " +
      "background-position: center; background-repeat: no-repeat;";
  }

  let timestampsHtml = "";
  if (video.timestamps && video.timestamps.length > 0) {
    const items = video.timestamps
      .map((ts) => {
        const t = ts.startTime !== undefined ? ts.startTime : (ts.time ?? 0);
        const timeLabel = "[" + formatTime(t) + "]";
        return (
          '<span style="display: flex; gap: 6px; margin-bottom: 8px;">' +
          '<span style="flex-shrink: 0;">▶</span>' +
          '<span style="font-family: monospace; flex-shrink: 0; color: var(--accent);">' +
          timeLabel +
          "</span>" +
          "<span>" +
          ts.topic +
          "</span>" +
          "</span>"
        );
      })
      .join("");
    timestampsHtml =
      '<div class="mt-3"><strong class="f6 text-gray-light">Key Moments:</strong></div>' +
      '<div class="mt-2 f6" style="color: var(--fg);">' +
      items +
      "</div>";
  }

  return (
    '<div class="Box box-shadow-large p-4 theme-surface theme-border" style="border-radius: 12px; padding-bottom: 36px !important; height: 100%; box-sizing: border-box;">' +
    '<div class="d-flex flex-column flex-lg-row flex-items-center" style="gap: 32px; height: 100%; box-sizing: border-box;">' +
    '<div class="col-12 col-lg-6 flex-shrink-0" style="' +
    thumbStyle +
    '"></div>' +
    '<div class="col-12 col-lg-6 d-flex flex-column flex-justify-center text-left">' +
    '<div class="mb-2"><span class="d-inline-block text-uppercase text-bold f6" style="padding: 4px 12px; border-radius: 20px; background-color: var(--accent-bg); color: var(--accent); border: 1px solid var(--accent-border); letter-spacing: 0.5px;">' +
    video.category +
    "</span></div>" +
    '<h3 class="f3 mb-2 lh-condensed theme-fg" style="font-weight: 600;">' +
    video.title +
    "</h3>" +
    '<p class="f5 mb-3 text-gray">By <strong>' +
    video.channel +
    "</strong></p>" +
    '<div class="flash yt-flash mb-4" style="border-color: var(--border); border-radius: 8px;">' +
    '<p class="f5 mb-0" style="line-height: 1.6; color: var(--fg);">' +
    video.summary +
    "</p>" +
    timestampsHtml +
    "</div></div></div></div>"
  );
}

function shuffle<T>(array: T[]): T[] {
  return [...array].sort(() => 0.5 - Math.random());
}

const CLICK_DRAG_THRESHOLD = 8;
const SWIPE_COMMIT_THRESHOLD = 50;
const SWIPE_AXIS_LOCK_THRESHOLD = 10;
const SWIPE_SETTLE_MS = 250;

export function YoutubeCarousel() {
  const videosRef = useRef<YoutubeVideo[]>(shuffle(youtubeData.videos as YoutubeVideo[]));

  // Fixed viewport height, precomputed once from the tallest card across *every* video, not the
  // 3 currently-rendered slides — the old ResizeObserver-driven approach synced viewportEl's
  // height to whichever card was current, so it visibly jumped on every swipe as videos with
  // different title/summary/timestamp-count lengths cycled through. Measured off-screen (see
  // measureContainerRef below) using the same markup/width as the real card, so wrapping is
  // measured accurately rather than estimated. Once set, the info column's existing
  // flex-justify-center (already in the JSX below) does the rest: any video shorter than the
  // tallest now has real extra space in its own card to center within, instead of nothing to
  // center against.
  const [maxCardHeight, setMaxCardHeight] = useState<number | null>(null);
  const measureContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = measureContainerRef.current;
    if (!container) return;
    const heights = Array.from(container.children).map((el) => (el as HTMLElement).offsetHeight);
    if (heights.length > 0) setMaxCardHeight(Math.max(...heights));
  }, []);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const prevSlideRef = useRef<HTMLDivElement>(null);
  const nextSlideRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);
  const facadeRef = useRef<HTMLButtonElement>(null);
  const facadeThumbRef = useRef<HTMLImageElement>(null);
  const categoryRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const channelNameRef = useRef<HTMLElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const skeletonRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const timestampsHeaderRef = useRef<HTMLDivElement>(null);
  const timestampsRef = useRef<HTMLDivElement>(null);

  // useLayoutEffect (not useEffect): this populates real content over the skeleton placeholder.
  // Accordion's own open-state effect (also useLayoutEffect) runs in the same pre-paint pass, so
  // this must too, or the very first paint after opening would show the skeleton — visibly
  // shorter than the real card — with real content swapping in only on the *next* paint, reading
  // as a layout jump ("opens a bit, then opens to full") rather than the true single-shot open.
  useLayoutEffect(() => {
    if (videosRef.current.length === 0) return;
    const videos = videosRef.current;

    const viewportEl = viewportRef.current!;
    const trackEl = trackRef.current!;
    const prevSlideEl = prevSlideRef.current!;
    const nextSlideEl = nextSlideRef.current!;
    const videoContainer = videoContainerRef.current!;
    const facadeEl = facadeRef.current!;
    const facadeThumbEl = facadeThumbRef.current!;
    const categoryEl = categoryRef.current!;
    const titleEl = titleRef.current!;
    const channelNameEl = channelNameRef.current!;
    const summaryEl = summaryRef.current!;
    const skeletonEl = skeletonRef.current!;
    const infoEl = infoRef.current!;
    const timestampsHeaderEl = timestampsHeaderRef.current!;
    const timestampsEl = timestampsRef.current!;

    let ytPlayer: YTPlayer | undefined;
    let ytReady = false;
    let ytApiRequested = false;
    let currentVideoId: string | null = null;
    let pendingSeekTime: number | null = null;
    let currentVideoTimestamps: YoutubeVideo["timestamps"] = [];
    let hasFilteredByDuration = false;
    let currentVideoIsShort = false;
    let currentIndex = 0;
    let dragDistance = 0;

    function setVideoContainerAspect(isPortrait: boolean) {
      videoContainer.style.cssText = isPortrait
        ? "aspect-ratio: 9/16 !important; max-width: 320px !important; margin: 0 auto !important; border-radius: 8px; overflow: hidden; position: relative;"
        : "aspect-ratio: 16/9 !important; max-width: 100% !important; margin: 0 !important; border-radius: 8px; overflow: hidden; position: relative;";
    }

    function createPlayer(videoId: string) {
      if (ytPlayer) return;
      ytPlayer = new window.YT.Player(playerDivRef.current!, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1, autoplay: 1 },
        events: {
          onReady: () => {
            ytReady = true;
            if (pendingSeekTime !== null) {
              ytPlayer!.seekTo(pendingSeekTime, true);
              pendingSeekTime = null;
            }
          },
          onStateChange: (event) => {
            if ((event.data === 5 || event.data === 1) && !hasFilteredByDuration) {
              const duration = ytPlayer!.getDuration();
              if (duration > 0) {
                renderTimestamps(duration);
                hasFilteredByDuration = true;
              }
            }
          },
        },
      });
    }

    window.onYouTubeIframeAPIReady = () => {
      createPlayer(currentVideoId!);
    };

    function loadRealPlayer(seekTime?: number) {
      facadeEl.style.display = "none";
      facadeEl.classList.remove("yt-facade-short");
      if (currentVideoIsShort) setVideoContainerAspect(true);

      if (ytReady && ytPlayer) {
        if (seekTime !== undefined) {
          ytPlayer.seekTo(seekTime, true);
          ytPlayer.playVideo();
        }
        return;
      }

      pendingSeekTime = seekTime !== undefined ? seekTime : null;

      if (!ytApiRequested) {
        ytApiRequested = true;
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode!.insertBefore(tag, firstScriptTag);
      } else if (window.YT && window.YT.Player) {
        createPlayer(currentVideoId!);
      }
    }

    function onFacadeClick() {
      if (dragDistance > CLICK_DRAG_THRESHOLD) return;
      loadRealPlayer();
    }
    facadeEl.addEventListener("click", onFacadeClick);

    function renderTimestamps(duration: number) {
      if (!currentVideoTimestamps || currentVideoTimestamps.length === 0) {
        timestampsHeaderEl.style.display = "none";
        timestampsEl.style.display = "none";
        timestampsEl.innerHTML = "";
        return;
      }

      let validTimestamps = 0;
      timestampsEl.innerHTML = "";

      currentVideoTimestamps.forEach((ts) => {
        const t = ts.startTime !== undefined ? ts.startTime : (ts.time ?? 0);
        if (t > duration) return;

        validTimestamps++;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-link text-left d-block f6 mb-2";
        btn.style.cssText =
          "color: var(--accent); text-decoration: none; white-space: normal; word-break: break-word; line-height: 1.4; width: 100%; padding: 0;";
        const timeLabel = "[" + formatTime(t) + "]";
        btn.innerHTML =
          '<span style="display: flex; gap: 6px;"><span style="flex-shrink: 0;">▶</span> <span style="font-family: monospace; flex-shrink: 0;">' +
          timeLabel +
          "</span> <span>" +
          ts.topic +
          "</span></span>";
        btn.onclick = () => loadRealPlayer(t);
        timestampsEl.appendChild(btn);
      });

      if (validTimestamps > 0) {
        timestampsHeaderEl.style.display = "block";
        timestampsEl.style.display = "block";
      } else {
        timestampsHeaderEl.style.display = "none";
        timestampsEl.style.display = "none";
      }
    }

    function loadVideo(index: number) {
      if (index >= videos.length) index = 0;
      if (index < 0) index = videos.length - 1;
      currentIndex = index;
      const v = videos[currentIndex];
      const timestamps = v.timestamps || [];

      currentVideoId = v.videoId;

      if (ytReady && ytPlayer && ytPlayer.cueVideoById) {
        ytPlayer.cueVideoById(v.videoId);
      } else {
        facadeThumbEl.src = "https://i.ytimg.com/vi/" + v.videoId + "/hqdefault.jpg";
        facadeThumbEl.alt = v.title;
      }

      categoryEl.textContent = v.category;
      titleEl.textContent = v.title;
      channelNameEl.textContent = v.channel;
      summaryEl.textContent = v.summary;

      skeletonEl.style.display = "none";
      infoEl.style.display = "";

      currentVideoTimestamps = timestamps;
      hasFilteredByDuration = false;

      currentVideoIsShort = isShortVideo(v);
      const realPlayerLoaded = !!(ytReady && ytPlayer && ytPlayer.cueVideoById);
      const isMobileNow = window.matchMedia("(max-width: 767px)").matches;
      const keepFacadeLandscape = currentVideoIsShort && isMobileNow && !realPlayerLoaded;
      setVideoContainerAspect(currentVideoIsShort && !keepFacadeLandscape);
      facadeEl.classList.toggle("yt-facade-short", keepFacadeLandscape);

      renderTimestamps(Infinity);

      updatePreviewSlides();
    }

    function updatePreviewSlides() {
      const prevIndex = (currentIndex - 1 + videos.length) % videos.length;
      const nextIndex = (currentIndex + 1) % videos.length;
      prevSlideEl.innerHTML = buildPreviewSlideHtml(videos[prevIndex]);
      nextSlideEl.innerHTML = buildPreviewSlideHtml(videos[nextIndex]);
    }

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
      dragDistance = 0;
      swipeStartX = x;
      swipeStartY = y;
      swipeLastX = x;
      swipeLastY = y;
      viewportEl.style.cursor = "grabbing";
    }

    function moveSwipe(x: number, y: number) {
      if (!swiping) return;
      dragDistance += Math.abs(x - swipeLastX) + Math.abs(y - swipeLastY);
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
        const maxDx = viewportEl.getBoundingClientRect().width;
        const dx = Math.max(-maxDx, Math.min(maxDx, dx0));
        trackEl.style.transform = "translateX(calc(-100% + " + dx + "px))";
      }
    }

    function endSwipe() {
      if (!swiping) return;
      swiping = false;
      viewportEl.style.cursor = "grab";
      if (swipeAxis === "vertical") return;
      const netX = swipeLastX - swipeStartX;
      const committed = Math.abs(netX) > SWIPE_COMMIT_THRESHOLD;
      const nextIndex = netX > 0 ? currentIndex - 1 : currentIndex + 1;

      if (!committed) {
        if (!reduceMotion) {
          trackEl.style.transition = "transform " + SWIPE_SETTLE_MS + "ms ease-out";
          trackEl.style.transform = "translateX(-100%)";
          setTimeout(() => {
            trackEl.style.transition = "";
          }, SWIPE_SETTLE_MS);
        }
        return;
      }

      if (reduceMotion) {
        loadVideo(nextIndex);
        return;
      }

      const targetPercent = netX > 0 ? "0%" : "-200%";
      trackEl.style.transition = "transform " + SWIPE_SETTLE_MS + "ms ease-out";
      trackEl.style.transform = "translateX(" + targetPercent + ")";
      setTimeout(() => {
        loadVideo(nextIndex);
        trackEl.style.transition = "none";
        trackEl.style.transform = "translateX(-100%)";
        void trackEl.offsetWidth;
        trackEl.style.transition = "";
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

    function onFacadeKeydown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        loadVideo(currentIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        loadVideo(currentIndex + 1);
      }
    }
    facadeEl.addEventListener("keydown", onFacadeKeydown);

    loadVideo(0);

    return () => {
      facadeEl.removeEventListener("click", onFacadeClick);
      facadeEl.removeEventListener("keydown", onFacadeKeydown);
      viewportEl.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endSwipe);
      viewportEl.removeEventListener("touchstart", onTouchStart);
      viewportEl.removeEventListener("touchmove", onTouchMove);
      viewportEl.removeEventListener("touchend", endSwipe);
      viewportEl.removeEventListener("touchcancel", endSwipe);
      delete window.onYouTubeIframeAPIReady;
    };
  }, []);

  if (youtubeData.videos.length === 0) return null;

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
      {/* Off-screen, one per video — measured once (see the useLayoutEffect above) to find the
          tallest possible card, then never rendered again. visibility:hidden (not display:none)
          so it still lays out and measures correctly; position:absolute removes it from the real
          track's flow entirely. Structural classes/widths mirror the real card so text wrapping
          measures accurately; alignment classes (flex-items-center/flex-justify-center) are
          skipped since they don't affect natural content height, only where it sits. */}
      <div
        ref={measureContainerRef}
        aria-hidden="true"
        style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", top: 0, left: 0, width: "100%", zIndex: -1 }}
      >
        {videosRef.current.map((v, i) => (
          <div
            key={i}
            className="Box box-shadow-large p-4 theme-surface theme-border"
            style={{ borderRadius: 12, paddingBottom: 36, boxSizing: "border-box" }}
          >
            <div className="d-flex flex-column flex-lg-row" style={{ gap: 32 }}>
              <div
                className="col-12 col-lg-6 flex-shrink-0"
                style={
                  isShortVideo(v)
                    ? { aspectRatio: "9/16", maxWidth: 320, margin: "0 auto", borderRadius: 8 }
                    : { aspectRatio: "16/9", borderRadius: 8 }
                }
              ></div>
              <div className="col-12 col-lg-6 d-flex flex-column text-left">
                <div className="mb-2">
                  <span
                    className="d-inline-block text-uppercase text-bold f6"
                    style={{ padding: "4px 12px", borderRadius: 20, letterSpacing: "0.5px" }}
                  >
                    {v.category}
                  </span>
                </div>
                <h3 className="f3 mb-2 lh-condensed" style={{ fontWeight: 600 }}>
                  {v.title}
                </h3>
                <p className="f5 mb-3">By {v.channel}</p>
                <div className="flash yt-flash mb-4" style={{ borderRadius: 8 }}>
                  <p className="f5 mb-0" style={{ lineHeight: 1.6 }}>
                    {v.summary}
                  </p>
                  {v.timestamps && v.timestamps.length > 0 && (
                    <>
                      <div className="mt-3">
                        <strong className="f6">Key Moments:</strong>
                      </div>
                      <div className="mt-2 f6">
                        {v.timestamps.map((ts, j) => (
                          <div key={j} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                            <span>▶</span>
                            <span style={{ fontFamily: "monospace" }}>[00:00]</span>
                            <span>{ts.topic}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div id="yt-carousel-track" ref={trackRef} style={{ display: "flex", height: "100%", transform: "translateX(-100%)" }}>
        <div id="yt-slide-prev" ref={prevSlideRef} className="yt-slide-preview" style={{ flex: "0 0 100%" }}></div>

        <div
          id="yt-slide-current"
          className="Box box-shadow-large p-4 theme-surface theme-border"
          style={{ flex: "0 0 100%", borderRadius: 12, paddingBottom: "36px", boxSizing: "border-box" }}
        >
          <div
            className="d-flex flex-column flex-lg-row flex-items-center"
            style={{ gap: 32, height: "100%", boxSizing: "border-box" }}
          >
            <div
              id="yt-player-container"
              ref={videoContainerRef}
              className="col-12 col-lg-6 flex-shrink-0"
              style={{ aspectRatio: "16/9", overflow: "hidden", borderRadius: 8, position: "relative" }}
            >
              <div id="yt-player" ref={playerDivRef} style={{ width: "100%", height: "100%" }}></div>
              <button type="button" id="yt-facade" ref={facadeRef} className="yt-facade" aria-label="Play video">
                <img id="yt-facade-thumb" ref={facadeThumbRef} className="yt-facade-thumb" alt="" />
                <span className="yt-facade-play" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="28" height="28">
                    <path d="M8 5v14l11-7z" fill="#fff"></path>
                  </svg>
                </span>
              </button>
            </div>

            <div className="col-12 col-lg-6 d-flex flex-column flex-justify-center text-left">
              <div id="yt-skeleton" ref={skeletonRef} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span className="skeleton" style={{ width: 90, height: 22, borderRadius: 20 }}></span>
                <span className="skeleton" style={{ width: "95%", height: 22 }}></span>
                <span className="skeleton" style={{ width: "55%", height: 22 }}></span>
                <span className="skeleton" style={{ width: 140, height: 16, marginTop: 4 }}></span>
                <span className="skeleton" style={{ width: "100%", height: 76, marginTop: 8 }}></span>
              </div>

              <div id="yt-info" ref={infoRef} style={{ display: "none" }}>
                <div className="mb-2">
                  <span
                    id="yt-category"
                    ref={categoryRef}
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
                    Loading&hellip;
                  </span>
                </div>

                <h3 id="yt-title" ref={titleRef} className="f3 mb-2 lh-condensed theme-fg" style={{ fontWeight: 600 }}>
                  Loading today's pick&hellip;
                </h3>

                <p id="yt-channel" className="f5 mb-3 text-gray">
                  By <strong id="yt-channel-name" ref={channelNameRef}>&hellip;</strong>
                </p>

                <div className="flash yt-flash mb-4" style={{ borderColor: "var(--border)", borderRadius: 8 }}>
                  <p id="yt-summary" ref={summaryRef} className="f5 mb-0" style={{ lineHeight: 1.6, color: "var(--fg)" }}>
                    &nbsp;
                  </p>
                  <div id="yt-timestamps-header" ref={timestampsHeaderRef} className="mt-3" style={{ display: "none" }}>
                    <strong className="f6 text-gray-light">Key Moments:</strong>
                  </div>
                  <div id="yt-timestamps" ref={timestampsRef} className="mt-2" style={{ display: "none" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="yt-slide-next" ref={nextSlideRef} className="yt-slide-preview" style={{ flex: "0 0 100%" }}></div>
      </div>
    </div>
  );
}
