import { useEffect, useRef } from "react";

// React port of assets/js/quote-typing.js — typed out once, the first time the element scrolls
// into view. The original ran as one generic, site-wide "every <blockquote> on the page" rule;
// here each call is scoped to a single element via a ref, since React components render their own
// blockquotes independently rather than the original's post-DOMContentLoaded querySelectorAll
// sweep. Same character-by-character mechanic, same threshold, same reduced-motion skip.
const TYPE_SPEED_MS = 35;

// Recursively clones a node's children, keeping element structure (e.g. <br>, <svg>, <a>) intact
// but emptying every text node, so the quote's markup — links, highlight-underline SVGs, etc. —
// is correct from frame one and only the characters themselves get revealed over time.
function buildEmptyClone(sourceNode: Node) {
  const queue: { node: Text; text: string }[] = [];

  function walk(node: Node): Node {
    if (node.nodeType === Node.TEXT_NODE) {
      const empty = document.createTextNode("");
      queue.push({ node: empty, text: node.textContent || "" });
      return empty;
    }
    const clone = node.cloneNode(false);
    node.childNodes.forEach((child) => clone.appendChild(walk(child)));
    return clone;
  }

  const fragment = document.createDocumentFragment();
  sourceNode.childNodes.forEach((child) => fragment.appendChild(walk(child)));
  return { fragment, queue };
}

export function useTypewriter<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || reduceMotion || typeof IntersectionObserver === "undefined") return;

    let tickTimeoutId = 0;

    function typeQuote(target: HTMLElement) {
      const built = buildEmptyClone(target);
      target.innerHTML = "";
      target.appendChild(built.fragment);

      const cursor = document.createElement("span");
      cursor.className = "typing-cursor";
      target.appendChild(cursor);

      const queue = built.queue;
      let qi = 0;
      let ci = 0;

      function tick() {
        if (qi >= queue.length) {
          cursor.remove();
          return;
        }
        const entry = queue[qi];
        if (ci < entry.text.length) {
          entry.node.textContent += entry.text.charAt(ci);
          ci++;
          tickTimeoutId = window.setTimeout(tick, TYPE_SPEED_MS);
        } else {
          qi++;
          ci = 0;
          tick();
        }
      }

      tick();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.unobserve(entries[0].target);
        typeQuote(entries[0].target as HTMLElement);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      window.clearTimeout(tickTimeoutId);
    };
  }, []);

  return ref;
}
