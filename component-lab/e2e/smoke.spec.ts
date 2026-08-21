import { expect, test } from "@playwright/test"

// Build/deploy-verification infra, not feature coverage - same category as deploy-pages.yml's
// own "Verify live deployment" step. Confirms the app actually boots and renders in a real
// browser with zero console errors; the first feature-specific E2E spec (per .ai/architecture.md)
// is separate, future work.
test("homepage boots and renders without console errors", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })

  await page.goto("/")

  await expect(page.locator("h1")).toBeVisible()
  expect(consoleErrors).toEqual([])
})
