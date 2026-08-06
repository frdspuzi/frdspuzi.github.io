import { AccordionGroupProvider } from "@/hooks/useAccordionGroup";
import { Accordion } from "@/components/Accordion";
import { Masthead } from "@/components/Masthead";
import { Gratitude } from "@/components/Gratitude";
import { YoutubeFeed } from "@/components/YoutubeFeed";

// Homepage — mirrors _layouts/home.html's stacked layout. Sections are added here one at a
// time as they're ported (masthead → gratitude → YouTube feed → Insights & Writing →
// Photography → Preview Rail), matching the build order in the approved plan.
//
// AccordionGroupProvider wraps both #gratitude and #accordion-group (kept as separate divs,
// matching the original DOM) since accordion-mobile-single-open.js's mobile single-open
// coordination targets every details.animated-details site-wide, not scoped to one container.
//
// Temporary smoke test below (2 placeholder accordions) — confirms the AccordionGroup system
// (open/close bounce, joined borders, goo-popover) actually works end-to-end before porting the
// real sections on top of it. Replaced once the real sections land.
export default function Home() {
  return (
    <main className="container-lg py-6 p-responsive text-center">
      <Masthead />

      <AccordionGroupProvider>
        <div id="gratitude" className="mb-5 text-left">
          <Gratitude />
        </div>

        <div id="accordion-group" className="my-6">
          <YoutubeFeed />
          <Accordion
            id="test-b"
            groupable
            title={<h2 className="f2 fw-bold theme-fg mb-0">Section B</h2>}
            description="Test description for the goo-popover, section B."
          >
            <p className="theme-fg-muted">Accordion smoke test — section B content.</p>
          </Accordion>
        </div>
      </AccordionGroupProvider>
    </main>
  );
}
