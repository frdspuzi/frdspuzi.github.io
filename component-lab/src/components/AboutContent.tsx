import { useTypewriter } from "@/hooks/useTypewriter";

// React port of index.html's own markdown body — rendered via Jekyll's `{{ content }}` in
// _layouts/home.html, between masthead.html and gratitude.html, not part of masthead.html
// itself. Easy to miss porting since it's a separate file from the masthead include it visually
// sits right next to.
//
// The Hadith blockquote gets assets/js/quote-typing.js's typewriter-on-scroll-into-view treatment
// on the original (a generic "every <blockquote> on the page" site-wide rule, not specific to
// this quote) — see useTypewriter, also used by Gratitude.tsx's own Surah Ibrahim blockquote.
export function AboutContent() {
  const quoteRef = useTypewriter<HTMLQuoteElement>();
  return (
    // paddingTop, not a margin-top utility: Masthead's own bottom spacing lives on a deeply
    // nested div (the metadata row, several levels inside Masthead's outer position:relative
    // wrapper), not on Masthead's own root element — a margin here could collapse through that
    // chain in ways that are hard to predict without live inspection. Padding never collapses,
    // so this is guaranteed additive on top of whatever Masthead's own spacing resolves to.
    <div className="theme-fg" style={{ paddingTop: 32 }}>
      <span id="about"></span>
      <p className="f4 mb-4 theme-fg-muted">
        Hi, I'm Firdaus. I'm a software engineer based in Malaysia focusing on cloud
        infrastructure, validation automation, and AI integrations.
      </p>
      <p className="f4 mb-4 theme-fg-muted">
        However, this little corner of the internet isn't a resume—it's a personal space where I
        share my thoughts, reflections on life and faith, and technical explorations. My hope is
        that whatever you've learned here is passed on if beneficial, and improved upon if
        lacking.
      </p>
      <blockquote
        ref={quoteRef}
        className="my-5 p-4 text-left"
        style={{
          background: "var(--surface)",
          boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
          borderLeft: "4px solid var(--accent)",
          borderRadius: 4,
          color: "var(--fg)",
          fontStyle: "italic",
          fontSize: "1.05em",
          lineHeight: 1.6,
        }}
      >
        "When a man dies, his acts come to an end, but three, recurring charity, or{" "}
        <strong className="highlight-underline">
          knowledge (by which people) benefit
          <svg
            className="highlight-underline-svg"
            viewBox="0 0 100 12"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M2,7 Q50,9 98,7" pathLength={100}></path>
          </svg>
        </strong>
        , or a pious child, who prays for him (for the deceased)."
        <br />
        <span className="f6 mt-2 d-inline-block" style={{ fontStyle: "normal", opacity: 0.8 }}>
          —{" "}
          <a
            href="https://sunnah.com/muslim:1631"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Sahih Muslim 1631"
            style={{ color: "inherit", textDecoration: "underline" }}
          >
            Sahih Muslim 1631
          </a>
        </span>
      </blockquote>
    </div>
  );
}
