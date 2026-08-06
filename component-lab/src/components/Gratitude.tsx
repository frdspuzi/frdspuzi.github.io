import { useEffect, useRef, useState } from "react";
import { useAccordionGroup } from "@/hooks/useAccordionGroup";
import { useAnimatedDisclosure } from "@/hooks/useAnimatedDisclosure";
import gratitudeData from "../../../_data/gratitude.json";

// React port of gratitude.html. Not one of the 3 "groupable" homepage sections (no joined-border
// treatment) but still registers with useAccordionGroup so it participates in mobile
// single-open, same as accordion-mobile-single-open.js targeting every details.animated-details
// in the original, not just the .js-accordion-group ones.

// Readily available fallback suggestions, same as the original inline script's own default list.
const DEFAULT_SUGGESTIONS = [
  "I'm grateful for a smooth deployment to production today, alhamdulillah.",
  "I'm thankful for a good cup of teh tarik and a bug-free day.",
  "I'm grateful for the rain that cooled down the weather.",
  "I'm thankful for the opportunity to learn a new framework today.",
  "I'm grateful for my health, which allows me to code, travel, and pray.",
  "I'm grateful for the peaceful moments before Fajr to clear my mind.",
  "I'm thankful for the supportive teammates who helped me squash that tricky bug.",
  "I'm grateful for the rezeki of a stable job in tech.",
  "I'm thankful for the delicious nasi lemak breakfast this morning.",
  "I'm grateful for the time to spend with family this weekend.",
];

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  let currentIndex = result.length;
  while (currentIndex !== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [result[currentIndex], result[randomIndex]] = [result[randomIndex], result[currentIndex]];
  }
  return result;
}

const TYPE_SPEED_MS = 30;
const API_DELAY_MS = 600;

export function Gratitude() {
  const id = "gratitude";
  const { isOpen, toggle, register, scrollIntoViewIfMobile } = useAccordionGroup();
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    register(id, false, false, detailsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = isOpen(id);
  const contentRef = useAnimatedDisclosure(open, () => scrollIntoViewIfMobile(id));

  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const queueRef = useRef<string[]>([]);
  const typeTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const apiDelayTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function getNextSuggestion() {
    if (queueRef.current.length === 0) {
      // Refill: shuffled AI suggestions first (prioritized), then shuffled defaults.
      queueRef.current = shuffle(gratitudeData.suggestions ?? []).concat(shuffle(DEFAULT_SUGGESTIONS));
    }
    return queueRef.current.shift()!;
  }

  function handleSuggest() {
    if (typeTimeout.current) clearTimeout(typeTimeout.current);
    if (apiDelayTimeout.current) clearTimeout(apiDelayTimeout.current);

    const next = getNextSuggestion();
    setText("");
    setThinking(true);

    apiDelayTimeout.current = setTimeout(() => {
      setThinking(false);
      let i = 0;
      function typeWriter() {
        if (i < next.length) {
          i++;
          setText(next.slice(0, i));
          typeTimeout.current = setTimeout(typeWriter, TYPE_SPEED_MS);
        }
      }
      typeWriter();
    }, API_DELAY_MS);
  }

  function handleClear() {
    if (typeTimeout.current) clearTimeout(typeTimeout.current);
    if (apiDelayTimeout.current) clearTimeout(apiDelayTimeout.current);
    setText("");
    setThinking(false);
  }

  return (
    <div ref={detailsRef} className={"details-reset animated-details" + (open ? " is-open" : "")}>
      <div
        className="d-inline-flex flex-items-center text-gray f5"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => toggle(id)}
      >
        <svg
          className="collapse-arrow mr-2"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 7.28a.75.75 0 0 1 1.06-1.06L8 9.94l3.72-3.72a.75.75 0 0 1 1.06 0Z"></path>
        </svg>
        Before you scroll, try this...
      </div>
      <div ref={contentRef} className="pt-3">
        <div className="mb-3">
          <blockquote
            className="mb-3 p-3"
            style={{
              background: "var(--surface)",
              borderLeft: "3px solid var(--accent)",
              borderRadius: 4,
              color: "var(--fg)",
              fontStyle: "italic",
              fontSize: "0.9em",
              lineHeight: 1.5,
            }}
          >
            "And [remember] when your Lord proclaimed, 'If you are grateful, I will surely increase you [in
            favor]; but if you deny, indeed, My punishment is severe." <br />
            <small className="text-gray">
              —{" "}
              <a
                href="https://quran.com/ms/ibrahim/7?translations=20"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "underline" }}
              >
                Surah Ibrahim (14:7)
              </a>
            </small>
          </blockquote>
          <p className="text-gray mb-3" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Recognizing our blessings is the first step to receiving more. Drop a quick note of gratitude here
            to reset your mindset for the day.{" "}
            <em>(This is a private exercise, nothing is recorded or shared.)</em>
          </p>
          <textarea
            id="gratitude-text"
            className="form-control width-full mb-2"
            rows={2}
            placeholder="I am grateful for..."
            style={{ resize: "vertical", fontSize: 14 }}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="d-flex flex-justify-between flex-items-center mt-2">
            <button
              id="ai-suggest-btn"
              className="btn btn-outline d-inline-flex flex-items-center"
              style={{ gap: 6 }}
              type="button"
              disabled={thinking}
              onClick={handleSuggest}
            >
              {thinking ? (
                "Thinking..."
              ) : (
                <>
                  <svg className="octicon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
                    <path
                      fillRule="evenodd"
                      d="M7.525 1.15c.2-.56.93-.56 1.13 0l1.178 3.284a2 2 0 0 0 1.258 1.258l3.284 1.178c.56.2.56.93 0 1.13l-3.284 1.178a2 2 0 0 0-1.258 1.258l-1.178 3.284c-.2.56-.93.56-1.13 0l-1.178-3.284a2 2 0 0 0-1.258-1.258L1.605 8.565c-.56-.2-.56-.93 0-1.13l3.284-1.178a2 2 0 0 0 1.258-1.258l1.178-3.284Z"
                    ></path>
                  </svg>
                  AI Suggestion
                </>
              )}
            </button>
            <button
              id="clear-gratitude-btn"
              className="btn btn-sm btn-invisible text-gray"
              type="button"
              onClick={handleClear}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
