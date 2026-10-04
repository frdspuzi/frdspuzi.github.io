import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccordionGroupProvider } from "@/hooks/useAccordionGroup";
import { ResearchSection } from "./ResearchSection";

vi.mock("@/lib/viewport", () => ({
  isDesktopWidthAtMount: () => true,
}));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("ResearchSection", () => {
  it("renders accordion header, pill tabs, and paper cards", () => {
    render(
      <AccordionGroupProvider>
        <ResearchSection />
      </AccordionGroupProvider>
    );

    expect(screen.getByText("Research Discovery")).toBeDefined();
    expect(screen.getByText(/Last updated:/)).toBeDefined();
    expect(screen.getByRole("tab", { name: "All" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Tech" })).toBeDefined();
    expect(
      screen.getByText(/A new approach of a path-tracking system/)
    ).toBeDefined();
  });
});
