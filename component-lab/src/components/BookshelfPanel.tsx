import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bookshelf } from "@/components/motion/bookshelf";
import { books, bookStatus, coverUrl } from "@/data/books";

// The "Books" tab of Reading & Writing (InsightsWriting.tsx). Spines from @beui/bookshelf: tap one
// and it slides out and turns to show its cover (the "picking it up" moment). The reader itself is
// a route (/books/:slug/, see BookReader.tsx), so the button below navigates there instead of
// opening anything in place.
export function BookshelfPanel() {
  const [openId, setOpenId] = useState<string | null>(null);
  const navigate = useNavigate();
  const open = books.find((b) => b.slug === openId);

  if (books.length === 0) {
    return <p className="text-gray text-left">Nothing on the shelf yet.</p>;
  }

  return (
    <div className="d-flex flex-column flex-items-center flex-auto" style={{ gap: 16 }}>
      <Bookshelf
        books={books.map((b) => ({
          id: b.slug,
          title: b.title,
          author: b.author,
          color: b.color,
          textColor: b.textColor,
          coverImage: coverUrl(b),
        }))}
        value={openId}
        onValueChange={setOpenId}
        height={260}
        coverRatio={0.652}
      />

      <div className="text-center" style={{ minHeight: 88 }} aria-live="polite">
        {open ? (
          <>
            <div className="text-bold" style={{ color: "var(--fg)" }}>{open.title}</div>
            <div className="text-gray f6">{open.author}</div>
            <div className="text-gray f6 mb-2">{bookStatus(open)}</div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/books/${open.slug}/`, { state: { fromShelf: true } })}
            >
              Read my notes
            </button>
          </>
        ) : (
          <p className="text-gray f6 mt-3">Pick a book off the shelf.</p>
        )}
      </div>
    </div>
  );
}
