// Bouncy open/close animation for every `<details class="animated-details">` on the site.
// Shared site-wide (not per-include) since it's a cross-cutting UI primitive, not a single
// feature — see the "Interaction Rules" exception noted in .ai/architecture.md.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // `fill: 'forwards'` on both: without it (WAAPI's default is `fill: 'none'`), the instant the
  // animation's active duration elapses, the browser un-applies its effect and `content` reverts
  // to its underlying value (no inline height set yet, since that only happens in `onfinish`) for
  // however long it takes `onfinish` to actually run — a one-frame flash back to full height
  // right as a close finishes. `forwards` holds the last keyframe's value until onfinish's own
  // cleanup takes over, so there's no gap to flash through.
  var OPEN = { duration: 580, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards' };
  // No overshoot here, unlike OPEN — height is floored at 0, so an easing curve whose eased
  // progress exceeds 1.0 (the classic "back-out" bounce shape) makes height clamp at 0 early
  // and sit there, visibly frozen, until the animation's clock actually runs out. Verified by
  // plotting cubic-bezier(0.32, 1.2, 0.64, 1)'s Y values: it's above 1.0 from t≈0.62–0.97,
  // roughly the last third of the close — exactly the stall this was causing.
  //
  // NOT the reference's own EASE_OUT token ([0.16, 1, 0.3, 1]), and NOT Material's *decelerate*
  // curve ([0, 0, 0.2, 1]) either — both tried in turn, both real non-overshooting curves, both
  // still front-load most of their progress early and crawl at the end (99.6%/94.7% progress by
  // 70% of the duration respectively), which reads as "fast shrink, then it just sits there,
  // then resolves" on a section-sized close no matter how much the tail is flattened, because a
  // *decelerate* shape is simply the wrong direction for an exiting/collapsing element — Material
  // motion guidance actually calls for an *accelerate* curve there (slow start, fast finish),
  // the mirror of what an entering/expanding element like OPEN should use. Switched to Material's
  // standard accelerate curve: builds speed and closes decisively instead of crawling to a stop.
  // Verified non-overshooting (dense-sampled max Y = 1.0 exactly, never exceeds).
  var CLOSE = { duration: 460, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' };

  function setUp(details) {
    var summary = details.querySelector(':scope > summary');
    var content = details.querySelector(':scope > summary + div');
    if (!summary || !content) return;

    // `.is-open` (not the native `[open]` attribute) drives the collapse-arrow rotation and
    // the summary/content divider in assets/styles.scss. Kept correct here unconditionally —
    // on initial load, and on every native `toggle` — so reduced-motion users (who skip the
    // bounce setup below entirely) and any click that fires before this script has attached
    // still get the right chevron/divider state instantly, with no dependency on the animated
    // open()/close() functions ever running.
    details.classList.toggle('is-open', details.open);
    details.addEventListener('toggle', function () {
      details.classList.toggle('is-open', details.open);
    });

    if (reduceMotion) return;

    var animating = false;

    summary.addEventListener('click', function (e) {
      if (animating) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      details.open ? close() : open();
    });

    // Force `content` back to natural CSS-driven sizing (`height`/`padding`/`overflow` all
    // cleared) exactly once per open()/close() call. Critically, this `anim.cancel()`s the
    // animation too, not just clears the inline style — a `fill: 'forwards'` animation stays
    // attached to the element indefinitely once finished, and its held effect can keep
    // outranking the CSS-computed `auto` value that clearing the inline style is supposed to
    // reveal. Found via console logging on "Reclaiming the Algo": its initial scrollHeight
    // measurement can be wrong (the YouTube iframe can still be settling asynchronously the
    // instant open() measures it), so the animation would finish holding a stale, too-small
    // height — `onfinish` fired and cleared the inline style right on schedule, but the box
    // stayed pinned to the stale value anyway, because the animation itself was never released.
    // Invisible on the other two sections, where the initial measurement is always accurate, so
    // the animation's held value already matched `auto` — nothing for the missing `.cancel()` to
    // visibly expose. `guardId` lets a stale timeout from a previous call no-op if a newer
    // open()/close() has already settled things first; the plain `setTimeout` alongside
    // `onfinish`/`oncancel` is a backstop in case WAAPI's own completion events don't fire for
    // some other reason in the future.
    var guardId = 0;
    function settle(id, isClose, anim) {
      if (id !== guardId) return; // superseded by a newer open()/close() call
      if (anim) anim.cancel();
      content.style.height = '';
      content.style.paddingTop = '';
      content.style.paddingBottom = '';
      content.style.overflow = '';
      if (isClose) details.open = false;
      animating = false;
    }

    function open() {
      details.open = true;
      details.classList.add('is-open');
      // Read scrollHeight/padding now, right after `open = true` lays content out but before any
      // inline override exists on it — these are the true class-driven (e.g. Primer's `p-4`)
      // natural values to animate toward. Not always accurate for a section whose content can
      // still be settling asynchronously at this exact instant (e.g. a cross-origin iframe) —
      // see settle()'s comment for what that mismatch was actually causing.
      var target = content.scrollHeight;
      var padTop = getComputedStyle(content).paddingTop;
      var padBottom = getComputedStyle(content).paddingBottom;
      animating = true;
      content.style.overflow = 'hidden';
      var anim = content.animate(
        [
          { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' },
          { height: target + 'px', opacity: 1, paddingTop: padTop, paddingBottom: padBottom },
        ],
        OPEN
      );
      var id = ++guardId;
      anim.onfinish = function () {
        settle(id, false, anim);
      };
      anim.oncancel = function () {
        settle(id, false, null); // already canceled — don't cancel() again
      };
      setTimeout(function () {
        settle(id, false, anim);
      }, OPEN.duration + 400);
    }

    function close() {
      var current = content.scrollHeight;
      // A box can never render shorter than its own padding — animating `height` alone toward 0
      // leaves a residual strip the size of `content`'s padding (e.g. Primer's `p-4`) sitting
      // there once height finishes, which then vanishes the instant `details.open = false` hides
      // everything natively. Animating padding-top/bottom down to 0 alongside height closes that
      // gap so there's nothing left for `[open]` removal to abruptly snap away.
      var padTop = getComputedStyle(content).paddingTop;
      var padBottom = getComputedStyle(content).paddingBottom;
      animating = true;
      // `details.open` (and the native `toggle` event) isn't flipped until this animation
      // finishes — the content has to stay laid out while it shrinks. Anything that needs to
      // react to a close *starting*, not finishing (e.g. accordion-grouping.js, and the
      // `.is-open` class below that the chevron/divider CSS now depends on instead of `[open]`
      // directly) needs an earlier signal than `toggle`/`[open]` can provide.
      details.classList.remove('is-open');
      details.dispatchEvent(new CustomEvent('accordion:willclose', { bubbles: true }));
      content.style.overflow = 'hidden';
      var anim = content.animate(
        [
          { height: current + 'px', opacity: 1, paddingTop: padTop, paddingBottom: padBottom },
          { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' },
        ],
        CLOSE
      );
      var id = ++guardId;
      anim.onfinish = function () {
        settle(id, true, anim);
      };
      anim.oncancel = function () {
        settle(id, true, null); // already canceled — don't cancel() again
      };
      setTimeout(function () {
        settle(id, true, anim);
      }, CLOSE.duration + 400);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('details.animated-details').forEach(setUp);
  });
})();
