import { useEffect, useState } from "react";
import { user } from "@/data/user";
import socialMedia from "@/data/social_media.json";
import { socialAccounts } from "@/config/social_accounts";
import { Octicon } from "@/components/Octicon";
import { ShaderBackground } from "@/components/motion/shader-background";

// React port of masthead.html, `stacked` layout branch only (the only branch _config.yml's
// `layout:` actually uses — see home.html's own comment on why the sidebar branch is dead code
// there too). `metadata` mirrors the include's own `metadata=true|false` param — home.html always
// passes true, post.html passes false (just avatar/name/bio there, no contact info/social icons).
const METADATA_ROW = "d-md-inline-block mx-3 mb-1 mb-md-0";

// Touch devices have no real hover, so the social icons' fill/tooltip animation (:hover /
// .is-active in site.scss's .social-icon-* rules) would otherwise never be seen — a tap
// navigates away before the 0.3s CSS transition plays. Intercepts the tap on touch-primary
// devices, adds .is-active to trigger the same CSS the hover state would, holds navigation until
// the animation has visibly finished plus a pause. Left alone on hover-capable devices, where the
// user already saw it play out during hover before ever clicking.
const FILL_TRANSITION_MS = 300;
const HOLD_MS = 1000;

function useTouchSocialIconReveal() {
  useEffect(() => {
    const isTouch = window.matchMedia("(hover: none)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!isTouch || reduceMotion) return;

    const items = document.querySelectorAll<HTMLLIElement>(".social-icon-item");
    const cleanups: (() => void)[] = [];

    items.forEach((item) => {
      const link = item.querySelector<HTMLAnchorElement>("a");
      if (!link) return;
      let navigating = false;
      const onClick = (e: MouseEvent) => {
        if (navigating) return;
        e.preventDefault();
        navigating = true;
        item.classList.add("is-active");
        const href = link.href;
        window.setTimeout(() => {
          window.location.href = href;
        }, FILL_TRANSITION_MS + HOLD_MS);
      };
      link.addEventListener("click", onClick);
      cleanups.push(() => link.removeEventListener("click", onClick));
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);
}

// The shader is a full-bleed background layer sized to this wrapper's own natural height (the
// shader is position:absolute, removed from flow, so it never contributes to that height itself
// — only the in-flow content wrapper below it does) plus a fixed 13px so it extends just past the
// social icons row, not stop flush at their exact edge. `width: 100vw` + `left: 50% ` +
// `translateX(-50%)` breaks it out of <main>'s centered `container-lg` to span the full viewport
// width regardless of how narrow that container is — see body's own `overflow-x: hidden` in
// site.scss, added specifically so this doesn't introduce a horizontal scrollbar (100vw can
// exceed the visible viewport by the scrollbar's own width in most browsers).
//
// `top` is pulled up by MAIN_PADDING_TOP_PX, not 0 — <main>'s own `py-6` class (Primer,
// `padding-top: 40px !important`) sits above this component, so `top: 0` relative to this
// wrapper would still leave a 40px gap of page background above the shader instead of reaching
// the literal top of the page. Pulling the wrapper's containing block up by exactly that amount
// (and adding it back into the height) reaches y=0 regardless of that padding.
const SHADER_BLEED_PX = 18;
const MAIN_PADDING_TOP_PX = 40;
// Same pattern as .medium-story-tag elsewhere on this site ("solid dark scrim + white text
// always reads, on any photo, in any theme") — --fg/--fg-muted were tuned for contrast against
// a plain surface background, not a moving, colorful gradient, and the shader doesn't react to
// the light/dark toggle the way the surface it replaced did. A scrim between the shader and the
// text guarantees readability regardless of theme or where the gradient currently is.
const SCRIM_COLOR = "rgba(0, 0, 0, 0.35)";
// theme-fg/theme-fg-muted are tuned for a plain surface background and don't work here either —
// in light mode --fg resolves near-black, which the scrim above makes *less* readable, not more
// (a darker background needs lighter text, not theme-correct dark text). Fixed, not theme-
// reactive, for the same reason the scrim isn't: the shader behind this text doesn't respond to
// the toggle, so text color tied to the toggle will always drift in or out of contrast with it.
const HERO_TEXT_COLOR = "#ffffff";
const HERO_TEXT_MUTED_COLOR = "rgba(255, 255, 255, 0.75)";

// A superhero-mask variation on the plain avatar, alternated in for a bit of personality — both
// share the same "black-line-art face icon" style and near-identical aspect ratio (0.885 vs
// 0.886), so the crossfade never visibly resizes or letterboxes between them.
const AVATAR_VARIANTS = [
  { src: user.avatarUrl, width: 300, height: 339 },
  { src: "/assets/img/avatar-alt.webp", width: 225, height: 254 },
];
const AVATAR_CYCLE_MS = 5000;
const AVATAR_FADE_MS = 700;

// Both variants render simultaneously, stacked via position:absolute, crossfading opacity on a
// timer — not swapping a single <img>'s src, which would need to fade all the way to nothing and
// back rather than dissolving directly from one to the other, and would show a blank flash if the
// next image weren't already cached. Reduced motion stops the cycle entirely (stays on the first
// variant) rather than just cutting the transition, matching this component's other motion-gated
// pieces (the shader's own speed, the social icons' fill animation).
function useAvatarCycle(count: number) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (count <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AVATAR_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [count]);
  return index;
}

export function Masthead({ metadata = true }: { metadata?: boolean }) {
  useTouchSocialIconReveal();
  const avatarIndex = useAvatarCycle(AVATAR_VARIANTS.length);

  return (
    <div style={{ position: "relative" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -MAIN_PADDING_TOP_PX,
          left: "50%",
          width: "100vw",
          transform: "translateX(-50%)",
          height: `calc(100% + ${MAIN_PADDING_TOP_PX + SHADER_BLEED_PX}px)`,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <ShaderBackground
          variant="mesh-gradient"
          className="h-full w-full"
          colors={["#2600ffff", "#7db8ffff", "#000000ff", "#001a2c"]}
          distortion={0.6}
          swirl={0.5}
          speed={0.3}
        />
        <div style={{ position: "absolute", inset: 0, background: SCRIM_COLOR }}></div>
      </div>
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Fixed-size wrapper, not height:auto like a single <img> could use — the stacked
            variants are position:absolute (so their opacity crossfade doesn't also displace
            layout), and absolutely-positioned children don't contribute to a parent's auto
            height. 170px matches both variants' own aspect ratio at this 150px width (they're
            close enough — 0.885 vs 0.886 — that neither needs its own separate height). */}
        <div className="mb-3" style={{ position: "relative", width: 150, height: 170, margin: "0 auto" }}>
          {AVATAR_VARIANTS.map((variant, i) => (
            <img
              key={variant.src}
              src={variant.src}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                opacity: i === avatarIndex ? 1 : 0,
                transition: `opacity ${AVATAR_FADE_MS}ms ease`,
              }}
              width={variant.width}
              height={variant.height}
              alt={user.name || user.login}
              aria-hidden={i === avatarIndex ? undefined : true}
            />
          ))}
        </div>
        <h1 className="mb-2 lh-condensed" style={{ color: HERO_TEXT_COLOR }}>
          {user.name || <span className="aurora-text">{user.login}</span>}
        </h1>
        <p className="mb-3 f4" style={{ color: HERO_TEXT_MUTED_COLOR }}>{user.bio}</p>

        {metadata && (
        <div className="f4 mb-6">
          {user.name && (
            <div className={METADATA_ROW} style={{ color: HERO_TEXT_COLOR }}>
              <Octicon name="mark-github" className="mr-2 v-align-middle" ariaLabel="GitHub" />
              <a href={`https://github.com/${user.login}`} style={{ color: HERO_TEXT_COLOR }}>
                <span className="aurora-text">@{user.login}</span>
              </a>
            </div>
          )}
          {user.email && (
            <div className={METADATA_ROW} style={{ color: HERO_TEXT_COLOR }}>
              <Octicon name="mail" className="mr-2 v-align-middle" ariaLabel="email" />
              <a href={`mailto:${user.email}`} style={{ color: HERO_TEXT_COLOR }}>
                {user.email}
              </a>
            </div>
          )}
          {user.location && (
            <div className={METADATA_ROW} style={{ color: HERO_TEXT_COLOR }}>
              <Octicon name="location" className="mr-2 v-align-middle" ariaLabel="Location" />
              {user.location}
            </div>
          )}
          {socialAccounts.length > 0 && (
            <ul className="social-icon-list flex-justify-center mt-3">
              {socialAccounts.map(([service, handle]) => {
                const meta = (socialMedia as Record<string, { name: string; profile_url_prefix?: string; icon_svg: string }>)[
                  service
                ];
                if (!meta) return null;
                return (
                  <li className="social-icon-item" key={service}>
                    <a
                      href={`${meta.profile_url_prefix ?? ""}${handle}`}
                      data-social={service}
                      aria-label={`${meta.name}: ${handle}`}
                    >
                      <div className="social-icon-fill"></div>
                      <span dangerouslySetInnerHTML={{ __html: meta.icon_svg }} />
                    </a>
                    <div className="social-icon-tooltip" aria-hidden="true">
                      {meta.name}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
