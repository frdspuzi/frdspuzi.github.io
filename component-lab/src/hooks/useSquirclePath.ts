import { useEffect, useRef, useState } from "react";
import { getSvgPath } from "figma-squircle";

// figma-squircle's getSvgPath computes an SVG path in absolute pixel coordinates, not relative
// units - it needs the element's real rendered width/height, which for a responsive card
// (variable column width) with content-driven height (variable hook/personalization text length)
// can't be known up front and changes over the element's lifetime. ResizeObserver keeps the path
// in sync with the actual box.
//
// The `> 0` guard on width/height matches this codebase's own established ResizeObserver
// invariant (see component-lab/.ai/architecture.md's #4): anything inside an <Accordion> can be
// hidden by an ancestor's display:none while the section is closed, which reports a 0x0 content
// rect here - without the guard, that would collapse the squircle to a zero-size path, and since
// the observer's next real-size report only fires asynchronously (not synchronously with the
// section reopening), the card would render with no visible shape at all until some later,
// unrelated resize happened to fire the callback again.
export function useSquirclePath(cornerRadius: number, cornerSmoothing = 0.8) {
  const ref = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      // borderBoxSize, not the default contentRect - contentRect excludes padding/border, but
      // the clip-path this computes gets applied to the same element the padding lives on (this
      // card is p-4). Clipping the border-box to a shape sized from the smaller content-box cut
      // real content off at the padded edge - confirmed visually (star-count text truncated on
      // the right) before switching to borderBoxSize here.
      const size = entries[0].borderBoxSize[0];
      const width = size.inlineSize;
      const height = size.blockSize;
      if (width > 0 && height > 0) {
        setPath(getSvgPath({ width, height, cornerRadius, cornerSmoothing }));
      }
    });
    observer.observe(el, { box: "border-box" });
    return () => observer.disconnect();
  }, [cornerRadius, cornerSmoothing]);

  return { ref, clipPath: path ? `path('${path}')` : undefined };
}
