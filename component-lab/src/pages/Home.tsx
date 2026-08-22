import { AccordionGroupProvider } from "@/hooks/useAccordionGroup";
import { Masthead } from "@/components/Masthead";
import { AboutContent } from "@/components/AboutContent";
import { Gratitude } from "@/components/Gratitude";
import { YoutubeFeed } from "@/components/YoutubeFeed";
import { InsightsWriting } from "@/components/InsightsWriting";
import { Photography } from "@/components/Photography";
import { TrendingSection } from "@/components/TrendingSection";
import { FloatingNav } from "@/components/FloatingNav";

// Homepage — mirrors _layouts/home.html's stacked layout. All 5 sections plus the Preview Rail
// nav are built now, matching the approved plan's build order.
//
// AccordionGroupProvider wraps #gratitude, #accordion-group, and FloatingNav (kept as separate
// divs, matching the original DOM) since accordion-mobile-single-open.js's mobile single-open
// coordination targets every details.animated-details site-wide, not scoped to one container —
// and FloatingNav needs the same context to open a closed section before scrolling to it.
export default function Home() {
  return (
    <main className="container-lg py-6 p-responsive text-center">
      <Masthead />
      <AboutContent />

      <AccordionGroupProvider>
        <div id="gratitude" className="mb-3 text-left">
          <Gratitude />
        </div>

        <div id="accordion-group" className="mt-3 mb-6 text-left">
          <YoutubeFeed />
          <InsightsWriting />
          <TrendingSection />
          <Photography />
        </div>

        <FloatingNav />
      </AccordionGroupProvider>
    </main>
  );
}
