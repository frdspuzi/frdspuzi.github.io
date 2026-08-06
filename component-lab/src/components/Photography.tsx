import { Accordion } from "@/components/Accordion";
import { PhotographyCanvas } from "@/components/PhotographyCanvas";
import { isDesktopWidthAtMount } from "@/lib/viewport";

// React port of photography.html. Reuses the shared Accordion (the 3rd and last of the
// groupable homepage sections) — only the Infinite Image Field canvas itself is section-specific.
export function Photography() {
  return (
    <Accordion
      id="photography"
      groupable
      defaultOpen={isDesktopWidthAtMount()}
      title={
        <h2 className="f2 fw-bold theme-fg" style={{ marginBottom: "0 !important", borderBottom: "none" }}>
          Photography
        </h2>
      }
      description={
        <>
          Shots I've captured and shared on{" "}
          <a
            href="https://unsplash.com/@frdspuzi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-underline"
          >
            Unsplash
          </a>
          .
        </>
      }
    >
      <PhotographyCanvas />
    </Accordion>
  );
}
