# Consent-gated autoplay for the YouTube carousel

## Problem Statement

Every video in the "Reclaiming the Algo" YouTube carousel requires a manual click to start, even when the visitor is just navigating between already-curated videos by swiping. That's friction on an experience meant to feel like flipping through a hand-picked feed, not operating a media player one video at a time.

## Solution

Once the visitor scrolls the carousel's section into view, the currently-showing video's existing click-to-play facade becomes a one-time consent gate: the first click both starts that video at its most compelling moment (its first identified "key moment," not 0:00) and unlocks unmuted autoplay for every video reached by swiping afterward, for this visit and future ones. Nothing changes before that first click, and a video with no identified key moments never participates in this — it always keeps today's plain click-to-play behavior.

## User Stories

1. As a visitor scrolling down the homepage, I want the YouTube carousel to not immediately play sound at me, so my browsing isn't interrupted by audio I didn't ask for.
2. As a visitor who clicks play on the first video I see in the carousel, I want it to start at its most compelling moment rather than the very beginning, so I get to the "worth watching" part immediately.
3. As a visitor who has just clicked play once, I want swiping to the next video to play automatically with no further click, so browsing the curated feed feels continuous rather than click-per-video.
4. As a visitor swiping backward to a video I already passed, I want it to also autoplay at its own first key moment, so the experience is consistent in both directions.
5. As a returning visitor who consented to audio before, I want that remembered, so I don't have to click play again on a future visit just to unlock sound.
6. As a first-time visitor, I want the very first video's playback to require exactly one click, matching how browsers actually allow audio to start, so the feature never silently fails to produce sound.
7. As a visitor, I want a video with no identified key moments to never silently autoplay, so I'm not surprised by sound from a video the curation didn't fully process.
8. As the site owner, I want a video lacking timestamps to still be swipeable and manually playable (today's plain facade, from 0:00), so a rare data gap doesn't remove it from the carousel entirely.
9. As a visitor who hasn't yet scrolled the YouTube section into view, I want no player, sound, or autoplay behavior triggered prematurely, so nothing plays before I've actually reached that part of the page.
10. As a mobile visitor swiping via touch, I want the exact same consent-then-autoplay behavior as a desktop visitor dragging with a mouse, so the feature isn't platform-inconsistent.
11. As a visitor, I want the facade of the currently-active video, before consent, to look and behave exactly as it does today, so no confusing new UI element is introduced just for this feature.
12. As the site owner, I want the consent-persistence mechanism to degrade gracefully in a browser/privacy mode where `localStorage` throws, so the feature still works (just without cross-visit memory) rather than breaking.
13. As a developer maintaining this code later, I want "should this video autoplay, and from what time" expressed as a pure, testable function separate from the DOM/player-wiring code, so its correctness doesn't require a real browser to verify.
14. As a visitor who clicks an explicit "Key Moments" timestamp button (existing behavior), I want that interaction completely unaffected by this new consent/autoplay system, so existing functionality doesn't regress.
15. As a visitor in a filtered category with only 1-2 videos (an existing carousel edge case), I want the autoplay-on-swipe behavior to still behave sensibly there too, not crash or double-trigger.

## Implementation Decisions

- **Seam**: a pure function deciding autoplay intent per video, given the current consent state — a video and a boolean in, either "autoplay, seek to this time" or "no, show the facade" out. This is the one thing worth unit-testing directly; everything else here is DOM/player-wiring glue around it.
- **Gate trigger**: the carousel's section (the "Reclaiming the Algo" accordion) scrolling into view on the page. Reuse the scroll-into-view pattern already used elsewhere in this codebase (`motion/react`'s `whileInView`, as already used for card entrance animations) rather than hand-rolling a new `IntersectionObserver` — matches the component-sourcing/reuse-existing-patterns convention this repo already follows.
- **Before the section has been scrolled into view**: zero behavior change from today. The facade looks and acts exactly as it currently does.
- **Consent mechanic**: the existing facade click is the consent gate itself — no new UI element, no separate "enable sound" banner. Once the section is visible, the first facade click does two things: seeks to the video's first key moment instead of playing from 0:00 (only for a video that has one), and records that consent has been given.
- **Persistence**: `localStorage`, following the exact pattern this codebase already uses for its other remembered UI preference (read once on mount inside a try/catch, write on consent inside a try/catch, silently falls back to session-only behavior if storage throws or is unavailable — no crash either way).
- **Post-consent swipe behavior**: once consent has been recorded, every subsequent swipe navigation (forward or back) automatically plays the newly-active video, unmuted, seeked to its own first key moment — no facade, no click, for any video that has one.
- **Muting**: unmuted from the very first consent click onward. The click itself is the real user gesture that satisfies browser autoplay-permission requirements (scrolling alone does not, which is why the gate exists in the first place) — no intermediate muted-then-unmute stage.
- **Videos without a key moment**: excluded from this behavior entirely, regardless of consent state — always the plain click-to-play facade, from 0:00 if clicked. Confirmed against the real live production feed that this is currently a zero-occurrence case (every video presently in the feed has at least one key moment), but the fallback still needs to exist defensively, since a future enrichment gap could reintroduce it.
- **Explicit "Key Moments" timestamp buttons** (the existing per-timestamp click behavior) are unaffected — this feature only changes what happens on a facade click and on swipe-navigation, not that already-working, explicit path.
- **Existing small-filtered-category edge case** (peek-slot key collisions with only 1-2 videos) is unaffected structurally — the autoplay decision is evaluated fresh for whichever video becomes active after any navigation, the same way today's facade logic already handles it.

