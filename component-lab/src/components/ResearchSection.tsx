import { useState } from "react";
import { Accordion } from "@/components/Accordion";
import { isDesktopWidthAtMount } from "@/lib/viewport";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import researchData from "../../../_data/research.json";
import type { ResearchData, ResearchPaper, ResearchTopic } from "@/data/research_types";

const ALL_TOPICS: readonly ResearchTopic[] = [
  "Tech",
  "Islamic Studies & Finance",
  "Career & Productivity",
];

const INITIAL_COUNT = 5;

export function ResearchSection() {
  const data = researchData as ResearchData;
  const papers = (data.papers ?? []) as ResearchPaper[];
  const lastUpdated = data.lastUpdated ?? "";

  const [activeTopic, setActiveTopic] = useState<string>("all");
  const [expanded, setExpanded] = useState<boolean>(false);

  // Only topics represented in current papers are shown
  const availableTopics = ALL_TOPICS.filter((topic) =>
    papers.some((p) => p.topics && p.topics.includes(topic))
  );

  const filteredPapers =
    activeTopic === "all"
      ? papers
      : papers.filter((p) => p.topics && p.topics.includes(activeTopic as ResearchTopic));

  const visibleCount = expanded
    ? filteredPapers.length
    : Math.min(INITIAL_COUNT, filteredPapers.length);
  const visiblePapers = filteredPapers.slice(0, visibleCount);
  const hiddenCount = filteredPapers.length - visibleCount;

  return (
    <Accordion
      id="research-discovery"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
      title={
        <h2
          id="research-discovery"
          className="f2 fw-bold theme-fg"
          style={{ marginBottom: "0 !important", borderBottom: "none" }}
        >
          Research Discovery
        </h2>
      }
      description="Peer-reviewed breakthroughs in Tech, Islamic Studies & Finance, and Career & Productivity — distilled into practical briefs with verified limitations."
    >
      <div className="research-feed">
        {lastUpdated && (
          <div className="text-gray f6 mb-3">
            Last updated: {lastUpdated}
          </div>
        )}

        {papers.length === 0 ? (
          <p className="text-gray">
            No research briefs yet — check back after the next scheduled intake.
          </p>
        ) : (
          <>
            {availableTopics.length > 0 && (
              <Tabs
                value={activeTopic}
                onValueChange={(val) => {
                  setActiveTopic(val);
                  setExpanded(false);
                }}
                variant="pill"
              >
                <TabsList className="mb-3">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {availableTopics.map((topic) => (
                    <TabsTrigger key={topic} value={topic}>
                      {topic}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            {filteredPapers.length === 0 ? (
              <p className="text-gray">
                No papers under {activeTopic} in the current snapshot.
              </p>
            ) : (
              <div className="d-flex flex-column gap-3">
                {visiblePapers.map((paper) => (
                  <article
                    key={paper.id}
                    className="Box p-3 border rounded-2 bg-subtle"
                    style={{ textAlign: "left" }}
                  >
                    <div className="d-flex flex-items-baseline flex-wrap gap-2 mb-2">
                      <h3 className="f4 fw-semibold lh-condensed mb-0">
                        <a
                          href={paper.fullTextUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="Link--primary"
                        >
                          {paper.title}
                        </a>
                      </h3>
                    </div>

                    <div className="text-gray f6 mb-2 d-flex flex-wrap gap-2 flex-items-center">
                      <span className="fw-semibold">{paper.venue}</span>
                      <span>•</span>
                      <span>{paper.publicationDate}</span>
                      <span>•</span>
                      <div className="d-inline-flex gap-1">
                        {paper.topics.map((t) => (
                          <span
                            key={t}
                            className="Label Label--secondary Label--inline"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                      {paper.codeUrl && (
                        <>
                          <span>•</span>
                          <a
                            href={paper.codeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="Link--secondary"
                          >
                            Code
                          </a>
                        </>
                      )}
                    </div>

                    <div className="f5 mb-2">
                      <p className="mb-1">{paper.summary}</p>
                    </div>

                    <div className="f6 text-small text-muted mb-2">
                      <strong>Practical application:</strong>{" "}
                      {paper.practicalUseCase}
                    </div>

                    <div className="f6 text-small color-fg-attention">
                      <strong>Limitation:</strong> {paper.limitation}
                    </div>
                  </article>
                ))}

                {filteredPapers.length > INITIAL_COUNT && (
                  <button
                    type="button"
                    className="btn mt-2"
                    style={{ alignSelf: "center" }}
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? "Show less" : `Load ${hiddenCount} more`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Accordion>
  );
}
