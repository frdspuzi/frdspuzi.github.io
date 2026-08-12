import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { useHorizontalScrollFade } from "@/hooks/useHorizontalScrollFade";
import { toSentenceCase } from "@/lib/utils";
import type { MediumItem } from "@/data/insights_types";

// React port of thoughts.html's #medium-posts card list. Filter buttons are the real beui.dev
// pill tabs (motion/tabs), not a port of the original's plain #medium-filters buttons — see the
// Tabs usage below. Rendered as
// real JSX cards (not the original's raw HTML-string-into-innerHTML) since article titles/
// excerpts come from Medium's own RSS feed content — JSX's default text interpolation escapes
// that content automatically, which the original's string-concat approach didn't. Skeleton
// placeholder skipped: the original's only existed to bridge a `DOMContentLoaded`-timed script;
// here the data is already present at first render, so there's no gap for it to bridge.
//
// isMobile is checked once at mount, not reactive to resize — same "initial-state only"
// convention the original used (`var isMobile = window.matchMedia(...).matches` at script-run
// time), switching between the tablet/desktop row-card and the phone-only "story tray" card.

function parseHtmlSafely(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, "text/html").body;
}

function extractSummary(html: string): string {
  const tmp = parseHtmlSafely(html);
  let result = "";

  const paragraphs = tmp.querySelectorAll("p");
  for (const p of paragraphs) {
    const text = (p.textContent || "").trim();
    const lower = text.toLowerCase();
    if (lower.indexOf("tldr") === 0 || lower.indexOf("tl;dr") === 0 || lower.indexOf("problem statement") === 0) {
      result = text;
      break;
    }
  }

  if (!result) {
    const blockquote = tmp.querySelector("blockquote");
    if (blockquote) {
      const bqText = (blockquote.textContent || "").replace(/\s+/g, " ").trim();
      if (bqText.length > 20) result = bqText;
    }
  }

  if (!result) {
    for (const p of paragraphs) {
      const text = (p.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length > 80) {
        result = text;
        break;
      }
    }
  }

  if (!result) {
    result = (tmp.textContent || "").replace(/\s+/g, " ").trim();
  }

  result = result.replace(/^(TL;?DR|Problem Statement)[\s;:.,-]+/i, "").trim();

  if (result.length > 140) {
    result = result.slice(0, 140).trim() + "…";
  }
  return result;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

// Self-hosted, not hotlinked from cdn-images-1.medium.com: that CDN sets a third-party cookie
// (_cfuvid) and no meaningful cache-control headers, both real Lighthouse findings - same fix
// already applied to YouTube thumbnails. fetch_medium.js downloads this for every article that
// has one before medium.json is ever written, so it's already committed by the time a guid shows
// up in the data - no fallback to the remote URL needed. Still checks item.content for whether an
// image exists at all (some articles have none), just no longer uses the URL it finds there.
function findImageUrl(content: string, guid: string): string | null {
  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(content)) !== null) {
    if (match[1].indexOf("stat?event") === -1) {
      const id = guid.split("/").filter(Boolean).pop();
      return "/assets/medium-images/" + id + ".jpg";
    }
  }
  return null;
}

function categoryOf(item: MediumItem): string {
  return item.categories && item.categories.length > 0 ? item.categories[0] : "uncategorized";
}

function RowCard({ item }: { item: MediumItem }) {
  const excerpt = extractSummary(item.content);
  const imageUrl = findImageUrl(item.content, item.guid);
  const category = categoryOf(item);

  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "block" }}>
      <div className="Box box-shadow-small medium-card overflow-hidden d-flex flex-row text-left" style={{ minHeight: 120 }}>
        {imageUrl && (
          <div
            className="medium-image flex-shrink-0"
            style={{ backgroundImage: `url('${imageUrl}')`, width: 160, borderRight: "1px solid var(--border)" }}
          ></div>
        )}
        <div className="p-3 d-flex flex-column flex-auto flex-justify-between" style={{ minWidth: 0 }}>
          <div>
            <h3 className="f4 text-bold lh-condensed mb-1 medium-title text-truncate">{item.title}</h3>
            <p className="f6 text-gray medium-excerpt mb-2" style={{ WebkitLineClamp: 2 }}>
              {excerpt}
            </p>
          </div>
          <div className="d-flex flex-items-center" style={{ gap: 8 }}>
            <span className="f6 text-gray medium-date mb-0">{formatDate(item.pubDate)}</span>
            {category !== "uncategorized" && <span className="medium-tag">{toSentenceCase(category)}</span>}
          </div>
        </div>
      </div>
    </a>
  );
}

