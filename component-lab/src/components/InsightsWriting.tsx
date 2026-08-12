import { useMemo, useRef, useState } from "react";
import { Accordion } from "@/components/Accordion";
import { MediumTray } from "@/components/MediumTray";
import { TriviaBoard, type TriviaBoardHandle } from "@/components/TriviaBoard";
import { isDesktopWidthAtMount } from "@/lib/viewport";
import mediumData from "../../../_data/medium.json";
import type { MediumItem } from "@/data/insights_types";

// React port of thoughts.html. `activeFilter` is lifted here (rather than the original's
// window.filterTrivia global bridge) since it's the one piece of state both MediumTray's filter
// buttons and TriviaBoard's question pool need to agree on — ordinary React data flow for what
// vanilla needed a global function for.
export function InsightsWriting() {
  const items = mediumData as MediumItem[];
  const [activeFilter, setActiveFilter] = useState("all");
  const triviaRef = useRef<TriviaBoardHandle>(null);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const item of items) {
      const category = item.categories && item.categories.length > 0 ? item.categories[0] : "uncategorized";
      if (category !== "uncategorized" && !seen.includes(category)) seen.push(category);
    }
    return seen;
  }, [items]);

  return (
    <Accordion
      id="my-writing"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
      onBeforeMeasure={() => triviaRef.current?.remeasure()}
      title={
        <h2
          id="my-writing"
          className="f2 fw-bold theme-fg"
          style={{ marginBottom: "0 !important", borderBottom: "none" }}
        >
          Insights &amp; Writing
        </h2>
      }
      description="Articles I've published on Medium."
    >
      {/* alignItems: stretch (not flex-start): the Medium tray should follow the trivia card's
          own fixed, benchmarked height rather than sitting at its own shorter natural size — see
          #medium-posts' flex: 1 in MediumTray.tsx for the other half of this (it's what actually
          claims that stretched space; overflow-y: auto already there is the "unless maxed out"
          cap, scrolling internally instead of growing past whatever height it's handed). */}
      <div className="d-flex flex-column flex-lg-row" style={{ gap: 32, alignItems: "stretch" }}>
        <MediumTray items={items} categories={categories} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

        {/* flex-shrink-0 (present in the original's own inline style) deliberately dropped here —
            see .insights-column in site.scss for why: paired with MediumTray's column defaulting
            to shrink:1, it made this be the only column of the two that held its full col-lg-6
            width when the row's gap forced a shrink, silently pushing the Medium column narrower
            instead of splitting that shrink evenly between them. */}
        <div className="col-12 col-lg-6 insights-column d-flex flex-column">
          <TriviaBoard ref={triviaRef} activeFilter={activeFilter} />
        </div>
      </div>
    </Accordion>
  );
}
