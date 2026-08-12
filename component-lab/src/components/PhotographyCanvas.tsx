import { useEffect, useRef, useState } from "react";
import unsplashAll from "../../../_data/unsplash_all.json";
import unsplashFavourites from "../../../_data/unsplash_favourites.json";
import type { UnsplashPhoto } from "@/data/photography_types";

// React port of photography.html's <script> — the Infinite Image Field, a Google-Maps-style
// drag-to-pan Canvas 2D bento grid. Transliterated close to 1:1, same reasoning as
// YoutubeCarousel.tsx: this is tightly-coupled procedural code (render()/loop()/drag handlers all
// sharing mutable cam/dragVel/loadedImages state) where re-deriving it as reactive state would
// fight the animation loop for no benefit. See the original file's own extensive comments for why
// each specific number/technique is what it is — carried over unchanged, only the plumbing
// (getElementById -> refs, Liquid's rawPhotos loop -> deduped JSON import) actually changed.
type Photo = { url: string; link: string };

function dedupePhotos(): Photo[] {
  const raw: UnsplashPhoto[] = [
    ...(unsplashAll as UnsplashPhoto[]),
    ...(unsplashFavourites as UnsplashPhoto[]),
  ];
  const seen = new Set<string>();
  const photos: Photo[] = [];
  for (const p of raw) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      photos.push({ url: `/assets/photography/${p.id}.jpg`, link: p.links.html });
    }
  }
  return photos;
}

const UNIT = 140;
const GAP = 20;
const RADIUS = 8;
const BLOCK_ROWS = 4;
const BLOCK_COLS = 4;
const REGIONS = [
  { row: 0, col: 0, rowSpan: 2, colSpan: 2 }, // A — large
  { row: 0, col: 2, rowSpan: 2, colSpan: 1 }, // B — tall
  { row: 0, col: 3, rowSpan: 1, colSpan: 1 }, // C — small
  { row: 1, col: 3, rowSpan: 2, colSpan: 1 }, // D — tall
  { row: 2, col: 0, rowSpan: 2, colSpan: 1 }, // E — tall
  { row: 2, col: 1, rowSpan: 2, colSpan: 1 }, // F — tall
  { row: 2, col: 2, rowSpan: 2, colSpan: 1 }, // G — tall
  { row: 3, col: 3, rowSpan: 1, colSpan: 1 }, // H — small
];

const FRICTION = 0.92;
const MIN_VELOCITY = 0.03;
const DRAG_VEL_SMOOTHING = 0.35;
const CLICK_DRAG_THRESHOLD = 8;
// One-time "pan loop" the first time the canvas is actually revealed, teaching that it pans in
// every direction — cursor: grab (below) covers a mouse hovering it, but touch visitors get no
// equivalent hint. A first version of this reused the existing momentum system (setting dragVel
// and letting FRICTION decay it, same as a real flick) — simple, but imprecise by nature: where
// it actually stops depends on frame timing, so it read as a random bump rather than a deliberate
// demo, and it only ever showed one direction. This instead directly tweens cam.x/y through a full
// circle and back to its exact starting point over NUDGE_DURATION_MS, bypassing the momentum
// system entirely for this one purpose — see playPanLoop below. No persistence (no localStorage),
// matching the swipe carousels' own hint: plays fresh on every page load, not a visitor's
// first-ever visit only.
const NUDGE_DELAY_MS = 600;
const NUDGE_DURATION_MS = 1400;
const NUDGE_RADIUS_PX = 50;

type Tile = { x: number; y: number; w: number; h: number; imgIdx: number; settled?: boolean };

