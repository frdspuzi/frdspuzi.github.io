// On-load reveal sweep for every <span class="aurora-text">, ported from magicui's
// DiaTextReveal (https://magicui.design/docs/components/dia-text-reveal) — ~verbatim port of
// its `sweepEase`/band-position math, adapted to drive a `mask-image` instead of literal
// colors, since .aurora-text already has its own continuous rainbow shimmer (assets/styles.scss)
// that we want to keep running as the "revealed" state, not settle to one flat color.
(function () {
  var BAND_HALF = 17; // percent — half-width of the soft reveal edge, matches the reference
  var SWEEP_START = -BAND_HALF;
  var SWEEP_END = 100 + BAND_HALF;
  var DURATION = 1400; // ms
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Same custom cubic ease as the reference — snappier than a plain ease-out.
  function sweepEase(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Left of the band = already revealed (opaque); right of the band = not yet revealed
  // (transparent); the band itself is a soft linear ramp between the two.
  function maskFor(pos) {
    var bandStart = pos - BAND_HALF;
    var bandEnd = pos + BAND_HALF;
    var clampedStart = Math.max(bandStart, 0).toFixed(2);
    var clampedEnd = Math.min(bandEnd, 100).toFixed(2);
    var stops = ['white ' + clampedStart + '%', 'transparent ' + clampedEnd + '%'];
    if (bandEnd < 100) stops.push('transparent 100%');
    return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
  }

  function reveal(el) {
    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / DURATION, 1);
      var pos = SWEEP_START + (SWEEP_END - SWEEP_START) * sweepEase(t);
      var mask = maskFor(pos);
      el.style.webkitMaskImage = mask;
      el.style.maskImage = mask;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        el.style.webkitMaskImage = '';
        el.style.maskImage = '';
      }
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (reduceMotion) return; // leave fully visible, no sweep
    document.querySelectorAll('.aurora-text').forEach(reveal);
  });
})();