## Testing Decisions

- Test only the pure autoplay-intent decision function directly — fixture-style inputs (a video object plus a consent boolean), no browser/DOM/YouTube-IFrame-API mocking required, matching this repo's Testing Strategy (pure logic tested directly, integration left alone for something this DOM-entangled).
- Cases to cover: has a key moment + not consented → no autoplay; has a key moment + consented → autoplay, seek to that key moment's start time; no key moment + consented → still no autoplay; no key moment + not consented → no autoplay (same outcome as the previous case, worth its own case for clarity since the reason differs).
- No new Playwright/E2E spec added speculatively for this — matches this repo's own documented policy of adding one only once a specific cross-cutting flow has broken twice in practice, not written ahead of time.
- The `localStorage` read/write itself isn't separately unit-tested, following the same existing, already-accepted precedent as this codebase's other persisted UI preference — not a new gap introduced specifically by this feature.

## Out of Scope

- Any change to the existing "Key Moments" per-timestamp click behavior.
- Any change to the swipe/drag physics themselves (commit threshold, axis-lock, settle animation) — autoplay hooks into the existing active-video transition, not the gesture mechanics.
- Adding key moments to videos that currently lack them, or any change to the enrichment pipeline that produces them — a separate, already-covered concern.
- A visible "enable sound" banner or any new UI element beyond the existing facade.
- Persisting consent anywhere other than `localStorage` (e.g. a server-side or account-level preference) — this site has no visitor accounts.
- A muted-then-unmute two-stage playback model — one consent click unlocks full unmuted playback immediately, not a softer intermediate step.

## Further Notes

- Produced from a `/grilling` session using the domain-modeling lens.
- No issue tracker is configured for this repo (same situation as specs 0001/0002) — this spec is written to a file, not published anywhere, and carries no `ready-for-agent` label.
- This is a new interaction pattern, not a port of the original Jekyll site's behavior — `youtube_feed.html` never had autoplay-on-swipe or scroll-gated consent. It's layered onto an already-intricate imperative swipe/player system with several hard-won invariants of its own (documented in `architecture.md`'s Shared Accordion System section, and extensively inline in the carousel component itself — particularly around the player container's DOM stability and keyed slide reconciliation) — implementation should read those before touching anything, not just this spec.
