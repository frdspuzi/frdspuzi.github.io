import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { marked } from "marked";
import { Masthead } from "@/components/Masthead";
import { Octicon } from "@/components/Octicon";
import socialMedia from "@/data/social_media.json";
import { socialAccounts } from "@/config/social_accounts";
import { findPost } from "@/data/posts";

// React port of _layouts/post.html, `stacked` branch only (same convention as Home.tsx — the
// only branch _config.yml's `layout:` actually uses). Matches the current
// permalink: /:year/:month/:day/:title/ pattern from _config.yml.
//
// Markdown -> HTML via `marked` — a genuinely new dependency (not an existing-pattern violation:
// Jekyll's own Kramdown is a Ruby build-time tool, nothing already in this Vite/React project can
// do this job). Rendered via dangerouslySetInnerHTML: safe here specifically because post content
// is the site owner's own local markdown files, not third-party/external content — a different
// risk profile than MediumTray.tsx's own deliberate avoidance of the same pattern for Medium's
// externally-sourced RSS content.
//
// Deliberate scope cut: code blocks are wrapped in a plain `.highlight` div (site.scss's own
// `.article .highlight` rule gives it background/spacing) but aren't tokenized to match Rouge's
// exact per-token CSS classes (_highlight-syntax.scss's `.highlight .k`/`.s`/etc.) — full syntax-
// color parity would need a client-side highlighter matching Rouge's own tokenization scheme, a
// disproportionate effort for the one post on this site, which is itself an unpublished
// (`published: false`) Jekyll starter placeholder, not real authored content.
const renderer = new marked.Renderer();
renderer.code = ({ text }) => `<div class="highlight"><pre class="highlight"><code>${text}</code></pre></div>`;
marked.use({ renderer });

const shareableAccounts = socialAccounts
  .map(([service, handle]) => {
    const meta = (socialMedia as Record<string, { name: string; share_url_prefix?: string; icon_svg: string }>)[service];
    return meta?.share_url_prefix ? { service, handle, meta } : null;
  })
  .filter((x): x is NonNullable<typeof x> => x !== null);

export default function Post() {
  const { year, month, day, title } = useParams();
  const post = findPost(year, month, day, title);

  const bodyHtml = useMemo(() => (post ? marked.parse(post.body, { async: false }) : ""), [post]);

  if (!post) {
    return (
      <main className="container-lg py-6 p-responsive text-center">
        <Masthead metadata={false} />
        <div className="container-md f4 text-left theme-surface theme-border theme-fg border rounded-2 p-3 p-sm-5 mt-6">
          <p className="f5">
            <a href="/" className="d-flex flex-items-center theme-fg">
              <Octicon name="chevron-left" className="mr-2 v-align-middle" ariaLabel="Home" />
              Home
            </a>
          </p>
          <h1 className="f00-light lh-condensed">Post not found</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="container-lg py-6 p-responsive text-center">
      <Masthead metadata={false} />

      <div className="container-md f4 text-left theme-surface theme-border theme-fg border rounded-2 p-3 p-sm-5 mt-6">
        <p className="f5">
          <a href="/" className="d-flex flex-items-center theme-fg">
            <Octicon name="chevron-left" className="mr-2 v-align-middle" ariaLabel="Home" />
            Home
          </a>
        </p>
        <h1 className="f00-light lh-condensed">{post.title}</h1>
        <p className="theme-fg-muted mb-5">
          Published {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
        </p>

        {shareableAccounts.length > 0 && (
          <div className="col-sm-4 col-lg-3 d-flex flex-wrap flex-items-center d-sm-block float-sm-right border theme-border rounded-2 theme-surface p-3 mb-5 ml-md-5">
            <h3 className="theme-fg mr-3 mr-sm-0">Share</h3>
            <ul className="d-flex d-sm-block list-style-none">
              {shareableAccounts.map(({ service, meta }) => (
                <li className="mt-sm-3" key={service}>
                  <a
                    href={`${meta.share_url_prefix}${encodeURIComponent(window.location.href)}`}
                    title={`Share on ${meta.name}`}
                    className="d-flex flex-items-center"
                  >
                    <div style={{ width: 32 }} dangerouslySetInnerHTML={{ __html: meta.icon_svg }} />
                    <span className="d-none d-sm-inline-block text-gray-light">{meta.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="article" dangerouslySetInnerHTML={{ __html: bodyHtml as string }} />
      </div>
    </main>
  );
}
