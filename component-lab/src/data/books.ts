// Bookshelf data: one markdown file per book in the repo-root _books/ folder, read raw at build
// time (same cross-root ?raw pattern as posts.ts, via a glob so adding a book is just adding a
// file). The glob is one level deep on purpose: _books/private/ holds the gitignored AI TLDRs,
// which must never reach the build - see docs/adr/0002-tldrs-stay-private.md.
//
// File shape: `key: value` front matter, then the owner's overall take, then `## ` chapter
// headings and `### ` insight headings (each insight's heading is its page range).

export type Insight = {
  chapter: string;
  pages: string; // e.g. "pp. 36–37"
  body: string; // markdown
};

export type Book = {
  slug: string;
  title: string;
  author: string;
  color: string;
  textColor?: string;
  cover: string; // filename in assets/book-covers/
  status: "reading" | "finished";
  reachedPage?: number;
  take: string; // markdown
  insights: Insight[];
};

export function parseBook(slug: string, raw: string): Book {
  const text = raw.replace(/\r\n/g, "\n");
  const fm = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fm) throw new Error(`_books/${slug}.md has no front matter`);

  const meta: Record<string, string> = {};
  for (const line of fm[1].split("\n")) {
    const m = line.match(/^(\w+):\s*(.*?)\s*$/);
    if (m) meta[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  for (const key of ["title", "author", "color", "cover"]) {
    if (!meta[key]) throw new Error(`_books/${slug}.md is missing "${key}"`);
  }

  let take = "";
  let chapter = "";
  const insights: Insight[] = [];
  for (const block of fm[2].split(/^(?=#{2,3} )/m)) {
    const heading = block.match(/^(#{2,3}) (.*)\n?([\s\S]*)$/);
    if (!heading) take += block;
    else if (heading[1] === "##") chapter = heading[2].trim();
    else insights.push({ chapter, pages: heading[2].trim(), body: heading[3].trim() });
  }

  return {
    slug,
    title: meta.title,
    author: meta.author,
    color: meta.color,
    textColor: meta.textColor || undefined,
    cover: meta.cover,
    status: meta.status === "finished" ? "finished" : "reading",
    reachedPage: meta.reachedPage ? Number(meta.reachedPage) : undefined,
    take: take.trim(),
    insights,
  };
}

const isDraft = (markdown: string) => /\bTODO\b/.test(markdown);

// A book goes on the shelf only once it has a written take and at least one written insight.
// Unwritten (TODO) insights are dropped in production but kept in dev, so the owner can preview
// a book while still writing it.
export function publishable(book: Book, allowDrafts: boolean): Book | null {
  const insights = allowDrafts ? book.insights : book.insights.filter((i) => i.body && !isDraft(i.body));
  if (!book.take || insights.length === 0) return null;
  if (!allowDrafts && isDraft(book.take)) return null;
  return { ...book, insights };
}

const files = import.meta.glob<string>("../../../_books/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const books: Book[] = Object.entries(files)
  .map(([path, raw]) => parseBook(path.split("/").pop()!.replace(/\.md$/, ""), raw))
  .map((book) => publishable(book, import.meta.env.DEV))
  .filter((book): book is Book => book !== null)
  .sort((a, b) => a.title.localeCompare(b.title));

export const findBook = (slug?: string) => books.find((b) => b.slug === slug);

export const coverUrl = (book: Book) => `${import.meta.env.BASE_URL}assets/book-covers/${book.cover}`;

export function bookStatus(book: Book) {
  if (book.status === "finished") return "Finished";
  return book.reachedPage ? `Currently reading · up to p. ${book.reachedPage}` : "Currently reading";
}
