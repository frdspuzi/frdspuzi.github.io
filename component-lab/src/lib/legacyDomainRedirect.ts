const LEGACY_HOSTNAME = "frdspuzi.github.io";
const CANONICAL_HOSTNAME = "firdauspuzi.com";

type LegacyLocation = {
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
};

// GitHub Pages doesn't redirect a repo's default *.github.io URL to its custom domain once one is
// configured - both keep serving the identical site in parallel indefinitely. This sends visitors
// still arriving via the old free subdomain (old bookmarks, indexed search results) on to the
// canonical firdauspuzi.com instead, preserving whatever page/query/hash they were on. See
// docs/specs/0001-custom-domain-firdauspuzi-com.md.
export function getLegacyDomainRedirectTarget(location: LegacyLocation): string | null {
  if (location.hostname !== LEGACY_HOSTNAME) return null;
  return `https://${CANONICAL_HOSTNAME}${location.pathname}${location.search}${location.hash}`;
}
