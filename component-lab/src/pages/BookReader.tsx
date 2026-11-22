import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { marked } from "marked";
import { bookStatus, coverUrl, findBook, type Book } from "@/data/books";

// Full-screen reader at /books/:slug/, rendered over the homepage (nested route, so closing it
// drops you back where you were on the shelf). Desktop shows an open book, two pages per spread;
// mobile shows one page. Page turns are a 3D hinge flip around the spine, hand-built because no
// registry component handles real content pages (useLayouts' 3D Book is a decorative fan of
// blank pages). Coming from the shelf the cover swings open first; a deep link starts open.

type Page = { key: string; head?: string; body: ReactNode };

const FLIP = { duration: 0.7, ease: [0.645, 0.045, 0.355, 1] as const };

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
  );
}

const html = (md: string) => ({ __html: marked.parse(md, { async: false }) as string });

function buildPages(book: Book): Page[] {
  return [
    {
      key: "title",
      body: (
        <div className="d-flex flex-column flex-justify-center flex-items-center text-center" style={{ height: "100%" }}>
          <div className="f2 text-bold lh-condensed mb-2" style={{ color: "var(--fg)" }}>{book.title}</div>
          <div className="text-gray mb-3">{book.author}</div>
          <div className="text-gray f6">{bookStatus(book)}</div>
        </div>
      ),
    },
    { key: "take", head: "My take", body: <div className="article" dangerouslySetInnerHTML={html(book.take)} /> },
    ...book.insights.map((insight, i) => ({
      key: `insight-${i}`,
      head: insight.chapter,
      body: (
        <>
          <div className="text-bold mb-2" style={{ color: "var(--fg)" }}>{insight.pages}</div>
          <div className="article" dangerouslySetInnerHTML={html(insight.body)} />
        </>
      ),
    })),
  ];
}

function Paper({ page, num, side }: { page?: Page; num?: number; side: "left" | "right" | "single" }) {
  // A soft shadow toward the spine sells the open-book fold.
  const fold =
    side === "left"
      ? "linear-gradient(to left, rgba(0,0,0,0.12), transparent 8%)"
      : side === "right"
        ? "linear-gradient(to right, rgba(0,0,0,0.12), transparent 8%)"
        : "none";
  return (
    <div
      className="d-flex flex-column text-left"
      style={{
        position: "absolute",
        inset: 0,
        // Paper stays paper in both themes: a physical object, not a themed surface. Overriding
        // the theme tokens locally recolours everything inside (Primer text-gray, .article).
        ["--fg" as string]: "#2b2722",
        ["--fg-muted" as string]: "#6f675c",
        color: "#2b2722",
        background: `${fold === "none" ? "" : `${fold}, `}#f7f2e7`,
        borderRadius: side === "left" ? "8px 0 0 8px" : side === "right" ? "0 8px 8px 0" : 8,
        padding: "20px 24px 12px",
      }}
    >
      {page && (
        <>
          <div className="f6 text-gray text-uppercase mb-3" style={{ letterSpacing: "0.04em", minHeight: 18 }}>
            {page.head}
          </div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>{page.body}</div>
          {num !== undefined && num > 0 && (
            <div className="f6 text-gray text-center mt-2">{num}</div>
          )}
        </>
      )}
    </div>
  );
}

function Leaf({
  front,
  back,
  style,
  initial,
  animate,
  onDone,
}: {
  front: ReactNode;
  back?: ReactNode;
  style: React.CSSProperties;
  initial: { rotateY: number; opacity?: number };
  animate: { rotateY: number; opacity?: number };
  onDone: () => void;
}) {
  const face: React.CSSProperties = { position: "absolute", inset: 0, backfaceVisibility: "hidden" };
  return (
    <motion.div
      style={{ position: "absolute", top: 0, height: "100%", transformStyle: "preserve-3d", zIndex: 3, ...style }}
      initial={initial}
      animate={animate}
      transition={FLIP}
      onAnimationComplete={onDone}
    >
      <div style={face}>{front}</div>
      {back && <div style={{ ...face, transform: "rotateY(180deg)" }}>{back}</div>}
    </motion.div>
  );
}

type Flip = { kind: "open" } | { kind: "turn"; to: number };