export function PhotographyCanvas() {
  const [photos] = useState<Photo[]>(dedupePhotos);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (photos.length === 0) return;
    const canvas = canvasRef.current;
    const frameEl = frameRef.current;
    if (!canvas || !frameEl) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cellPitchW = UNIT + GAP;
    const cellPitchH = UNIT + GAP;
    const blockPitchW = BLOCK_COLS * cellPitchW;
    const blockPitchH = BLOCK_ROWS * cellPitchH;

    const SKELETON_FILL =
      getComputedStyle(document.documentElement).getPropertyValue("--border").trim() ||
      "rgba(255,255,255,0.06)";

    function skeletonPulseOpacity(now: number) {
      if (reduceMotion) return 0.7;
      const t = (now % 2000) / 2000;
      return 1 - Math.sin(t * Math.PI) * 0.5;
    }

    const ctx = canvas!.getContext("2d")!;
    const loadedImages: HTMLImageElement[] = photos.map(() => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      return img;
    });

    function requestImage(idx: number, highPriority: boolean) {
      const img = loadedImages[idx];
      if (img.src) return;
      if (highPriority && "fetchPriority" in img) (img as unknown as { fetchPriority: string }).fetchPriority = "high";
      img.src = photos[idx].url;
    }

    let dims = { w: 0, h: 0 };
    const cam = { x: 0, y: 0 };
    let dragging = false;
    const lastPointer = { x: 0, y: 0 };
    const dragVel = { x: 0, y: 0 };
    let dragDistance = 0;
    let momentumActive = false;
    let loopRunning = false;
    let hasUnloadedVisibleTiles = false;
    let lastTiles: Tile[] = [];

    function tileOnScreen(tile: Tile) {
      return tile.x + tile.w > 0 && tile.x < dims.w && tile.y + tile.h > 0 && tile.y < dims.h;
    }

    function drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    }

    function drawImageCover(img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih) return;
      const scale = Math.max(dw / iw, dh / ih);
      const sw = dw / scale;
      const sh = dh / scale;
      const sx = (iw - sw) / 2;
      const sy = (ih - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    function getVisibleTiles(): Tile[] {
      const W = dims.w;
      const H = dims.h;
      if (W === 0 || H === 0) return [];

      const blockColMin = Math.floor((cam.x - W / 2) / blockPitchW) - 1;
      const blockColMax = Math.ceil((cam.x + W / 2) / blockPitchW) + 1;
      const blockRowMin = Math.floor((cam.y - H / 2) / blockPitchH) - 1;
      const blockRowMax = Math.ceil((cam.y + H / 2) / blockPitchH) + 1;

      const numImages = loadedImages.length;
      const tiles: Tile[] = [];

      for (let br = blockRowMin; br <= blockRowMax; br++) {
        for (let bc = blockColMin; bc <= blockColMax; bc++) {
          const blockOriginX = bc * blockPitchW - cam.x + W / 2 - blockPitchW / 2;
          const blockOriginY = br * blockPitchH - cam.y + H / 2 - blockPitchH / 2;

          for (let ri = 0; ri < REGIONS.length; ri++) {
            const region = REGIONS[ri];
            const x = blockOriginX + region.col * cellPitchW;
            const y = blockOriginY + region.row * cellPitchH;
            const w = region.colSpan * cellPitchW - GAP;
            const h = region.rowSpan * cellPitchH - GAP;

            const imgIdx = Math.abs(bc * 7 + br * 13 + ri * 31 + ((bc * br * 3) | 0)) % numImages;

            tiles.push({ x, y, w, h, imgIdx });
          }
        }
      }
      return tiles;
    }

    function drawTile(tile: Tile, pulseOpacity: number) {
      const img = loadedImages[tile.imgIdx];
      const isLoaded = !!(img && img.complete && img.naturalWidth > 0);

      ctx.save();
      drawRoundedRect(tile.x, tile.y, tile.w, tile.h, RADIUS);
      ctx.clip();
      if (isLoaded) {
        drawImageCover(img, tile.x, tile.y, tile.w, tile.h);
      } else {
        ctx.globalAlpha = pulseOpacity;
        ctx.fillStyle = SKELETON_FILL;
        ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      if (isLoaded) {
        ctx.save();
        drawRoundedRect(tile.x, tile.y, tile.w, tile.h, RADIUS);
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      return isLoaded;
    }

    function render() {
      if (dims.w === 0 || dims.h === 0) return;
      ctx.clearRect(0, 0, dims.w, dims.h);

      const tiles = getVisibleTiles();
      lastTiles = tiles;

      tiles.forEach((tile) => {
        if (tileOnScreen(tile)) requestImage(tile.imgIdx, true);
      });
      tiles.forEach((tile) => {
        if (!tileOnScreen(tile)) requestImage(tile.imgIdx, false);
      });

      const pulseOpacity = skeletonPulseOpacity(performance.now());
      hasUnloadedVisibleTiles = false;

      tiles.forEach((tile) => {
        const isLoaded = drawTile(tile, pulseOpacity);
        if (!isLoaded && tileOnScreen(tile)) hasUnloadedVisibleTiles = true;
      });

      if (!reduceMotion && hasUnloadedVisibleTiles) {
        ensureLoopRunning();
      }
    }

    function renderPulseOnly() {
      const pulseOpacity = skeletonPulseOpacity(performance.now());
      hasUnloadedVisibleTiles = false;

      lastTiles.forEach((tile) => {
        if (tile.settled) return;

        ctx.clearRect(tile.x, tile.y, tile.w, tile.h);
        const isLoaded = drawTile(tile, pulseOpacity);
        if (isLoaded) {
          tile.settled = true;
        } else if (tileOnScreen(tile)) {
          hasUnloadedVisibleTiles = true;
        }
      });
    }

    let rafId = 0;
    function loop() {
      if (momentumActive) {
        cam.x += dragVel.x;
        cam.y += dragVel.y;
        dragVel.x *= FRICTION;
        dragVel.y *= FRICTION;
        if (Math.abs(dragVel.x) < MIN_VELOCITY && Math.abs(dragVel.y) < MIN_VELOCITY) {
          dragVel.x = 0;
          dragVel.y = 0;
          momentumActive = false;
        }
        render();
      } else {
        renderPulseOnly();
      }
      if (momentumActive || (!reduceMotion && hasUnloadedVisibleTiles)) {
        rafId = requestAnimationFrame(loop);
      } else {
        loopRunning = false;
      }
    }

    function ensureLoopRunning() {
      if (loopRunning) return;
      loopRunning = true;
      rafId = requestAnimationFrame(loop);
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      dims = { w: rect.width, h: rect.height };
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render();
    }

    let resizeObserver: ResizeObserver | undefined;
    function initCanvasSizing() {
      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas!);
    }

    let lazyIo: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      lazyIo = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              lazyIo!.unobserve(entry.target);
              initCanvasSizing();
            }
          });
        },
        { rootMargin: "400px 0px" },
      );
      lazyIo.observe(frameEl);
    } else {
      initCanvasSizing();
    }

    let nudgeTimeoutId = 0;
    let nudgeRafId = 0;
    // ease-in-out cubic — starts and ends the loop gently rather than snapping into motion.
    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function scheduleNudge() {
      if (reduceMotion) return;
      nudgeTimeoutId = window.setTimeout(() => {
        if (dragging) return;
        const homeX = cam.x;
        const homeY = cam.y;
        const startTime = performance.now();
        function frame(now: number) {
          // A real drag starting mid-loop takes over cam.x/y itself via moveDrag — this has to
          // stop touching cam entirely the instant that happens, or the two would fight over it
          // every frame (whichever runs last that frame wins, a visible flicker).
          if (dragging) return;
          const rawT = Math.min(1, (now - startTime) / NUDGE_DURATION_MS);
          const t = easeInOutCubic(rawT);
          // Parametric circle starting and ending at (homeX, homeY): sin(0)=0 and 1-cos(0)=0
          // put t=0 exactly at home, sin(2π)=0 and 1-cos(2π)=0 put t=1 exactly back at home too
          // — guaranteed, not approximated the way the previous friction-decay version was.
          const theta = 2 * Math.PI * t;
          cam.x = homeX + NUDGE_RADIUS_PX * Math.sin(theta);
          cam.y = homeY + NUDGE_RADIUS_PX * (1 - Math.cos(theta));
          render();
          if (rawT < 1) {
            nudgeRafId = requestAnimationFrame(frame);
          } else {
            cam.x = homeX;
            cam.y = homeY;
            render();
          }
        }
        nudgeRafId = requestAnimationFrame(frame);
      }, NUDGE_DELAY_MS);
    }

    let revealIo: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      revealIo = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            revealIo!.unobserve(entry.target);
            frameEl.classList.add("is-revealed");
          }
        });
      });
      revealIo.observe(frameEl);
    } else {
      frameEl.classList.add("is-revealed");
    }

    // Separate from revealIo above on purpose, not reused: revealIo intentionally fires at the
    // default threshold (as soon as even a sliver of the frame is on screen), so the fade-in
    // reveal isn't delayed — appropriate for a reveal, wrong for a "the user is actually looking
    // at this" gate. threshold: 0.6 matches useSwipeHint's own YT/quiz gate, so this only plays
    // once the canvas is substantially visible, not the instant its top edge scrolls into frame.
    let nudgeIo: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      nudgeIo = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          nudgeIo!.disconnect();
          scheduleNudge();
        },
        { threshold: 0.6 },
      );
      nudgeIo.observe(frameEl);
    } else {
      scheduleNudge();
    }

    function onClick(e: MouseEvent) {
      if (dragDistance > CLICK_DRAG_THRESHOLD) return;
      const rect = canvas!.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const tiles = getVisibleTiles();
      for (const t of tiles) {
        if (clickX >= t.x && clickX <= t.x + t.w && clickY >= t.y && clickY <= t.y + t.h) {
          const link = photos[t.imgIdx].link;
          if (link) window.open(link, "_blank", "noopener,noreferrer");
          return;
        }
      }
    }
    canvas.addEventListener("click", onClick);

    function startDrag(x: number, y: number) {
      dragging = true;
      momentumActive = false;
      dragVel.x = 0;
      dragVel.y = 0;
      dragDistance = 0;
      lastPointer.x = x;
      lastPointer.y = y;
      canvas!.style.cursor = "grabbing";
    }

    function moveDrag(x: number, y: number) {
      if (!dragging) return;
      const dx = x - lastPointer.x;
      const dy = y - lastPointer.y;
      dragDistance += Math.abs(dx) + Math.abs(dy);
      cam.x -= dx;
      cam.y -= dy;
      dragVel.x += (-dx - dragVel.x) * DRAG_VEL_SMOOTHING;
      dragVel.y += (-dy - dragVel.y) * DRAG_VEL_SMOOTHING;
      lastPointer.x = x;
      lastPointer.y = y;
      render();
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      canvas!.style.cursor = "grab";
      if (!reduceMotion && (Math.abs(dragVel.x) > MIN_VELOCITY || Math.abs(dragVel.y) > MIN_VELOCITY)) {
        momentumActive = true;
        ensureLoopRunning();
      } else {
        dragVel.x = 0;
        dragVel.y = 0;
      }
    }

    function onMouseDown(e: MouseEvent) {
      startDrag(e.clientX, e.clientY);
    }
    function onMouseMove(e: MouseEvent) {
      moveDrag(e.clientX, e.clientY);
    }
    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragging || e.touches.length !== 1) return;
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", endDrag);
    canvas.addEventListener("touchcancel", endDrag);

    const onImageLoad = () => render();
    loadedImages.forEach((img) => img.addEventListener("load", onImageLoad));

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(nudgeTimeoutId);
      cancelAnimationFrame(nudgeRafId);
      lazyIo?.disconnect();
      revealIo?.disconnect();
      nudgeIo?.disconnect();
      resizeObserver?.disconnect();
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endDrag);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", endDrag);
      canvas.removeEventListener("touchcancel", endDrag);
      loadedImages.forEach((img) => img.removeEventListener("load", onImageLoad));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  if (photos.length === 0) {
    return (
      <div className="blankslate">
        <h3 className="mb-1">Gallery syncing...</h3>
        <p>The photography gallery is currently syncing with Unsplash. Check back in a few minutes!</p>
      </div>
    );
  }

  return (
    <div ref={frameRef} className="infinite-image-field-frame">
      <canvas
        ref={canvasRef}
        id="photography-canvas"
        role="img"
        aria-label="A draggable bento grid of my photography — drag or swipe to pan around, click any photo to view it on Unsplash"
      ></canvas>
    </div>
  );
}
