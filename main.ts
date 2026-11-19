// Vice Cover Studio — entrypoint for the gta6-cover-art-01 bounty (Node 22,
// standard library only). The app itself is plain static files under app/,
// and this program hands it in: it copies app/ and screenshots/ into the
// output directory and writes dossier.json, the summary the judge reads,
// using the vendored make.fun library. Run it with MAKEFUN_OUTPUT_DIR set
// to a scratch directory outside the grader, e.g.:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
  const shotsDir = join(repoRoot, 'screenshots');
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  if (existsSync(shotsDir)) {
    cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  }
  // Caps from the gate: at most 4 screenshots of 256 KiB each, app/ at most
  // 993 files and 48 MiB, paths under app/ at most 1000 bytes, dossier text
  // capped at 160 KiB. The library refuses anything over them, as the
  // scorer would.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

handIn();
