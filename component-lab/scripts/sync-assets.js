// Mirrors the root Jekyll site's fetched-image directories (assets/photography,
// assets/youtube-thumbnails, assets/medium-images — all written by .github/scripts/*.js) into
// this app's own public/assets/, which Vite serves/copies as-is.
//
// Runs automatically before `dev`/`build` (see package.json's predev/prebuild) rather than
// relying on these being committed, static copies here. The committed-copy approach silently
// went stale twice already: new photos/thumbnails the fetch scripts added to the root directory
// had no local file under public/assets at all, 404ing on the deployed site, since nothing ever
// re-synced public/assets after the initial one-time copy. Running this on every dev/build
// instead means it's structurally impossible for these to drift apart again — there's only ever
// one directory that's the real source of truth (the root assets/ folders), copied fresh each
// time rather than duplicated in git.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_ASSETS = join(__dirname, "..", "..", "assets");
const PUBLIC_ASSETS = join(__dirname, "..", "public", "assets");

const DIRS = ["photography", "youtube-thumbnails", "medium-images"];

for (const dir of DIRS) {
  const src = join(ROOT_ASSETS, dir);
  const dest = join(PUBLIC_ASSETS, dir);
  if (!existsSync(src)) {
    console.warn(`sync-assets: ${src} doesn't exist, skipping`);
    continue;
  }
  // Wiped and recopied, not merged — a file present in dest but no longer in src (removed by
  // one of the fetch scripts' own stale-file cleanup) would otherwise linger here forever,
  // exactly the kind of drift this script exists to prevent.
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  const count = readdirSync(dest).length;
  console.log(`sync-assets: ${dir} (${count} files)`);
}
