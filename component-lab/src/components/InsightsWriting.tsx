import { useMemo, useState } from "react";
import { Accordion } from "@/components/Accordion";
import { MediumTray } from "@/components/MediumTray";
import { TriviaBoard } from "@/components/TriviaBoard";
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
      <div className="d-flex flex-column flex-lg-row" style={{ gap: 32, alignItems: "flex-start" }}>
        <MediumTray items={items} categories={categories} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

        <div className="col-12 col-lg-6 flex-shrink-0 d-flex flex-column">
          <TriviaBoard activeFilter={activeFilter} />
        </div>
      </div>
    </Accordion>
  );
}