export default function BookReader() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const book = findBook(slug);
  const reduce = useReducedMotion() ?? false;
  const desktop = useMedia("(min-width: 768px)");
  const fromShelf = (location.state as { fromShelf?: boolean } | null)?.fromShelf === true;

  const pages = useMemo(() => (book ? buildPages(book) : []), [book]);
  const per = desktop ? 2 : 1;
  const views = useMemo(() => {
    const out: (Page | undefined)[][] = [];
    for (let i = 0; i < pages.length; i += per) out.push(pages.slice(i, i + per));
    return out;
  }, [pages, per]);

  const [view, setView] = useState(0);
  const [flip, setFlip] = useState<Flip | null>(() => (fromShelf && !reduce ? { kind: "open" } : null));
  useEffect(() => setView(0), [per]);

  const close = useCallback(() => {
    if (fromShelf) navigate(-1);
    else navigate("/", { replace: true });
  }, [fromShelf, navigate]);

  const go = useCallback(
    (to: number) => {
      if (flip || to < 0 || to >= views.length) return;
      if (reduce) setView(to);
      else setFlip({ kind: "turn", to });
    },
    [flip, views.length, reduce],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(view + 1);
      else if (e.key === "ArrowLeft") go(view - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, go, view]);

  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!book) navigate("/", { replace: true });
  }, [book, navigate]);
  if (!book) return null;

  const done = () => {
    if (flip?.kind === "turn") setView(flip.to);
    setFlip(null);
  };
  const numOf = (p?: Page) => (p ? pages.indexOf(p) : undefined);
  const cover = (
    <img
      src={coverUrl(book)}
      alt=""
      draggable={false}
      style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: desktop ? "0 8px 8px 0" : 8 }}
    />
  );

  // What sits under the turning leaf, and the leaf itself.
  let left: Page | undefined;
  let right: Page | undefined;
  let leaf: ReactNode = null;
  const cur = views[view] ?? [];

  if (desktop) {
    left = cur[0];
    right = cur[1];
    const half = { width: "50%" };
    if (flip?.kind === "open") {
      left = undefined;
      leaf = (
        <Leaf
          style={{ ...half, left: "50%", transformOrigin: "left center" }}
          front={cover}
          back={<Paper page={cur[0]} num={numOf(cur[0])} side="left" />}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: -180 }}
          onDone={done}
        />
      );
    } else if (flip?.kind === "turn" && flip.to > view) {
      const next = views[flip.to];
      right = next[1];
      leaf = (
        <Leaf
          style={{ ...half, left: "50%", transformOrigin: "left center" }}
          front={<Paper page={cur[1]} num={numOf(cur[1])} side="right" />}
          back={<Paper page={next[0]} num={numOf(next[0])} side="left" />}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: -180 }}
          onDone={done}
        />
      );
    } else if (flip?.kind === "turn") {
      const prev = views[flip.to];
      left = prev[0];
      leaf = (
        <Leaf
          style={{ ...half, left: 0, transformOrigin: "right center" }}
          front={<Paper page={cur[0]} num={numOf(cur[0])} side="left" />}
          back={<Paper page={prev[1]} num={numOf(prev[1])} side="right" />}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: 180 }}
          onDone={done}
        />
      );
    }
  } else {
    right = cur[0];
    const full = { width: "100%", left: 0, transformOrigin: "left center" };
    if (flip?.kind === "open") {
      leaf = <Leaf style={full} front={cover} initial={{ rotateY: 0 }} animate={{ rotateY: -100, opacity: 0 }} onDone={done} />;
    } else if (flip?.kind === "turn" && flip.to > view) {
      right = views[flip.to][0];
      leaf = (
        <Leaf
          style={full}
          front={<Paper page={cur[0]} num={numOf(cur[0])} side="single" />}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: -100, opacity: 0 }}
          onDone={done}
        />
      );
    } else if (flip?.kind === "turn") {
      const prev = views[flip.to][0];
      leaf = (
        <Leaf
          style={full}
          front={<Paper page={prev} num={numOf(prev)} side="single" />}
          initial={{ rotateY: -100, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          onDone={done}
        />
      );
    }
  }

  const bookW = desktop ? "min(1040px, 94vw)" : "min(480px, 92vw)";
  const bookH = desktop ? "min(680px, 82vh)" : "min(720px, 78dvh)";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`${book.title}: my notes`}
      className="d-flex flex-column flex-items-center flex-justify-center"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2200, // above maximized sections (2000), see architecture.md
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(6px)",
        padding: 16,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <button
        ref={closeRef}
        type="button"
        className="btn btn-sm"
        style={{ position: "absolute", top: 16, right: 16 }}
        onClick={close}
      >
        Close
      </button>

      <motion.div
        style={{ position: "relative", width: bookW, height: bookH, perspective: 2000, touchAction: "pan-y" }}
        // Closed, the cover is only the right half: start shifted so it sits centred, then slide
        // as it opens.
        initial={desktop && flip?.kind === "open" ? { x: "-25%" } : false}
        animate={{ x: 0 }}
        transition={FLIP}
        onPanEnd={(_, info) => {
          if (Math.abs(info.offset.x) < 60 || Math.abs(info.offset.x) < Math.abs(info.offset.y)) return;
          go(info.offset.x < 0 ? view + 1 : view - 1);
        }}
      >
        <motion.div
          key={reduce ? view : "pages"}
          style={{ position: "absolute", inset: 0, boxShadow: "0 20px 50px rgba(0,0,0,0.35)", borderRadius: 8 }}
          initial={reduce ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {desktop ? (
            <>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%", visibility: flip?.kind === "open" ? "hidden" : undefined }}>
                <Paper page={left} num={numOf(left)} side="left" />
              </div>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: "50%" }}>
                <Paper page={right} num={numOf(right)} side="right" />
              </div>
            </>
          ) : (
            <Paper page={right} num={numOf(right)} side="single" />
          )}
        </motion.div>
        {leaf}
      </motion.div>

      <div className="d-flex flex-items-center mt-3" style={{ gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="btn btn-sm" onClick={() => go(view - 1)} disabled={view === 0} aria-label="Previous page">
          ←
        </button>
        <span className="f6" style={{ color: "#fff", minWidth: 64, textAlign: "center" }}>
          {view + 1} / {views.length}
        </span>
        <button type="button" className="btn btn-sm" onClick={() => go(view + 1)} disabled={view === views.length - 1} aria-label="Next page">
          →
        </button>
      </div>
    </motion.div>
  );
}