function StoryCard({ item }: { item: MediumItem }) {
  const excerpt = extractSummary(item.content);
  const imageUrl = findImageUrl(item.content, item.guid);
  const category = categoryOf(item);

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="medium-story-card"
      aria-label={`${item.title} — ${excerpt}`}
      style={imageUrl ? { backgroundImage: `url('${imageUrl}')` } : undefined}
    >
      <span className="medium-story-overlay"></span>
      <span className="medium-story-overlay-top"></span>
      {category !== "uncategorized" && <span className="medium-tag medium-story-tag">{toSentenceCase(category)}</span>}
      <span className="medium-story-title">{item.title}</span>
    </a>
  );
}

export function MediumTray({
  items,
  categories,
  activeFilter,
  onFilterChange,
}: {
  items: MediumItem[];
  categories: string[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}) {
  const [isMobile] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  // Same fade-edge mechanism as the pill tabs (motion/tabs.tsx), shared via
  // useHorizontalScrollFade — this row only actually scrolls on mobile (overflow-x: auto there;
  // hidden on tablet/desktop), so the gradients are gated on isMobile below rather than always
  // rendered — canScrollLeft/Right reflect scrollWidth/clientWidth regardless of the overflow
  // property, so an ungated gradient could imply scrollability on desktop where overflow-x:
  // hidden means there's nothing to actually scroll to.
  const { scrollRef: postsScrollRef, canScrollLeft: postsCanScrollLeft, canScrollRight: postsCanScrollRight, contentHeight: postsHeight } =
    useHorizontalScrollFade<HTMLDivElement>();

  return (
    <div className="col-12 col-lg-6 insights-column right-column-container d-flex flex-column" style={{ minWidth: 0 }}>
      {/* flex-auto (grow-to-fill), not h-100: a percentage height here depends on
          .right-column-container already having a definite height, which only exists because the
          outer row's align-items: stretch supplies it — flex-grow fills whatever that resolves to
          without needing a percentage at all, avoiding the same circular-resolution issue that
          h-100 caused inside TriviaBoard's own layout (see that component's comments). */}
      <div className="right-column-content d-flex flex-column w-100 flex-auto">
        {categories.length > 0 && (
          // Real beui.dev pill tabs (motion/tabs), not the old plain .medium-filter-btn
          // buttons — used as a controlled filter (value/onValueChange), not for panel
          // switching, so TabsContent is deliberately unused here: the actual filtering below
          // still just fades/hides non-matching medium-card-wrapper items in place.
          //
          // Structured identically to YoutubeFeed.tsx's own Tabs usage, on purpose — no wrapper
          // div or flex-justify-center needed here: TabsList itself is full-width (matching this
          // column's other siblings — cards, footer row) and centers its own triggers internally,
          // only when they fit without scrolling. See that component's own comments for the full
          // reasoning (this replaced an earlier version that centered the *row*, which produced a
          // narrower "island" whenever the pills didn't fill the available width).
          <Tabs value={activeFilter} onValueChange={onFilterChange} variant="pill">
            <TabsList className="mb-3">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((cat) => (
                <TabsTrigger key={cat} value={cat}>
                  {toSentenceCase(cat)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {items.length === 0 ? (
          <p className="text-gray">No articles found.</p>
        ) : (
          // No overflow:hidden/border-radius on this wrapper (deliberately, not an oversight) —
          // a version of this rounded the wrapper itself to visually frame the mobile story tray,
          // but the wrapper's rounded corner is fixed in place while the cards scroll underneath
          // it, each with their own independent border-radius. At rest a card's corner can happen
          // to coincide with the wrapper's, but mid-scroll the wrapper's fixed rounded corner
          // just cuts across whatever's currently under it — usually a card's flat edge, not its
          // corner — which reads as the rounding being misaligned even though the clip itself
          // renders correctly. Letting each .medium-story-card's own rounding be the only
          // rounding anyone sees avoids that mismatch entirely, rather than chasing it with
          // pixel-level corrections.
          <div className="position-relative flex-auto" style={{ minWidth: 0 }}>
            <div id="medium-posts" ref={postsScrollRef} className="custom-scrollbar flex-auto">
              {items.map((item) => {
                const category = categoryOf(item);
                const matches = activeFilter === "all" || category === activeFilter;
                return (
                  <div
                    key={item.guid}
                    className={"medium-card-wrapper" + (isMobile ? " flex-shrink-0" : " w-100")}
                    style={{ opacity: matches ? 1 : 0, display: matches ? "" : "none" }}
                  >
                    {isMobile ? <StoryCard item={item} /> : <RowCard item={item} />}
                  </div>
                );
              })}
            </div>
            {isMobile && (
              <>
                {/* rgba black, not var(--surface-page): these are photo cards with their own
                    dark overlay baked in for text legibility (.medium-story-overlay/-top) — a
                    fade to a flat *theme* color barely contrasts against an already-dark,
                    busy image. A dark vignette is the same technique the cards already use
                    internally, and unlike a background-color fade it stays visible regardless of
                    image content or theme. 64px (up from 48), not proportional to the pill tabs'
                    own fade width — these cards are 120px wide vs. a short text label, so 48px
                    barely dented the visible card at all.
                    Peak opacity 0.75, held flat from 0% to 30% before fading (not a straight
                    0%->100% ramp) — confirmed via an actual pixel A/B diff (vignette forced on
                    vs off, same coordinates) that a ramp starting to lighten immediately reads
                    fine over a dark image but visibly fails over a bright one: the exact same
                    CSS looked "broken" on one card and fine on another purely because of how
                    bright that particular photo happened to be at the scroll edge, not a
                    positioning bug (confirmed those are byte-for-byte symmetric between the two
                    spans). Holding peak opacity for the first 30% gives a consistently dark
                    zone regardless of the underlying image's own brightness, then fades out
                    over the remaining width same as before. 0.75 (not higher) matches, not
                    exceeds, the card's own overlay-bottom peak (also 0.75) — this still spans
                    the card's full height, so at the top/bottom it stacks with the card's own
                    overlay-top (0.6 peak) and overlay-bottom (0.75 peak); going higher than 0.75
                    would start compounding toward the near-solid-black crush documented in this
                    file's own edit history (an earlier 0.9 peak did exactly that). */}
                {/* No border-radius on either span (unlike an earlier version) — that radius
                    was matched to the wrapper's own rounded corner, which no longer exists (see
                    the wrapper's own comment for why the outer rounding was dropped). A rounded
                    corner on the span itself cuts its background out of that corner's triangle,
                    leaving the card underneath uncovered right at the top/bottom corners — a
                    real gap, not a subtlety. Plain rectangles cover the full height edge to
                    edge, corners included. */}
                <span
                  aria-hidden="true"
                  className="position-absolute"
                  style={{
                    top: 0,
                    left: 0,
                    width: 64,
                    height: postsHeight ?? undefined,
                    background:
                      "linear-gradient(to right, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.75) 30%, transparent 100%)",
                    opacity: postsCanScrollLeft ? 1 : 0,
                    pointerEvents: "none",
                    zIndex: 20,
                    transition: "opacity 0.2s ease",
                  }}
                />
                <span
                  aria-hidden="true"
                  className="position-absolute"
                  style={{
                    top: 0,
                    right: 0,
                    width: 64,
                    height: postsHeight ?? undefined,
                    background:
                      "linear-gradient(to left, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.75) 30%, transparent 100%)",
                    opacity: postsCanScrollRight ? 1 : 0,
                    pointerEvents: "none",
                    zIndex: 20,
                    transition: "opacity 0.2s ease",
                  }}
                />
                {/* Top/bottom, unlike left/right above, aren't gated on scroll state — this row
                    has no vertical overflow (cards are a fixed height), so there's nothing for a
                    top/bottom fade to hint is scrollable; these are purely a decorative frame,
                    always on. Deliberately much lighter (0.3 peak, 24px) than the functional
                    left/right fades (0.7 peak, 64px) for the same stacking reason documented
                    above: every card already carries its own overlay-top (0.6 peak) and
                    overlay-bottom (0.75 peak) exactly at these edges, where the tag and title
                    already need to stay legible — a strong cross-card fade layered on top of
                    those would compound toward the same near-black crush that peak 0.7 on
                    left/right was tuned specifically to avoid. */}
                <span
                  aria-hidden="true"
                  className="position-absolute"
                  style={{
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 24,
                    background: "linear-gradient(to bottom, rgba(0,0,0,0.3), transparent)",
                    pointerEvents: "none",
                    zIndex: 20,
                  }}
                />
                <span
                  aria-hidden="true"
                  className="position-absolute"
                  style={{
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 24,
                    background: "linear-gradient(to top, rgba(0,0,0,0.3), transparent)",
                    pointerEvents: "none",
                    zIndex: 20,
                  }}
                />
              </>
            )}
          </div>
        )}

        <div
          className="d-flex flex-justify-between flex-items-center mt-3 pt-3 flex-shrink-0 border-top"
          style={{ borderColor: "rgba(149, 157, 165, 0.15)" }}
        >
          <a
            href="https://medium.com/@frdspuzi/subscribe"
            className="btn btn-sm btn-invisible text-gray d-inline-flex flex-items-center"
            style={{ gap: 6 }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg className="octicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25v-8.5C0 2.784.784 2 1.75 2ZM1.5 12.251c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V5.809L8.38 9.397a.75.75 0 0 1-.76 0L1.5 5.809v6.442Zm13-8.181v-.32a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25v.32L8 7.88Z"></path>
            </svg>
            Get updates
          </a>
          <a href="https://medium.com/@frdspuzi" className="f6 text-gray text-underline" target="_blank" rel="noopener noreferrer">
            View all &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
