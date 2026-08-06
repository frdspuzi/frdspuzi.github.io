import { useState } from "react";
import type { MediumItem } from "@/data/insights_types";

// React port of thoughts.html's #medium-posts card list + #medium-filters buttons. Rendered as
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

function shrinkMediumImage(url: string, targetWidth: number): string {
  return url
    .replace(/resize:fit:\d+(\/format:\w+)?/, "resize:fit:" + targetWidth + "/format:webp")
    .replace(/\/max\/\d+\//, "/v2/resize:fit:" + targetWidth + "/format:webp/");
}

function findImageUrl(content: string, targetWidth: number): string | null {
  const imgRegex = /<img[^>]+src="([^">]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(content)) !== null) {
    if (match[1].indexOf("stat?event") === -1) {
      return shrinkMediumImage(match[1], targetWidth);
    }
  }
  return null;
}

function categoryOf(item: MediumItem): string {
  return item.categories && item.categories.length > 0 ? item.categories[0] : "uncategorized";
}

function RowCard({ item }: { item: MediumItem }) {
  const excerpt = extractSummary(item.content);
  const imageUrl = findImageUrl(item.content, 320);
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
            {category !== "uncategorized" && <span className="medium-tag">{category}</span>}
          </div>
        </div>
      </div>
    </a>
  );
}

function StoryCard({ item }: { item: MediumItem }) {
  const excerpt = extractSummary(item.content);
  const imageUrl = findImageUrl(item.content, 240);
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
      {category !== "uncategorized" && <span className="medium-tag medium-story-tag">{category}</span>}
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

  return (
    <div className="col-12 col-lg-6 right-column-container d-flex flex-column" style={{ minWidth: 0 }}>
      <div className="right-column-content d-flex flex-column w-100 h-100">
        <div className="d-flex flex-justify-between flex-items-center mb-3 flex-shrink-0">
          {categories.length > 0 && (
            <div id="medium-filters" className="d-flex" style={{ flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <button
                className={"medium-filter-btn" + (activeFilter === "all" ? " active" : "")}
                onClick={() => onFilterChange("all")}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={"medium-filter-btn" + (activeFilter === cat ? " active" : "")}
                  onClick={() => onFilterChange(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-gray">No articles found.</p>
        ) : (
          <div id="medium-posts" className="custom-scrollbar">
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
