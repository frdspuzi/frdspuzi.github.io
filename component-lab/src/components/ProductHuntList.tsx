import { motion } from "motion/react";
import { useSquirclePath } from "@/hooks/useSquirclePath";
import type { ProductHuntPost } from "@/data/producthunt_types";

const CLICK_DRAG_THRESHOLD = 8;
const INITIAL_COUNT = 5;

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
    // Same entrance animation as RepoCard, restored from before the carousel rebuild - see that
    // component's own comment for why (kept symmetric between both card types).
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ type: "spring", stiffness: 350, damping: 40, delay: 1 }}
      style={{ transformOrigin: "top center" }}
    >
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
          {/* Row 1: identity - product icon, rank, name. Same treatment RepoCard gives the repo
              owner's avatar (28x28, inline with the title) - rounded-2 rather than rounded-full
              since these are square app icons/logos, not person avatars, and forcing one into a
              circle crops it oddly. */}
          <div className="d-flex flex-items-center mb-2" style={{ gap: 8, minWidth: 0, flexWrap: "wrap" }}>
            {post.iconUrl && (
              <img
                src={post.iconUrl}
                alt=""
                width={28}
                height={28}
                className="rounded-2 flex-shrink-0"
                loading="lazy"
                draggable={false}
              />
            )}
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

          <p className="trending-card-hook mb-2" style={{ color: "var(--fg-muted)" }}>{post.hook}</p>

          {post.personalization && (
            <p className="trending-card-personalization text-gray mb-0" style={{ fontStyle: "italic" }}>
              {post.personalization}
            </p>
          )}
        </div>
      </a>
    </motion.div>
  );
}

// Top INITIAL_COUNT shown by default, the rest behind a "Load N more"/"Show less" toggle - see
// GithubTrendingList's identical pattern for why.
export function ProductHuntList({
  posts,
  isActive,
  dragDistanceRef,
  expanded,
  onToggleExpanded,
}: {
  posts: ProductHuntPost[];
  isActive: boolean;
  dragDistanceRef: React.MutableRefObject<number>;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const visibleCount = expanded ? posts.length : Math.min(INITIAL_COUNT, posts.length);
  const visiblePosts = posts.slice(0, visibleCount);
  const hiddenCount = posts.length - visibleCount;

  return (
    <div className="d-flex flex-column" style={{ gap: 16, width: "100%" }}>
      <h3 className="f5 text-uppercase text-gray-light mb-0 tracking-wide" style={{ letterSpacing: 2 }}>
        Launched on Product Hunt · daily
      </h3>
      {visiblePosts.map((post) => (
        <ProductCard key={post.name} post={post} isActive={isActive} dragDistanceRef={dragDistanceRef} />
      ))}
      {posts.length > INITIAL_COUNT && (
        <button
          type="button"
          className="btn"
          style={{ alignSelf: "center" }}
          tabIndex={isActive ? 0 : -1}
          onClick={isActive ? onToggleExpanded : undefined}
        >
          {expanded ? "Show less" : `Load ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
