# Custom domain: point firdauspuzi.com at the site

## Problem Statement

The site is only reachable at `frdspuzi.github.io`. For a personal portfolio used in job applications, that free GitHub Pages subdomain reads as generic/template-y rather than as a professional personal brand — even though the site owner already owns `firdauspuzi.com`, it isn't connected to anything.

## Solution

Keep GitHub Pages as the host (no migration — nothing about the current static, Actions-built site needs capabilities GitHub Pages lacks). Point `firdauspuzi.com` (apex, primary) at the existing GitHub Pages deployment via DNS and the repository's custom-domain setting, with `www.firdauspuzi.com` redirecting into the apex. Add a small client-side redirect so visitors who land on the old `frdspuzi.github.io` URL are automatically forwarded to `firdauspuzi.com`, preserving path/query/hash.

## User Stories

1. As a job-seeking site owner, I want my portfolio reachable at my own domain, so that it reads as a professional personal brand rather than a generic GitHub subdomain.
2. As a recruiter or visitor typing the domain from a résumé, I want `firdauspuzi.com` to load the exact same site that's already live, so that nothing about the portfolio's content or functionality changes.
3. As a visitor who types `www.firdauspuzi.com`, I want to land on the apex domain, so that I always end up at the one canonical URL.
4. As a visitor with an old bookmark or link to `frdspuzi.github.io`, I want to be automatically forwarded to `firdauspuzi.com`, so that I always end up at the current branded address instead of a stale one.
5. As a visitor following an old deep link like `frdspuzi.github.io/some/path`, I want to land on the equivalent `firdauspuzi.com/some/path`, so that the specific page I wanted still loads instead of dumping me at the homepage.
6. As the site owner, I want HTTPS enforced on the custom domain, so that visitors never see a "not secure" warning.
7. As the site owner, I want the GitHub Actions deploy pipeline to stay completely unchanged, so that adding the domain introduces no deployment risk.
8. As the site owner, I want the old `.github.io` URL to keep resolving (no hard 404), so that anything already pointing at it — search engines, old links — still lands somewhere useful.
9. As the site owner, I want the redirect decision (given a hostname, where should this visitor end up) implemented as an isolated, pure function, so that it's trivial to unit test without a browser or DNS.
10. As the site owner, I want the redirect to fire as early as possible in page load, so that visitors don't see a flash of content served under the obsolete URL.
11. As the site owner, I want this change fully isolated from the `_data/*.json` content pipeline and its GitHub Actions workflows, so the domain change can't destabilize content generation.
12. As the site owner, I want the custom-domain configuration to survive every future deploy, so I don't have to redo it after each automated content-refresh push.
13. As the site owner, I want scope limited to the portfolio site's domain only — no email, no subdomains — so this change stays small and low-risk.
14. As the site owner, I want a way to verify DNS propagation and certificate issuance myself, outside of code, so I can debug the cutover without needing an agent.

## Implementation Decisions

- **Hosting is unchanged.** The site stays on GitHub Pages, deployed by the existing `deploy-pages.yml` Actions workflow (`actions/configure-pages` → `actions/upload-pages-artifact` on `component-lab/dist` → `actions/deploy-pages`). No workflow changes.
- **No `CNAME` file is needed in the repo or build output.** Confirmed against GitHub's own docs: for Actions-based Pages publishing (as opposed to legacy branch-based publishing), "no CNAME file is created, and any existing CNAME file is ignored and is not required." The custom domain lives purely as a repository setting, independent of the build artifact, and is not reset by redeploys.
- **DNS records (manual, outside the codebase)** — at the domain's DNS provider:
  - Four `A` records for the apex, pointing at GitHub Pages' IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
  - Optionally four `AAAA` records for IPv6 (GitHub-published addresses).
  - Alternatively, an `ALIAS`/`ANAME` record at the apex pointing to `frdspuzi.github.io`, if the DNS provider supports it — avoids ever needing to update literal IPs by hand.
  - A `CNAME` record for `www` → `frdspuzi.github.io`.
- **GitHub repo setting (manual, outside the codebase):** Settings → Pages → Custom domain = `firdauspuzi.com`. Once DNS verifies, GitHub Pages handles apex-primary/`www`-redirect automatically. "Enforce HTTPS" is enabled once GitHub finishes issuing the certificate (not available until DNS has propagated).
- **Redirect script (the one code change):** a module in `component-lab/src` exposing a pure function — given the current hostname (and path/query/hash) — that returns either the equivalent `firdauspuzi.com` URL to redirect to, or nothing if the visitor is already on the canonical host (or on any other host, e.g. local dev). A thin wrapper, called as early as possible in app bootstrap (before the React tree renders), takes that result and performs the actual `window.location` navigation if one was returned. Only the wrapper touches `window`/`location`; the decision function stays framework- and environment-independent.
- **No changes** to `_data/*.json`, the content-generation workflows, or anything else in the automated content pipeline.

## Testing Decisions

- Only the redirect decision function is testable in the codebase — it's a pure function (hostname/path/query/hash in, redirect target or nothing out), so it should be covered by direct unit tests with no browser or network involved.
- Test cases: the old host with various paths, query strings, and hashes each produce the correctly reconstructed `firdauspuzi.com` target; the new host (and any other host, e.g. localhost during development) produce no redirect.
- Follow whatever test runner and conventions this Vite/React/TS codebase already uses elsewhere (check `component-lab/src/hooks/` or similar for prior art on pure-logic-plus-thin-wrapper testing) rather than introducing a new pattern.
- The DNS records and the GitHub Pages custom-domain/HTTPS settings have no automated test — they're manual infrastructure changes outside the codebase, verified by hand (e.g. `dig`/`nslookup` for propagation, then loading `https://firdauspuzi.com` in a browser to confirm it resolves, serves valid HTTPS, and shows the correct site).

## Out of Scope

- Migrating off GitHub Pages to a different host.
- Email (`you@firdauspuzi.com`) or any `MX` records.
- Subdomains for other projects (e.g. a future `something.firdauspuzi.com` for the separate `mimbarain/worker` project).
- Server-side or edge-level redirect configuration — not available on GitHub Pages, so the redirect must be client-side.
- Any SEO canonicalization work beyond the redirect itself (e.g. no `<link rel="canonical">` audit).

## Further Notes

- **The DNS record changes and the GitHub repo's Settings → Pages custom-domain configuration are prerequisites a coding agent cannot complete.** They require logging into the domain registrar's control panel and GitHub's web settings UI — outside any agent's reach. These must be done by the site owner, either before or in parallel with the redirect-script work.
- The redirect script's correctness doesn't depend on DNS or HTTPS being live — it can be built and unit-tested independently of whether `firdauspuzi.com` currently resolves.
- This spec was produced from a `/grilling` session (see conversation for full trade-off discussion, including why GitHub Pages was kept rather than migrating hosts, and why apex was chosen over `www` as primary).
