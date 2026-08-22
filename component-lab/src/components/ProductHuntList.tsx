import { useSquirclePath } from "@/hooks/useSquirclePath";
import type { ProductHuntPost } from "@/data/producthunt_types";

const CLICK_DRAG_THRESHOLD = 8;

// The other panel/slide of TrendingCarousel.tsx - see GithubTrendingList.tsx's top comment for
// the isActive/dragDistanceRef contract, identical here.
function ProductCard({
  post,
  isActive,
  dragDistanceRef,
}: {
  post: ProductHuntPost;
  isActive: boolean;
  dragDistanceRef: React.MutableRefObject<number>;
}) {
  const { ref: squircleRef, clipPath } = useSquirclePath(24);

  function handleClick(e: React.MouseEvent) {
    if (dragDistanceRef.current > CLICK_DRAG_THRESHOLD) {
      e.preventDefault();
    }
  }

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={isActive ? 0 : -1}
      onClick={isActive ? handleClick : (e) => e.preventDefault()}
      draggable={false}
      style={{ textDecoration: "none", display: "block", width: "100%" }}
    >
      <div
        ref={squircleRef}
        className="Box box-shadow-small p-4 text-left"
        style={{ width: "100%", boxSizing: "border-box", border: "none", clipPath }}
      >
        {/* Real launch screenshots (fetch_producthunt.js's own media[] preference) render full-
            width at 16/9 - real signal worth the space. A logo fallback (no screenshot available
            for this post - confirmed via thumbnailIsLogo, not guessed from the image's own
            dimensions) renders small and square instead: stretching a square logo into 16/9
            produced a badly distorted, zoomed-in crop (caught by looking at the real rendered
            site, not assumed) - a small honest logo beats either that or an empty gap. */}
        {post.thumbnailUrl && post.thumbnailIsLogo ? (
          <img
            src={post.thumbnailUrl}
            alt=""
            loading="lazy"
            draggable={false}
            width={48}
            height={48}
            className="rounded-2"
            style={{ marginBottom: 12 }}
          />
        ) : (
          post.thumbnailUrl && (
            <img
              src={post.thumbnailUrl}
              alt=""
              loading="lazy"
              draggable={false}
              className="rounded-2"
              style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", marginBottom: 12 }}
            />
          )
        )}

        <div className="d-flex flex-items-center mb-1" style={{ gap: 8, minWidth: 0, flexWrap: "wrap" }}>
          <h3 className="trending-card-title text-bold lh-condensed mb-0" style={{ color: "var(--fg)", minWidth: 0 }}>
            <span className="text-gray" style={{ fontWeight: 400 }}>#{post.dailyRank}</span> {post.name}
          </h3>
        </div>

        <div className="trending-card-meta text-gray d-flex flex-items-center mb-2" style={{ gap: 8, flexWrap: "wrap" }}>
          {post.makerAvatarUrls.length > 0 && (
            <span className="d-flex flex-shrink-0">
              {post.makerAvatarUrls.slice(0, 4).map((url, i) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  width={18}
                  height={18}
                  loading="lazy"
                  draggable={false}
                  className="rounded-full"
                  style={{
                    marginLeft: i === 0 ? 0 : -6,
                    border: "2px solid var(--surface-page)",
                    zIndex: 4 - i,
                    position: "relative",
                  }}
                />
              ))}
            </span>
          )}
          {post.topics[0] && <span>{post.topics[0]}</span>}
          <span>▲ {post.votesCount.toLocaleString()} votes</span>
        </div>

        <p className="trending-card-hook mb-1" style={{ color: "var(--fg-muted)" }}>{post.hook}</p>

        {post.personalization && (
          <p className="trending-card-personalization text-gray mb-0" style={{ fontStyle: "italic" }}>
            {post.personalization}
          </p>
        )}
      </div>
    </a>
  );
}

export function ProductHuntList({
  posts,
  isActive,
  dragDistanceRef,
}: {
  posts: ProductHuntPost[];
  isActive: boolean;
  dragDistanceRef: React.MutableRefObject<number>;
}) {
  return (
    <div className="d-flex flex-column" style={{ gap: 16, width: "100%" }}>
      <h3 className="f5 text-uppercase text-gray-light mb-0 tracking-wide" style={{ letterSpacing: 2 }}>
        Launched on Product Hunt · daily
      </h3>
      {posts.map((post) => (
        <ProductCard key={post.name} post={post} isActive={isActive} dragDistanceRef={dragDistanceRef} />
      ))}
    </div>
  );
}
