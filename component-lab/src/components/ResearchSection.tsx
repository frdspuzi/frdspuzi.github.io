import { useState } from "react";
import { motion } from "motion/react";
import { Accordion } from "@/components/Accordion";
import { isDesktopWidthAtMount } from "@/lib/viewport";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { useSquirclePath } from "@/hooks/useSquirclePath";
import researchData from "../../../_data/research.json";
import type { ResearchData, ResearchPaper, ResearchTopic } from "@/data/research_types";

const ALL_TOPICS: readonly ResearchTopic[] = [
  "Tech",
  "Islamic Studies & Finance",
  "Career & Productivity",
];

const INITIAL_COUNT = 5;

function ResearchCard({ paper, rank }: { paper: ResearchPaper; rank: number }) {
  const { ref: squircleRef, clipPath } = useSquirclePath(24);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ type: "spring", stiffness: 350, damping: 40, delay: 0.2 }}
      style={{ transformOrigin: "top center" }}
    >
      <article
        ref={squircleRef}
        className="Box box-shadow-small p-4 text-left"
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: "none",
          background: "var(--surface)",
          clipPath: clipPath ?? undefined,
          borderRadius: clipPath ? undefined : 16,
        }}
      >
        {/* Title with inline rank */}
        <h3
          className="trending-card-title text-bold lh-condensed mb-2"
          style={{ color: "var(--fg)", minWidth: 0 }}
        >
          <span className="text-gray" style={{ fontWeight: 400, marginRight: 6 }}>
            #{rank}
          </span>
          <a
            href={paper.fullTextUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--fg)", textDecoration: "none" }}
          >
            {paper.title}
          </a>
        </h3>

        {/* Metadata: Authors & Institution • Date • Topics • Code */}
        <div
          className="trending-card-meta text-gray d-flex flex-wrap flex-items-center mb-2"
          style={{ gap: 6 }}
        >
          {paper.leadAuthor && <span>{paper.leadAuthor}</span>}
          {paper.institution && <span>•</span>}
          {paper.institution && <span>{paper.institution}</span>}
          <span>•</span>
          <span>{paper.publicationDate}</span>
          {paper.topics.map((t) => (
            <span
              key={t}
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                background: "var(--surface-page)",
                border: "1px solid var(--border)",
                fontSize: "11px",
                color: "var(--fg-muted)",
              }}
            >
              {t}
            </span>
          ))}
          {paper.codeUrl && (
            <>
              <span>•</span>
              <a
                href={paper.codeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--fg-muted)", textDecoration: "underline" }}
              >
                Code
              </a>
            </>
          )}
        </div>

        {/* Problem / Fix */}
        <p
          className="trending-card-hook mb-1"
          style={{ color: "var(--fg-muted)", lineHeight: 1.5 }}
        >
          <strong>Problem.</strong> {paper.problem}
        </p>
        <p
          className="trending-card-hook mb-2"
          style={{ color: "var(--fg-muted)", lineHeight: 1.5 }}
        >
          <strong>Fix.</strong> {paper.fix}
        </p>

        {/* Why it matters */}
        <p
          className="trending-card-personalization text-gray mb-1"
          style={{ fontStyle: "italic", lineHeight: 1.45 }}
        >
          Why it matters: {paper.practicalUseCase}
        </p>

        {/* Caveat */}
        <p
          className="trending-card-personalization text-gray mb-0"
          style={{ lineHeight: 1.45 }}
        >
          Caveat: {paper.limitation}
        </p>
      </article>
    </motion.div>
  );
}

export function ResearchSection() {
  const data = researchData as ResearchData;
  const papers = (data.papers ?? []) as ResearchPaper[];

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
      <div className="research-feed" style={{ textAlign: "left" }}>
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
                <TabsList className="mb-4">
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
              <motion.div
                key={activeTopic}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="d-flex flex-column gap-3"
              >
                {visiblePapers.map((paper, index) => (
                  <ResearchCard key={paper.id} paper={paper} rank={index + 1} />
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
              </motion.div>
            )}
          </>
        )}
      </div>
    </Accordion>
  );
}
