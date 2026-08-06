import { useEffect, useRef } from "react";
import learningData from "../../../_data/learning.json";
import type { LearningItem } from "@/data/insights_types";

// React port of learning_board.html. Same imperative-refs approach as YoutubeCarousel.tsx (the
// swipe-settle-then-swap-question choreography is exactly as sequence-sensitive), ported from
// the same source that vanilla's own comments say it was itself copied from
// (youtube_feed.html's swipe wiring) — kept as its own self-contained copy here too rather than
// extracted into a shared hook, matching that existing convention, since loadQuestion/
// currentIndex/etc. only exist inside each carousel's own effect closure in both the original
// and this port.
//
// `activeFilter` replaces the original's `window.filterTrivia` global-function bridge (Medium's
// filter buttons called it directly) — same effect, ordinary React data flow instead of a global.

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildPreviewSlideHtml(item: LearningItem): string {
  const optionsHtml = item.options
    .map(
      (opt) =>
        '<div class="btn text-left p-2 text-normal f6 trivia-btn" style="width: 100%; white-space: normal; pointer-events: none;">' +
        opt +
        "</div>",
    )
    .join("");
  return (
    '<div class="d-flex flex-column" style="height: 100%; box-sizing: border-box;">' +
    '<h2 class="f4 mb-3" style="line-height: 1.4; font-weight: 500; color: var(--fg);">' +
    item.question +
    "</h2>" +
    '<p class="f6 mb-4" style="color: var(--fg-muted);"><span>Not sure? Read: </span><span class="text-underline">' +
    item.articleTitle +
    "</span></p>" +
    '<div class="d-flex flex-column" style="gap: 12px; margin-bottom: 16px;">' +
    optionsHtml +
    "</div></div>"
  );
}

const SWIPE_COMMIT_THRESHOLD = 50;
const SWIPE_AXIS_LOCK_THRESHOLD = 10;
const SWIPE_SETTLE_MS = 250;

