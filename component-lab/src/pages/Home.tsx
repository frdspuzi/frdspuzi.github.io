import { AccordionGroupProvider } from "@/hooks/useAccordionGroup";
import { Accordion } from "@/components/Accordion";

// Homepage — mirrors _layouts/home.html's stacked layout. Sections are added here one at a
// time as they're ported (masthead → gratitude → YouTube feed → Insights & Writing →
// Photography → Preview Rail), matching the build order in the approved plan.
//
// Temporary smoke test below (2 placeholder accordions) — confirms the AccordionGroup system
// (open/close bounce, joined borders, goo-popover) actually works end-to-end before porting the
// real sections on top of it. Replaced once the real sections land.
export default function Home() {
  return (
    <main className="container-lg py-6 p-responsive text-center">
      <AccordionGroupProvider>
        <div id="accordion-group" className="my-6">
          <Accordion
            id="test-a"
            groupable
            defaultOpen
            title={<h2 className="f2 fw-bold theme-fg mb-0">Section A</h2>}
            description="Test description for the goo-popover, section A."
          >
            <p className="theme-fg-muted">Accordion smoke test — section A content.</p>
          </Accordion>
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
