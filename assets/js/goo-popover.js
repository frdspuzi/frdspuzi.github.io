// Touch press-and-hold for the .goo-popover-trigger (i) icons — desktop hover/focus is handled
// entirely by CSS (:hover/:focus-within in assets/styles.scss, zero JS), so this only ever needs
// to add the one thing CSS genuinely can't do reliably: "held," not "tapped." CSS :active has a
// known iOS Safari quirk where it won't fire reliably on touch without a companion touchstart
// listener present somewhere on the page — used explicit Pointer Events instead, gated to
// event.pointerType === 'touch' so this never redundantly fights the CSS-only desktop path.
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.goo-popover-trigger').forEach(function (trigger) {
    var wrap = trigger.closest('.goo-popover');
    if (!wrap) return;

    function open(e) {
      if (e.pointerType !== 'touch') return;
      wrap.classList.add('is-open');
    }
    function close(e) {
      if (e.pointerType !== 'touch') return;
      wrap.classList.remove('is-open');
    }

    trigger.addEventListener('pointerdown', open);
    trigger.addEventListener('pointerup', close);
    trigger.addEventListener('pointercancel', close);
    trigger.addEventListener('pointerleave', close);

    // Triggers now live inside <summary> (youtube_feed.html/thoughts.html/photography.html,
    // 2026-08-05, moved next to the section title) — summary already has its own click listener
    // (accordion.js) that toggles the whole section open/closed. Without this, any click that
    // reaches the trigger (a mouse click, or the synthetic click a browser fires after a touch
    // tap/hold-and-release) would bubble up and close the very section the icon is attached to.
    // stopPropagation, not preventDefault — the button has no default action to prevent, it just
    // shouldn't let this specific click continue past itself.
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  });
});
