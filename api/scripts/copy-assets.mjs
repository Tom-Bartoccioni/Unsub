// Copy non-TS runtime assets into dist/ after `tsc` (which only emits JS).
// Currently just the generated catalog seed, which seed-catalog.js loads at
// runtime via import.meta.url relative to dist/db/.
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const assets = [['src/db/catalog-seed.json', 'dist/db/catalog-seed.json']];

for (const [from, to] of assets) {
  const src = fileURLToPath(new URL(from, root));
  const dest = fileURLToPath(new URL(to, root));
  await mkdir(fileURLToPath(new URL('dist/db/', root)), { recursive: true });
  await copyFile(src, dest);
  console.log(`[copy-assets] ${from} -> ${to}`);
}
