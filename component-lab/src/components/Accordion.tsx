import { useEffect, useRef, type ReactNode } from "react";
import { useAccordionGroup } from "@/hooks/useAccordionGroup";
import { useAnimatedDisclosure } from "@/hooks/useAnimatedDisclosure";

// React port of accordion.js's bounce open/close. The vanilla version drove this imperatively
// from a click handler; here the *state* (open/closed, via useAccordionGroup) is the source of
// truth and useAnimatedDisclosure *reacts* to it changing — more idiomatic for React, same
// visual result. The animation mechanic itself (WAAPI, settle()/guardId staleness guard, the
// close-animates-padding-too fix) lives in that shared hook — see its own comments for why each
// exists — since Gratitude.tsx's plain disclosure needs the identical mechanic under different
// header markup.
//
// `isOpen(id, defaultOpen)`/`toggle(id, defaultOpen)` pass this accordion's own defaultOpen prop
// straight through on every call, rather than seeding it via a mount-effect toggle() — that used
// to make `open` lag true by one render for every defaultOpen accordion, which was the root cause
// of a whole run of bugs (open-then-forced-shut on mobile, a stale animation re-closing content
// after the fix, React's own reactive display style racing the imperative animation). The content
// div below must never set its own `display` style — useAnimatedDisclosure owns that exclusively.

type AccordionProps = {
  id: string;
  title: ReactNode;
  description?: ReactNode; // goo-popover content, shown only while open — same as the original
  groupable?: boolean; // true for the 3 main homepage sections (joined-border treatment)
  defaultOpen?: boolean;
  // Optional escape hatch for a child whose own height can be stale while this section is
  // closed (currently only TriviaBoard, via InsightsWriting) — see useAnimatedDisclosure's own
  // comment for exactly when this runs and why it has to be a synchronous callback, not an
  // effect on the child's own side.
  onBeforeMeasure?: () => void;
  children: ReactNode;
};

export function Accordion({
  id,
  title,
  description,
  groupable = false,
  defaultOpen = false,
  onBeforeMeasure,
  children,
}: AccordionProps) {
  const { isOpen, toggle, register, isJoinedTop, isJoinedBottom, scrollIntoViewIfMobile } =
    useAccordionGroup();
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    register(id, groupable, defaultOpen, detailsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = isOpen(id, defaultOpen);
  const contentRef = useAnimatedDisclosure(open, () => scrollIntoViewIfMobile(id), onBeforeMeasure);

  const joinedTop = isJoinedTop(id);
  const joinedBottom = isJoinedBottom(id);

  return (
    <div
      ref={detailsRef}
      className={
        "details-reset animated-details" +
        (groupable ? " js-accordion-group" : "") +
        (open ? " is-open" : "") +
        (joinedTop ? " group-joined-top" : "") +
        (joinedBottom ? " group-joined-bottom" : "")
      }
      style={{ background: "var(--overlay-bg)" }}
    >
      <div
        className="p-4 d-flex flex-justify-between flex-items-center"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => toggle(id, defaultOpen)}
      >
        <div className="d-flex flex-items-center" style={{ gap: 8 }}>
          {title}
          {description && (
            <div className="goo-popover goo-popover-summary">
              <button
                type="button"
                className="goo-popover-trigger"
                aria-label="About this section"
                aria-describedby={`${id}-desc`}
                onClick={(e) => e.stopPropagation()}
              >
                <span aria-hidden="true">i</span>
              </button>
              <span className="goo-popover-blob" aria-hidden="true">
                <span className="goo-popover-dot"></span>
                <span className="goo-popover-panel-shape"></span>
              </span>
              <div id={`${id}-desc`} role="tooltip" className="goo-popover-content">
                {description}
              </div>
            </div>
          )}
        </div>
        <svg
          className="collapse-arrow text-gray flex-shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          width="24"
          height="24"
          fill="currentColor"
        >
          <path d="M12.78 6.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 7.28a.75.75 0 0 1 1.06-1.06L8 9.94l3.72-3.72a.75.75 0 0 1 1.06 0Z"></path>
        </svg>
      </div>
      <div ref={contentRef} className="p-4 text-left accordion-content">
        {children}
      </div>
    </div>
  );
}
