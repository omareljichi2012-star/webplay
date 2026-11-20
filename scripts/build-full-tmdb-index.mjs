import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'tmdb');
const INDEX_DIR = path.join(OUTPUT_DIR, 'index');

const SPAM_REGEX =
  /\(\(\s*escalate|air\s*china|airline.*helpline|customer\s*service.*\+?\d{7,}|how to contact .*support|delta airlines.*number|united airlines.*number|spirit airlines.*number/i;

function sanitizeTitle(title) {
  return String(title || '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function downloadLatestExport(prefix) {
  const now = new Date();
  for (let offsetDays = 0; offsetDays <= 5; offsetDays++) {
    const dt = new Date(now.getTime() - offsetDays * 86400000);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const yyyy = dt.getUTCFullYear();
    const url = `https://files.tmdb.org/p/exports/${prefix}_${mm}_${dd}_${yyyy}.json.gz`;
    console.log(`Trying TMDB export: ${url}`);
    const res = await fetch(url);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      console.log(`Downloaded ${url} (${(buf.length / (1024 * 1024)).toFixed(2)} MB gzipped)`);
      return zlib.gunzipSync(buf).toString('utf8');
    }
  }
  throw new Error(`Could not download TMDB export for ${prefix}`);
}

async function loadRichChunkItems(chunkList) {
  const map = new Map();
  for (const chunk of chunkList || []) {
    try {
      const raw = await fs.readFile(path.join(OUTPUT_DIR, chunk.file), 'utf8');
      const rows = JSON.parse(raw);
      for (const r of rows) {
        if (r && Number.isFinite(Number(r[0]))) {
          map.set(Number(r[0]), r);
        }
      }
    } catch (err) {
      console.warn(`Warning: failed reading ${chunk.file}:`, err.message);
    }
  }
  return map;
}

async function buildMediaIndex(exportPrefix, richMap, outFilePath) {
  const rawNdjson = await downloadLatestExport(exportPrefix);
  const lines = rawNdjson.split('\n');

  const records = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const obj = JSON.parse(line);
      if (!obj || !obj.id || obj.adult) continue;
      const title = sanitizeTitle(obj.original_title || obj.original_name || obj.title || obj.name);
      if (!title || SPAM_REGEX.test(title)) continue;

      const id = Number(obj.id);
      const pop = Number(obj.popularity || 0);
      const rich = richMap.get(id);
      const bestPop = rich ? Math.max(pop, Number(rich[6] || 0)) : pop;
      const bestTitle = rich && rich[1] ? sanitizeTitle(rich[1]) : title;
      records.set(id, { id, pop: bestPop, title: bestTitle });
    } catch {
      // Skip malformed line
    }
  }

  // Ensure every rich pre-harvested title is also represented
  for (const [id, tuple] of richMap.entries()) {
    if (!records.has(id)) {
      const title = sanitizeTitle(tuple[1]);
      if (title) {
        records.set(id, { id, pop: Number(tuple[6] || 0), title });
      }
    }
  }

  const list = Array.from(records.values());
  // Boost rich pre-harvested popular items slightly in tie-breakers and sort descending by popularity
  list.sort((a, b) => {
    if (b.pop !== a.pop) return b.pop - a.pop;
    return a.id - b.id;
  });

  await fs.mkdir(path.dirname(outFilePath), { recursive: true });
  await new Promise((resolve, reject) => {
    const gzip = zlib.createGzip({ level: 6 });
    const out = createWriteStream(outFilePath);
    gzip.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    gzip.on('error', reject);

    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      gzip.write(`${row.id}\t${Number(row.pop.toFixed(2))}\t${row.title}\n`);
    }
    gzip.end();
  });

  const stat = await fs.stat(outFilePath);
  console.log(
    `Wrote ${list.length.toLocaleString()} items -> ${path.relative(process.cwd(), outFilePath)} (${(
      stat.size /
      (1024 * 1024)
    ).toFixed(2)} MB)`
  );
  return list.length;
}

async function main() {
  const start = Date.now();
  await fs.mkdir(INDEX_DIR, { recursive: true });

  const manifestRaw = await fs.readFile(path.join(OUTPUT_DIR, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);

  const [richMovies, richTv] = await Promise.all([
    loadRichChunkItems(manifest.movieChunks),
    loadRichChunkItems(manifest.tvChunks),
  ]);

  console.log(`Loaded rich metadata cache: ${richMovies.size} movies, ${richTv.size} TV shows`);

  const [fullMoviesCount, fullTvCount] = await Promise.all([
    buildMediaIndex('movie_ids', richMovies, path.join(INDEX_DIR, 'movies_all.tsv.gz')),
    buildMediaIndex('tv_series_ids', richTv, path.join(INDEX_DIR, 'tv_all.tsv.gz')),
  ]);

  const updatedManifest = {
    ...manifest,
    fullIndexGeneratedAt: new Date().toISOString(),
    fullMoviesCount,
    fullTvCount,
    fullTotalTitles: fullMoviesCount + fullTvCount,
  };

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(updatedManifest, null, 2)
  );

  console.log(
    `Completed full TMDB index in ${((Date.now() - start) / 1000).toFixed(1)}s: ${fullMoviesCount.toLocaleString()} movies + ${fullTvCount.toLocaleString()} TV shows = ${(
      fullMoviesCount + fullTvCount
    ).toLocaleString()} titles`
  );
}

main().catch((err) => {
  console.error('Failed building full TMDB index:', err);
  process.exit(1);
});
