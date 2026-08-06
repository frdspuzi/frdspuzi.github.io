import { useEffect, useRef, type ReactNode } from "react";
import { useAccordionGroup } from "@/hooks/useAccordionGroup";

// React port of accordion.js's bounce open/close (Web Animations API, same curves/durations —
// see DESIGN.md's Motion section for why these specific cubic-beziers). The vanilla version
// drove this imperatively from a click handler; here the *state* (open/closed, via
// useAccordionGroup) is the source of truth and this effect *reacts* to it changing — more
// idiomatic for React, same visual result. `fill: 'forwards'` reasoning, the settle()/guardId
// staleness guard, and the close-animates-padding-too fix are all carried over unchanged from
// the original — see its own comments for why each exists.
// Plain numeric constants (not read back off OPEN.duration/CLOSE.duration below) since WAAPI's
// own KeyframeAnimationOptions['duration'] type allows string/CSSNumericValue too — arithmetic
// on that union needs a definite number, which these already are by construction.
const OPEN_DURATION = 580;
const CLOSE_DURATION = 460;
const OPEN: KeyframeAnimationOptions = {
  duration: OPEN_DURATION,
  easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  fill: "forwards",
};
const CLOSE: KeyframeAnimationOptions = {
  duration: CLOSE_DURATION,
  easing: "cubic-bezier(0.4, 0, 1, 1)",
  fill: "forwards",
};

type AccordionProps = {
  id: string;
  title: ReactNode;
  description?: ReactNode; // goo-popover content, shown only while open — same as the original
  groupable?: boolean; // true for the 3 main homepage sections (joined-border treatment)
  defaultOpen?: boolean;
  children: ReactNode;
};

export function Accordion({
  id,
  title,
  description,
  groupable = false,
  defaultOpen = false,
  children,
}: AccordionProps) {
  const { isOpen, toggle, register, isJoinedTop, isJoinedBottom, scrollIntoViewIfMobile } =
    useAccordionGroup();
  const detailsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const guardId = useRef(0);
  const hasMountedOpen = useRef(false);

  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    register(id, groupable, detailsRef.current);
    if (defaultOpen && !hasMountedOpen.current) {
      hasMountedOpen.current = true;
      toggle(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = isOpen(id);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    if (reduceMotion) {
      // No WAAPI at all for reduced motion — native instant show/hide, matching accordion.js's
      // own "never attaches its own click handler" fallback.
      content.style.display = open ? "" : "none";
      if (open) scrollIntoViewIfMobile(id);
      return;
    }

    const thisGuard = ++guardId.current;
    function settle(isClose: boolean) {
      if (thisGuard !== guardId.current) return; // superseded by a newer toggle
      animRef.current?.cancel();
      content!.style.height = "";
      content!.style.paddingTop = "";
      content!.style.paddingBottom = "";
      content!.style.overflow = "";
      if (isClose) content!.style.display = "none";
    }

    if (open) {
      content.style.display = "";
      const target = content.scrollHeight;
      const computed = getComputedStyle(content);
      const padTop = computed.paddingTop;
      const padBottom = computed.paddingBottom;
      content.style.overflow = "hidden";
      const anim = content.animate(
        [
          { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" },
          { height: `${target}px`, opacity: 1, paddingTop: padTop, paddingBottom: padBottom },
        ],
        OPEN,
      );
      animRef.current = anim;
      anim.onfinish = () => settle(false);
      anim.oncancel = () => settle(false);
      window.setTimeout(() => settle(false), OPEN_DURATION + 400);
      scrollIntoViewIfMobile(id);
    } else if (content.style.display !== "none") {
      const current = content.scrollHeight;
      const computed = getComputedStyle(content);
      const padTop = computed.paddingTop;
      const padBottom = computed.paddingBottom;
      content.style.overflow = "hidden";
      const anim = content.animate(
        [
          { height: `${current}px`, opacity: 1, paddingTop: padTop, paddingBottom: padBottom },
          { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" },
        ],
        CLOSE,
      );
      animRef.current = anim;
      anim.onfinish = () => settle(true);
      anim.oncancel = () => settle(true);
      window.setTimeout(() => settle(true), CLOSE_DURATION + 400);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
        onClick={() => toggle(id)}
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
      <div
        ref={contentRef}
        className="p-4 text-left accordion-content"
        style={{ display: defaultOpen ? "" : "none" }}
      >
        {children}
      </div>
    </div>
  );
}
