# Vice Cover Studio — build log (make.fun bounty gta6-cover-art-01)

## What was built

Location: `~/workspace/make-fun/entries/gta6-cover-art/` (built in the recorded
session; the starter was brought in before the recording as commit `3975c67`).

- `app/index.html` — editor shell: header, five control groups (photos, layout,
  colour grade, caption, export), live preview canvas, offline footnote.
- `app/style.css` — dark Vice City editor theme (deep purple, neon pink/cyan),
  responsive down to one column; `body.shot-cover` hides all chrome for
  cover-only captures.
- `app/src/render.js` — the cover renderer: 4 layouts (Solo, Hero + strip,
  Grid 2×2, Diagonal bands as clipped polygons), 4 colour grades (Sunset,
  Neon night, Palm dusk, Original) via canvas filters + gradient overlays,
  cover-fit photo drawing with per-panel zoom/pan (clamped so the photo always
  covers its panel), bold outlined caption lettering with slant, scrim band,
  and tagline. Exports `drawCover`, `renderCoverAt`, `panelsFor`,
  `panelIndexAt`, `LAYOUTS`, `GRADES`, `CAPTION_COLORS`.
- `app/src/app.js` — editor wiring: 4 photo slots (file upload via FileReader,
  two built-in samples), drag-to-pan / scroll-to-zoom / click-to-pick on the
  preview canvas, layout + grade + caption controls, PNG export at
  1080×1080 / 1080×1350 / 1920×1080, and `?shot=` query setup (layout, grade,
  size, caption, colours, per-slot photos) for reproducible screenshots.
- `main.ts` — rewritten entrypoint: copies `app/` + `screenshots/` to
  `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` with the
  vendored library. `vendor/makefun-app.ts` untouched; `serve.ts` kept.
- `screenshots/` — 4 real captures (see `shots.json` for the exact setup of
  each): `1-cover.jpg` (1280×720, 145,479 bytes — the PNG the app exported at
  1920×1080, scaled), `2-editor.jpg` (1280×1200, 158,152 bytes — the editor
  with four photos loaded), `3-cover-portrait.jpg` (1024×1280, 260,186 bytes —
  the PNG the app exported at 1080×1350, scaled), `4-editor-neon.jpg`
  (1280×1200, 190,983 bytes — diagonal layout, neon night grade).
- `README.md` — 3 live make.fun badges + referral link. `.makefun/owner.json`
  — agent wallet address. `LICENSE` — the starter's MIT license.

## How it beats the starter

The starter ("Cover Snap", house app #2) is one photo, one square cover, one
tint. This entry adds: 4 multi-panel layouts with per-panel photos, crop +
position per panel (drag/scroll/slider), 4 colour grades, headline + tagline
with size/position/colour controls, and 3 export sizes — the criteria the
judge ranks on (art, any photo, fast and easy, polish).

## Validation

- `makefun check` (kit dir, committed HEAD): **4 passed, 0 failed**,
  17 skipped (transcript rows — the site runs those on the sealed recording),
  5 checked at submission (repo public/owner/created-after-open/commit
  pushed/duplicate). "ok: every check run here passes."
- Determinism: two `main.ts` runs byte-identical (`diff -r` clean);
  dossier 1,038,643 bytes (≤1.5 MiB).
- Gate limits: app/ 6 files, 148,696 bytes (≤993 files, ≤48 MiB);
  index.html 3,862 bytes (≤1 MiB); 0 symlinks; 4 screenshots, each ≤256 KiB,
  long side ≤1280, short side ≥480.
- Both `.js` files parse as ES modules (`node --check` on `.mjs` copies);
  `render.js` imports cleanly in Node with all 7 exports.
- Offline Chromium test (network emulated off): app ready, 6 requests, all
  `file://`, 0 remote http(s) requests, 0 JS errors; switching layout +
  grade + caption offline repaints correctly.
- Export test (all 3 sizes, via CDP click on Export PNG): real PNGs of the
  exact dimensions — 1920×1080 (3,473,193 bytes), 1080×1350 (2,832,773
  bytes), 1080×1080 (1,583,957 bytes).
- All 4 screenshots visually checked: readable, no overlap or cut-off text,
  no empty panels, captions legible.

## Fixes made during the build

- Default photo crop biased toward the top of each photo (initial panY 0.2):
  the first hero render cropped a portrait photo to a torso; after the bias
  the face reads in wide panels. Re-exported the cover shot.
- Neon night grade strengthened (filter saturation 2.0 + hue shift, overlay
  alpha 0.24 → 0.30): the first version read too close to the original.
- Editor screenshots re-taken at 1280×1200 (from 1280×800/1100) so the whole
  control panel, including the Export button, is visible.

## Screenshots method

Rendered with the VM's Chromium (`/opt/meta-chromium/chrome`) driven over the
DevTools protocol (its `--screenshot` CLI path produces no output in this
build). It needs the WebGL domain policy file `/tmp/webgl-policy.txt` plus its
sha256 switches, and `--allow-file-access-from-files`; captures used `file://`
URLs (localhost HTTP is blocked in this build). The two cover shots are the
PNGs the app itself exported (downloaded via CDP `Page.setDownloadBehavior`),
scaled to the gate limits with Pillow (LANCZOS, JPEG q82). Driver scripts:
`/tmp/cdp-shoot.mjs`, `/tmp/cdp-offline.mjs` (kept outside the repo).
