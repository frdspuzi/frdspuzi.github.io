import { useParams } from "react-router-dom";

// Mirrors _layouts/default.html + _layouts/post.html — matches the current
// permalink: /:year/:month/:day/:title/ pattern from _config.yml.
// Just the route shape for now; actual post content/markdown rendering comes later
// in the build order (lower priority than the homepage sections).
export default function Post() {
  const { year, month, day, title } = useParams();

  return (
    <main className="container-lg py-6 p-responsive text-center">
      <div className="container-md f4 text-left theme-surface theme-border theme-fg border rounded-2 p-3 p-sm-5 mt-6">
        <p className="f5">
          <a href="/" className="d-flex flex-items-center theme-fg">
            Home
          </a>
        </p>
        <h1 className="f00-light lh-condensed mb-5">{title}</h1>
        <p className="theme-fg-muted">
          Post route shell — {year}/{month}/{day}/{title}. Content rendering comes later.
        </p>
      </div>
    </main>
  );
}
