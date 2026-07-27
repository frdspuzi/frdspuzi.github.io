// Joins adjacent closed `.js-accordion-group` sections into one flush block (shared square
// edge, no gap) and gives any open section its own fully-rounded, separated card — the
// "startsGroup"/"endsGroup" part of https://beui.dev/components/motion/bouncy-accordion that
// assets/js/accordion.js's open/close bounce alone doesn't cover. Currently applies to the 3
// main homepage sections (Reclaiming the Algo / Insights & Writing / Photography).
//
// Assumes every matched element forms ONE contiguous list (simple items[i-1]/items[i+1]
// adjacency) — correct for today's single group of 3; would need per-group scoping if this
// class is ever reused for a second, unrelated group on the same page.
//
// Tracks intended open state itself rather than reading `item.open` live on every update.
// accordion.js's close() doesn't flip `.open` (or fire the native `toggle` event) until its
// bounce animation finishes ~460ms later — reading `.open` directly would make the join
// transition start late, visibly lagging behind the close instead of running alongside it.
// The `accordion:willclose` event (dispatched by accordion.js at the *start* of closing)
// fixes that for the close path; opening already flips `.open` synchronously up front, so the
// native `toggle` event is early enough on its own for that direction.
(function () {
  // Must match accordion.js's own CLOSE/OPEN timing exactly — the joining transition and the
  // content height animation need to finish at the same moment. CLOSE deliberately does NOT
  // reuse the overshoot curve: border-radius is floored at 0 the same way height is, so an
  // easing whose eased progress exceeds 1.0 (verified: cubic-bezier(0.32, 1.2, 0.64, 1) is
  // above 1.0 from t≈0.62–0.97) clamps early and sits frozen for the last third of the
  // transition — the same "doesn't snap" stall accordion.js's CLOSE animation had, for the
  // same structural reason. Also NOT the reference's own EASE_OUT token ([0.16, 1, 0.3, 1]), and
  // NOT Material's *decelerate* curve ([0, 0, 0.2, 1]) either — both real, both non-overshooting,
  // both still front-load most of their progress early and crawl at the end. A decelerate shape
  // is simply the wrong direction for a closing/collapsing element — Material guidance calls for
  // an *accelerate* curve there (slow start, fast finish), the mirror of OPEN's curve. Matches
  // accordion.js's fix: Material's standard accelerate curve, verified non-overshooting.
  var CLOSE_TRANSITION = '0.46s cubic-bezier(0.4, 0, 1, 1)';
  var OPEN_TRANSITION = '0.58s cubic-bezier(0.34, 1.56, 0.64, 1)';

  function updateGrouping(items, state) {
    items.forEach(function (item, i) {
      var open = state[i];
      var prevClosed = i !== 0 && !state[i - 1];
      var nextClosed = i !== items.length - 1 && !state[i + 1];

      // Joined (flush, square, no gap) only when BOTH this item and its neighbor are closed.
      item.classList.toggle('group-joined-top', !open && prevClosed);
      item.classList.toggle('group-joined-bottom', !open && nextClosed);
    });
  }

  function setTransition(items, timing) {
    items.forEach(function (item) {
      item.style.transition =
        'margin-top ' + timing + ', border-radius ' + timing + ', border-top-color ' + timing;
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var items = Array.prototype.slice.call(document.querySelectorAll('.js-accordion-group'));
    if (!items.length) return;

    var state = items.map(function (item) {
      return item.open;
    });

    function recompute() {
      updateGrouping(items, state);
    }

    items.forEach(function (item, i) {
      item.addEventListener('accordion:willclose', function () {
        setTransition(items, CLOSE_TRANSITION);
        state[i] = false;
        recompute();
      });
      // Covers opening (already synchronous) and any non-accordion.js-driven change, e.g. the
      // Preview Rail's scrollToSection() setting `.open = true` directly.
      item.addEventListener('toggle', function () {
        if (item.open) setTransition(items, OPEN_TRANSITION);
        state[i] = item.open;
        recompute();
      });
    });

    recompute();
  });
})();
