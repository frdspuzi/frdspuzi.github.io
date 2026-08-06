// _posts/*.md imported directly via Vite's ?raw suffix (same cross-root-import pattern as
// _data/*.json elsewhere in this port — needs server.fs.allow widened in vite.config.ts, already
// done). Only one post exists on the live site today; this list grows by adding one more entry +
// import per file if/when more posts are added — not worth a build-time directory-scan script for
// a single file.
import helloWorldRaw from "../../../_posts/2019-01-29-hello-world.md?raw";

export type Post = {
  year: string;
  month: string;
  day: string;
  slug: string;
  title: string;
  date: string; // ISO, derived from the filename's date prefix — matches Jekyll's own convention
  body: string; // markdown, front matter stripped
};

// Minimal front-matter extraction (just `title`, the only field post.html's layout actually
// reads) rather than a full YAML parser dependency — _posts front matter on this site is exactly
// `title` (+ `published`, which is a Jekyll build-time publish filter with no equivalent meaning
// here; not read).
function parsePost(filename: string, raw: string): Post {
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  if (!match) throw new Error(`Post filename doesn't match YYYY-MM-DD-slug.md: ${filename}`);
  const [, year, month, day, slug] = match;

  const frontMatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const frontMatter = frontMatterMatch?.[1] ?? "";
  const body = (frontMatterMatch?.[2] ?? raw).trim();
  const titleMatch = frontMatter.match(/^title:\s*"?(.*?)"?\s*$/m);
  const title = titleMatch?.[1] ?? slug;

  return { year, month, day, slug, title, date: `${year}-${month}-${day}`, body };
}

export const posts: Post[] = [parsePost("2019-01-29-hello-world.md", helloWorldRaw)];

export function findPost(year?: string, month?: string, day?: string, slug?: string): Post | undefined {
  return posts.find((p) => p.year === year && p.month === month && p.day === day && p.slug === slug);
}
