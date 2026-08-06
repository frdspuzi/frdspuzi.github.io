import { AccordionGroupProvider } from "@/hooks/useAccordionGroup";
import { Masthead } from "@/components/Masthead";
import { AboutContent } from "@/components/AboutContent";
import { Gratitude } from "@/components/Gratitude";
import { YoutubeFeed } from "@/components/YoutubeFeed";
import { InsightsWriting } from "@/components/InsightsWriting";

// Homepage — mirrors _layouts/home.html's stacked layout. Sections are added here one at a
// time as they're ported (masthead → gratitude → YouTube feed → Insights & Writing →
// Photography → Preview Rail), matching the build order in the approved plan.
//
// AccordionGroupProvider wraps both #gratitude and #accordion-group (kept as separate divs,
// matching the original DOM) since accordion-mobile-single-open.js's mobile single-open
// coordination targets every details.animated-details site-wide, not scoped to one container.
export default function Home() {
  return (
    <main className="container-lg py-6 p-responsive text-center">
      <Masthead />
      <AboutContent />

      <AccordionGroupProvider>
        <div id="gratitude" className="mb-3 text-left">
          <Gratitude />
        </div>

        <div id="accordion-group" className="mt-3 mb-6">
          <YoutubeFeed />
          <InsightsWriting />
        </div>
      </AccordionGroupProvider>
    </main>
  );
}
