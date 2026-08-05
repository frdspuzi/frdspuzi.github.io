// Mobile-only: opening one `<details class="animated-details">` closes any other that's open.
// Desktop is untouched — multiple sections can stay open simultaneously there, unchanged.
// Targets every `details.animated-details` on the page (the same selector accordion.js itself
// uses), not just the 3 grouped under #accordion-group, so Gratitude participates too.
//
// Closes a sibling via `summary.click()`, not `.open = false` directly — routes through
// accordion.js's real close() path, so the bounce animation and accordion-grouping.js's
// joined-border visuals both stay correct with zero changes to either file. For
// prefers-reduced-motion users, accordion.js never attaches its own click handler, so the same
// `summary.click()` falls through to the browser's native instant toggle instead — still correct.
//
// Checked live on every `toggle` (matchMedia re-evaluated each time, not cached at load), same
// convention floating_toc.html's rail already uses for this breakpoint. Also correctly covers
// floating_toc.html's scrollToSection() opening a section via direct `.open = true` assignment,
// since that still fires a native `toggle` event.
//
// Also scrolls the newly-opened section to the top of the viewport on mobile, so it visually
// dominates the screen instead of opening somewhere the visitor has to go hunting for (user
// request, 2026-08-04: "selecting a section should snap into full height... we can only see
// that section"). Deliberately delayed, not called immediately on toggle: accordion.js sets
// `.open = true` (firing this event) *before* its height-growth animation runs, and if a
// sibling above this one is being auto-closed at the same time, that sibling's own collapse
// shifts this section's top position upward as it shrinks. Scrolling immediately would target
// a position that's stale the moment either animation finishes. OPEN_MS matches accordion.js's
// own OPEN.duration exactly (see DESIGN.md's Motion section) — long enough for both this
// section's expansion and any closing sibling's collapse (460ms, shorter) to have settled.
var OPEN_MS = 580;

document.addEventListener('DOMContentLoaded', function () {
  var allDetails = Array.prototype.slice.call(document.querySelectorAll('details.animated-details'));
  if (allDetails.length < 2) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  allDetails.forEach(function (details) {
    details.addEventListener('toggle', function () {
      if (!details.open) return;
      if (!window.matchMedia('(max-width: 767px)').matches) return;
      allDetails.forEach(function (other) {
        if (other !== details && other.open) {
          var summary = other.querySelector(':scope > summary');
          if (summary) summary.click();
        }
      });
      // Reduced-motion users get no delay either: accordion.js never animates for them (height
      // is final the instant `.open` flips), so waiting out OPEN_MS would be an unmotivated
      // pause with nothing actually happening during it.
      setTimeout(function () {
        details.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }, reduceMotion ? 0 : OPEN_MS);
    });
  });
});