export function TriviaBoard({ activeFilter }: { activeFilter: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const prevSlideRef = useRef<HTMLDivElement>(null);
  const nextSlideRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const skeletonRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const sourceLinkRef = useRef<HTMLAnchorElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const learningTextRef = useRef<HTMLParagraphElement>(null);
  const learningTitleRef = useRef<HTMLElement>(null);
  const learningLinkRef = useRef<HTMLAnchorElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const applyFilterRef = useRef<(category: string) => void>(() => {});
  const isFirstFilterRun = useRef(true);

  const allLearnings = (learningData.learnings as LearningItem[]).filter((l) => l.question && l.options);

  useEffect(() => {
    if (allLearnings.length === 0) return;

    const viewportEl = viewportRef.current!;
    const trackEl = trackRef.current!;
    const prevSlideEl = prevSlideRef.current!;
    const nextSlideEl = nextSlideRef.current!;
    const triviaContainerEl = containerRef.current!;
    const skeletonEl = skeletonRef.current!;
    const contentEl = contentRef.current!;
    const questionEl = questionRef.current!;
    const sourceLinkEl = sourceLinkRef.current!;
    const optionsEl = optionsRef.current!;
    const revealEl = revealRef.current!;
    const learningTextEl = learningTextRef.current!;
    const learningTitleEl = learningTitleRef.current!;
    const learningLinkEl = learningLinkRef.current!;
    const nextBtn = nextBtnRef.current!;

    const shuffled = shuffle(allLearnings);
    let currentLearnings = [...shuffled];
    let currentItem: LearningItem | null = null;
    let currentIndex = 0;

    let resizeObserver: ResizeObserver | undefined;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        viewportEl.style.height = triviaContainerEl.offsetHeight + "px";
      });
      resizeObserver.observe(triviaContainerEl);
    }

    function updatePagination() {
      const dotsContainer = dotsRef.current!;
      dotsContainer.innerHTML = "";
      currentLearnings.forEach((_, idx) => {
        const dot = document.createElement("div");
        dot.className = "trivia-dot" + (idx === currentIndex ? " active" : "");
        dotsContainer.appendChild(dot);
      });
    }

    function updatePreviewSlides() {
      if (currentLearnings.length === 0) return;
      const prevIndex = (currentIndex - 1 + currentLearnings.length) % currentLearnings.length;
      const nextIndex = (currentIndex + 1) % currentLearnings.length;
      prevSlideEl.innerHTML = buildPreviewSlideHtml(currentLearnings[prevIndex]);
      nextSlideEl.innerHTML = buildPreviewSlideHtml(currentLearnings[nextIndex]);
    }

    function handleAnswer(selectedIndex: number, clickedBtn: HTMLButtonElement) {
      const buttons = optionsEl.querySelectorAll("button");
      buttons.forEach((b, i) => {
        b.disabled = true;
        if (i === currentItem!.correctIndex) b.classList.add("trivia-correct");
      });

      if (clickedBtn && selectedIndex !== currentItem!.correctIndex) {
        clickedBtn.classList.add("trivia-wrong", "shake-anim");
      }

      learningTextEl.textContent = currentItem!.learning;
      learningTitleEl.textContent = currentItem!.articleTitle;
      learningLinkEl.href = currentItem!.articleUrl;
      revealEl.style.display = "block";
    }

    function loadQuestion(index: number) {
      if (currentLearnings.length === 0) return;
      if (index >= currentLearnings.length) index = 0;
      if (index < 0) index = currentLearnings.length - 1;

      currentIndex = index;
      currentItem = currentLearnings[currentIndex];

      revealEl.style.display = "none";
      optionsEl.innerHTML = "";

      questionEl.textContent = currentItem.question;
      sourceLinkEl.textContent = currentItem.articleTitle;
      sourceLinkEl.href = currentItem.articleUrl;

      currentItem.options.forEach((optText, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn text-left p-2 text-normal f6 trivia-btn";
        btn.style.width = "100%";
        btn.style.whiteSpace = "normal";
        btn.textContent = optText;
        btn.onclick = () => handleAnswer(i, btn);
        optionsEl.appendChild(btn);
      });

      updatePagination();
      skeletonEl.style.display = "none";
      contentEl.style.display = "";
      updatePreviewSlides();
    }

    applyFilterRef.current = (category: string) => {
      if (allLearnings.length === 0) return;
      if (category === "all") {
        currentLearnings = [...shuffled];
        if (subtitleRef.current) {
          subtitleRef.current.innerHTML =
            "Test your knowledge with a daily trivia question generated by AI from my articles!";
        }
      } else {
        currentLearnings = shuffled.filter((l) => l.category && l.category.toLowerCase() === category.toLowerCase());
        if (currentLearnings.length === 0) {
          currentLearnings = [...shuffled];
          if (subtitleRef.current) {
            subtitleRef.current.innerHTML =
              "Test your knowledge with a daily trivia question generated by AI from my articles!";
          }
        } else if (subtitleRef.current) {
          subtitleRef.current.innerHTML =
            "Test your knowledge with a daily trivia question generated by AI from my <strong>" + category + "</strong> articles!";
        }
      }
      currentIndex = 0;
      loadQuestion(currentIndex);
    };

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
      swipeStartX = x;
      swipeStartY = y;
      swipeLastX = x;
      swipeLastY = y;
      viewportEl.style.cursor = "grabbing";
    }

    function moveSwipe(x: number, y: number) {
      if (!swiping) return;
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
        loadQuestion(nextIndex);
        return;
      }

      const targetPercent = netX > 0 ? "0%" : "-200%";
      trackEl.style.transition = "transform " + SWIPE_SETTLE_MS + "ms ease-out";
      trackEl.style.transform = "translateX(" + targetPercent + ")";
      setTimeout(() => {
        loadQuestion(nextIndex);
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

    function onKeydown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        loadQuestion(currentIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        loadQuestion(currentIndex + 1);
      }
    }
    viewportEl.addEventListener("keydown", onKeydown);

    function onNextClick() {
      let nextIdx = currentIndex + 1;
      if (nextIdx >= currentLearnings.length) nextIdx = 0;
      loadQuestion(nextIdx);
    }
    nextBtn.addEventListener("click", onNextClick);

    loadQuestion(0);

    return () => {
      viewportEl.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endSwipe);
      viewportEl.removeEventListener("touchstart", onTouchStart);
      viewportEl.removeEventListener("touchmove", onTouchMove);
      viewportEl.removeEventListener("touchend", endSwipe);
      viewportEl.removeEventListener("touchcancel", endSwipe);
      viewportEl.removeEventListener("keydown", onKeydown);
      nextBtn.removeEventListener("click", onNextClick);
      resizeObserver?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    applyFilterRef.current(activeFilter);
  }, [activeFilter]);

  return (
    <div className="learning-board box-shadow-large mb-4 mb-md-0 p-4 p-md-5 border rounded-2 flex-auto d-flex flex-column theme-surface theme-border position-relative overflow-hidden">
      <div
        className="position-absolute"
        style={{ top: -20, right: -20, opacity: 0.05, fontSize: 150, lineHeight: 1, pointerEvents: "none", userSelect: "none" }}
      >
        🧠
      </div>

      <div className="position-relative z-1 text-center text-md-left d-flex flex-column h-100">
        <div
          className="flex-shrink-0 d-flex flex-column flex-md-row flex-justify-between flex-items-md-start mb-4"
          style={{ gap: 16 }}
        >
          <div>
            <h3 className="f5 text-uppercase text-gray-light mb-1 tracking-wide" style={{ letterSpacing: 2 }}>
              AI Insight of the Day
            </h3>
            <p id="trivia-subtitle" ref={subtitleRef} className="f6 text-gray mb-0">
              Test your knowledge with a daily trivia question generated by AI from my articles!
            </p>
          </div>
        </div>

        {allLearnings.length === 0 ? (
          <div id="trivia-content" style={{ display: "" }}>
            <h2 className="f4 mb-3" style={{ lineHeight: 1.4, fontWeight: 500, color: "var(--fg)" }}>
              Oops! My AI is currently studying for the next quiz. Check back tomorrow!
            </h2>
          </div>
        ) : (
          <>
            <div id="trivia-helpers" className="d-flex flex-justify-center mb-3">
              <div id="trivia-dots" ref={dotsRef} className="d-flex flex-items-center" style={{ gap: 6 }}></div>
            </div>

            <div
              id="trivia-carousel-viewport"
              ref={viewportRef}
              tabIndex={0}
              aria-label="Trivia question card — swipe or use arrow keys to browse questions"
              style={{ overflow: "hidden", position: "relative", cursor: "grab", userSelect: "none" }}
            >
              <div id="trivia-carousel-track" ref={trackRef} style={{ display: "flex", transform: "translateX(-100%)" }}>
                <div id="trivia-slide-prev" ref={prevSlideRef} className="trivia-slide-preview" style={{ flex: "0 0 100%", padding: "0 10px" }}></div>

                <div id="trivia-container" ref={containerRef} className="d-flex flex-column" style={{ flex: "0 0 100%", minHeight: 0, padding: "0 10px" }}>
                  <div id="trivia-skeleton" ref={skeletonRef} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <span className="skeleton" style={{ width: "100%", height: 22 }}></span>
                    <span className="skeleton" style={{ width: "70%", height: 22 }}></span>
                    <span className="skeleton" style={{ width: 160, height: 16, marginTop: 4 }}></span>
                    <span className="skeleton" style={{ width: "100%", height: 40, marginTop: 8 }}></span>
                    <span className="skeleton" style={{ width: "100%", height: 40 }}></span>
                    <span className="skeleton" style={{ width: "100%", height: 40 }}></span>
                  </div>

                  <div id="trivia-content" ref={contentRef} className="flex-auto" style={{ minHeight: 0, display: "none" }}>
                    <h2 id="trivia-question" ref={questionRef} className="f4 mb-3" style={{ lineHeight: 1.4, fontWeight: 500, color: "var(--fg)" }}>
                      Loading question...
                    </h2>

                    <p id="trivia-source" className="f6 mb-4" style={{ color: "var(--fg-muted)" }}>
                      <span>Not sure? Read: </span>
                      <a
                        id="trivia-source-link"
                        ref={sourceLinkRef}
                        href="#"
                        className="text-underline"
                        style={{ color: "var(--fg-muted)" }}
                        target="_blank"
                        rel="noopener noreferrer"
                      ></a>
                    </p>

                    <div id="trivia-options" ref={optionsRef} className="d-flex flex-column" style={{ gap: 12, marginBottom: 16 }}></div>

                    <div id="trivia-reveal" ref={revealRef} style={{ display: "none" }}>
                      <div className="flash-success p-3 rounded-2 mb-4" style={{ backgroundColor: "var(--success-bg)", border: "1px solid var(--success-fg)" }}>
                        <p id="learning-text" ref={learningTextRef} className="f4 text-italic mb-0" style={{ lineHeight: 1.4, color: "var(--success-fg)" }}></p>
                      </div>

                      <div className="d-flex flex-column border-top pt-4 theme-border" style={{ width: "100%" }}>
                        <div className="f6 text-gray mb-3 text-left">
                          From the article: <strong id="learning-title" ref={learningTitleRef} className="f5 d-block mt-1 theme-fg"></strong>
                        </div>
                        <div className="d-flex flex-column flex-sm-row flex-justify-between" style={{ gap: 12, width: "100%" }}>
                          <a id="learning-link" ref={learningLinkRef} href="#" className="btn flex-1 text-center" target="_blank" rel="noopener noreferrer">
                            Read Article
                          </a>
                          <button id="btn-next-question" ref={nextBtnRef} type="button" className="btn btn-blue flex-1 text-center">
                            Next Question &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div id="trivia-slide-next" ref={nextSlideRef} className="trivia-slide-preview" style={{ flex: "0 0 100%", padding: "0 10px" }}></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
