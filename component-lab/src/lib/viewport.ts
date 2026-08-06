// Matches _layouts/home.html's own inline script: the 3 groupable homepage sections
// (#accordion-group > details) all carry Jekyll's `open` attribute unconditionally, then that
// script force-closes them on mobile via a synchronous, pre-paint `d.open = false` — a mobile
// visitor never sees them flash open. React has no equivalent "block the parser" mechanism, but
// checking this during the component's first render (before its first paint) gets the same
// no-flash result: decide the correct initial state up front instead of opening then correcting.
export function isDesktopWidthAtMount(): boolean {
  return !window.matchMedia("(max-width: 767px)").matches;
}
