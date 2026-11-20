import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const PORT = Number(process.env.PORT || 3000);
const TMDB_API_KEY = process.env.TMDB_API_KEY || '939414741c66f6980834245ee7f754b4';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const PUBLIC_TMDB_DIR = path.resolve(process.cwd(), 'public', 'tmdb');

export type RawArchiveTuple = [
  number,   // 0: id
  string,   // 1: title
  string,   // 2: poster_path
  string,   // 3: release_date
  number,   // 4: vote_average
  number,   // 5: vote_count
  number,   // 6: popularity
  number[], // 7: genre_ids
  string    // 8: overview
];

interface MediaIndexArrays {
  ids: Int32Array;
  pops: Float32Array;
  titles: string[];
  richMap: Map<number, RawArchiveTuple>;
  richList: RawArchiveTuple[];
}

interface CatalogState {
  ready: boolean;
  loadingPromise: Promise<void> | null;
  genres: Record<string, string>;
  genreNameToId: Map<string, number>;
  movies: MediaIndexArrays;
  tv: MediaIndexArrays;
  allMedia: Uint8Array;
  allIdx: Int32Array;
  movieTitleOrder: Int32Array | null;
  tvTitleOrder: Int32Array | null;
  hydratedCache: Map<string, RawArchiveTuple>;
  missingSet: Set<string>;
}

const emptyMediaIndex = (): MediaIndexArrays => ({
  ids: new Int32Array(0),
  pops: new Float32Array(0),
  titles: [],
  richMap: new Map(),
  richList: [],
});

const state: CatalogState = {
  ready: false,
  loadingPromise: null,
  genres: {},
  genreNameToId: new Map(),
  movies: emptyMediaIndex(),
  tv: emptyMediaIndex(),
  allMedia: new Uint8Array(0),
  allIdx: new Int32Array(0),
  movieTitleOrder: null,
  tvTitleOrder: null,
  hydratedCache: new Map(),
  missingSet: new Set(),
};

function trimOverview(text: unknown): string {
  if (!text) return '';
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned;
}

async function parseGzippedTsv(
  filePath: string,
  richMap: Map<number, RawArchiveTuple>,
  richList: RawArchiveTuple[]
): Promise<MediaIndexArrays> {
  const gzBuf = await fs.readFile(filePath);
  const text = zlib.gunzipSync(gzBuf).toString('utf8');
  const lines = text.split('\n');
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 0) count++;
  }

  const ids = new Int32Array(count);
  const pops = new Float32Array(count);
  const titles = new Array<string>(count);

  let writeIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const t1 = line.indexOf('\t');
    if (t1 === -1) continue;
    const t2 = line.indexOf('\t', t1 + 1);
    if (t2 === -1) continue;

    const id = Number(line.slice(0, t1));
    const pop = Number(line.slice(t1 + 1, t2));
    const title = line.slice(t2 + 1);

    ids[writeIdx] = id;
    pops[writeIdx] = Number.isFinite(pop) ? pop : 0;
    titles[writeIdx] = title;
    writeIdx++;
  }

  return {
    ids: writeIdx === count ? ids : ids.slice(0, writeIdx),
    pops: writeIdx === count ? pops : pops.slice(0, writeIdx),
    titles: writeIdx === count ? titles : titles.slice(0, writeIdx),
    richMap,
    richList,
  };
}

async function loadRichChunks(
  chunks: Array<{ file: string; count: number }>
): Promise<{ map: Map<number, RawArchiveTuple>; list: RawArchiveTuple[] }> {
  const map = new Map<number, RawArchiveTuple>();
  const list: RawArchiveTuple[] = [];
  for (const chunk of chunks || []) {
    try {
      const raw = await fs.readFile(path.join(PUBLIC_TMDB_DIR, chunk.file), 'utf8');
      const tuples = JSON.parse(raw) as RawArchiveTuple[];
      for (const t of tuples) {
        if (!t || !Number.isFinite(t[0])) continue;
        if (!map.has(t[0])) {
          map.set(t[0], t);
          list.push(t);
        }
      }
    } catch {
      // Ignore missing chunk
    }
  }
  return { map, list };
}

async function ensureCatalogLoaded(): Promise<void> {
  if (state.ready) return;
  if (state.loadingPromise) return state.loadingPromise;

  state.loadingPromise = (async () => {
    const t0 = Date.now();
    try {
      const manifestRaw = await fs.readFile(path.join(PUBLIC_TMDB_DIR, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestRaw);

      state.genres = manifest.genres || {};
      state.genreNameToId.clear();
      for (const [idStr, name] of Object.entries(state.genres)) {
        state.genreNameToId.set(String(name).toLowerCase(), Number(idStr));
      }

      const [richMovies, richTv] = await Promise.all([
        loadRichChunks(manifest.movieChunks || []),
        loadRichChunks(manifest.tvChunks || []),
      ]);

      const moviesTsvPath = path.join(PUBLIC_TMDB_DIR, 'index', 'movies_all.tsv.gz');
      const tvTsvPath = path.join(PUBLIC_TMDB_DIR, 'index', 'tv_all.tsv.gz');

      let moviesLoaded: MediaIndexArrays;
      let tvLoaded: MediaIndexArrays;

      try {
        [moviesLoaded, tvLoaded] = await Promise.all([
          parseGzippedTsv(moviesTsvPath, richMovies.map, richMovies.list),
          parseGzippedTsv(tvTsvPath, richTv.map, richTv.list),
        ]);
      } catch {
        // Fallback cleanly to rich chunks if TSV index has not been generated yet
        const mLen = richMovies.list.length;
        const mIds = new Int32Array(mLen);
        const mPops = new Float32Array(mLen);
        const mTitles = new Array<string>(mLen);
        for (let i = 0; i < mLen; i++) {
          mIds[i] = richMovies.list[i][0];
          mPops[i] = richMovies.list[i][6] || 0;
          mTitles[i] = richMovies.list[i][1] || 'Untitled';
        }
        moviesLoaded = {
          ids: mIds,
          pops: mPops,
          titles: mTitles,
          richMap: richMovies.map,
          richList: richMovies.list,
        };

        const tLen = richTv.list.length;
        const tIds = new Int32Array(tLen);
        const tPops = new Float32Array(tLen);
        const tTitles = new Array<string>(tLen);
        for (let i = 0; i < tLen; i++) {
          tIds[i] = richTv.list[i][0];
          tPops[i] = richTv.list[i][6] || 0;
          tTitles[i] = richTv.list[i][1] || 'Untitled';
        }
        tvLoaded = {
          ids: tIds,
          pops: tPops,
          titles: tTitles,
          richMap: richTv.map,
          richList: richTv.list,
        };
      }

      state.movies = moviesLoaded;
      state.tv = tvLoaded;

      // Build interleaved popularity index across movies + TV
      const total = moviesLoaded.ids.length + tvLoaded.ids.length;
      const allMedia = new Uint8Array(total);
      const allIdx = new Int32Array(total);
      let mi = 0;
      let ti = 0;
      let k = 0;
      const mLen = moviesLoaded.ids.length;
      const tLen = tvLoaded.ids.length;
      while (mi < mLen && ti < tLen) {
        if (moviesLoaded.pops[mi] >= tvLoaded.pops[ti]) {
          allMedia[k] = 0;
          allIdx[k] = mi++;
        } else {
          allMedia[k] = 1;
          allIdx[k] = ti++;
        }
        k++;
      }
      while (mi < mLen) {
        allMedia[k] = 0;
        allIdx[k] = mi++;
        k++;
      }
      while (ti < tLen) {
        allMedia[k] = 1;
        allIdx[k] = ti++;
        k++;
      }

      state.allMedia = allMedia;
      state.allIdx = allIdx;
      state.ready = true;
      console.log(
        `[TMDB Index] Ready in ${Date.now() - t0}ms: ${mLen.toLocaleString()} movies + ${tLen.toLocaleString()} TV shows (${total.toLocaleString()} total)`
      );
    } catch (err) {
      console.error('[TMDB Index] Failed to load catalog:', err);
    }
  })();

  return state.loadingPromise;
}

function getTitleOrder(mediaType: 'movie' | 'tv'): Int32Array {
  if (mediaType === 'movie' && state.movieTitleOrder) return state.movieTitleOrder;
  if (mediaType === 'tv' && state.tvTitleOrder) return state.tvTitleOrder;

  const source = mediaType === 'movie' ? state.movies : state.tv;
  const n = source.titles.length;
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => {
    const ta = source.titles[a];
    const tb = source.titles[b];
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  if (mediaType === 'movie') state.movieTitleOrder = order;
  else state.tvTitleOrder = order;
  return order;
}

async function hydrateSingleTitle(
  mediaType: 'movie' | 'tv',
  tmdbId: number,
  fallbackTitle: string,
  fallbackPop: number
): Promise<RawArchiveTuple> {
  const key = `${mediaType}:${tmdbId}`;
  const rich =
    mediaType === 'movie' ? state.movies.richMap.get(tmdbId) : state.tv.richMap.get(tmdbId);
  if (rich) return rich;

  const cached = state.hydratedCache.get(key);
  if (cached) return cached;

  if (state.missingSet.has(key)) {
    return [tmdbId, fallbackTitle, '', '', 0, 0, fallbackPop, [], ''];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const url = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 404) {
        if (state.missingSet.size < 100000) state.missingSet.add(key);
      }
      return [tmdbId, fallbackTitle, '', '', 0, 0, fallbackPop, [], ''];
    }

    const d = (await res.json()) as any;
    const title = String(d.title || d.name || d.original_title || d.original_name || fallbackTitle || 'Untitled');
    const posterPath = d.poster_path ? String(d.poster_path) : '';
    const releaseDate = String(d.release_date || d.first_air_date || '');
    const voteAverage = Number((d.vote_average || 0).toFixed(1));
    const voteCount = Number(d.vote_count || 0);
    const popularity = Number((d.popularity || fallbackPop || 0).toFixed(1));
    const genreIds = Array.isArray(d.genres)
      ? d.genres.map((g: any) => Number(g.id)).filter(Number.isFinite)
      : [];
    const overview = trimOverview(d.overview);

    const tuple: RawArchiveTuple = [
      tmdbId,
      title,
      posterPath,
      releaseDate,
      voteAverage,
      voteCount,
      popularity,
      genreIds,
      overview,
    ];

    // Bounded in-memory LRU cache (cap 120,000 items)
    if (state.hydratedCache.size >= 120000) {
      const oldestKey = state.hydratedCache.keys().next().value;
      if (oldestKey) state.hydratedCache.delete(oldestKey);
    }
    state.hydratedCache.set(key, tuple);
    return tuple;
  } catch {
    clearTimeout(timeout);
    return [tmdbId, fallbackTitle, '', '', 0, 0, fallbackPop, [], ''];
  }
}

async function hydrateBatch(
  entries: Array<{ mediaType: 'movie' | 'tv'; id: number; title: string; pop: number }>,
  concurrency = 14
): Promise<Array<{ mediaType: 'movie' | 'tv'; tuple: RawArchiveTuple }>> {
  const results = new Array<{ mediaType: 'movie' | 'tv'; tuple: RawArchiveTuple }>(entries.length);
  let cursor = 0;

  async function worker() {
    while (cursor < entries.length) {
      const idx = cursor++;
      const entry = entries[idx];
      const tuple = await hydrateSingleTitle(entry.mediaType, entry.id, entry.title, entry.pop);
      results[idx] = { mediaType: entry.mediaType, tuple };
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function tupleMatchesEra(releaseDate: string, era: string): boolean {
  if (!era || era === 'All') return true;
  const year = parseInt((releaseDate || '').slice(0, 4), 10);
  if (!Number.isFinite(year)) return false;
  if (era === '2020s') return year >= 2020;
  if (era === '2010s') return year >= 2010 && year <= 2019;
  if (era === '2000s') return year >= 2000 && year <= 2009;
  if (era === '1990s') return year >= 1990 && year <= 1999;
  if (era === '1980s') return year >= 1980 && year <= 1989;
  if (era === 'Classic') return year < 1980;
  return true;
}

async function createAppServer() {
  const app = express();

  // Start background index load immediately at boot
  ensureCatalogLoaded();

  // Cross-origin isolation & CORS headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.status(200).end();
      return;
    }
    next();
  });

  // 1. TMDB Full-Index Stats Endpoint (1,276,467 Movies + 237,189 TV Shows)
  app.get('/api/tmdb-catalog/stats', async (_req: Request, res: Response) => {
    await ensureCatalogLoaded();
    res.json({
      ready: state.ready,
      moviesCount: state.movies.ids.length,
      tvCount: state.tv.ids.length,
      totalTitles: state.movies.ids.length + state.tv.ids.length,
      richMoviesCount: state.movies.richList.length,
      richTvCount: state.tv.richList.length,
      genres: state.genres,
    });
  });

  // 2. TMDB Full-Index Query & Search Endpoint with On-Demand Poster Hydration
  app.get('/api/tmdb-catalog/query', async (req: Request, res: Response) => {
    await ensureCatalogLoaded();

    const mediaParam = String(req.query.media || 'movie');
    const mediaFilter: 'all' | 'movie' | 'tv' =
      mediaParam === 'tv' ? 'tv' : mediaParam === 'all' ? 'all' : 'movie';
    const q = String(req.query.q || '').trim();
    const qLower = q.toLowerCase();
    const genreFilter = String(req.query.genre || 'All').trim();
    const eraFilter = String(req.query.era || 'All').trim();
    const sortParam = String(req.query.sort || 'popularity');
    const sortBy: 'popularity' | 'rating' | 'newest' | 'title' =
      sortParam === 'rating' || sortParam === 'newest' || sortParam === 'title'
        ? sortParam
        : 'popularity';
    const hydrate = String(req.query.hydrate || '1') !== '0';

    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 50) || 50));
    const reqPage = Math.max(1, Number(req.query.page || 1) || 1);

    const needsRichMetadata =
      genreFilter !== 'All' ||
      eraFilter !== 'All' ||
      sortBy === 'rating' ||
      sortBy === 'newest';

    // Mode A: Metadata-dependent filters/sorts operate over the 92,000 richly detailed TMDB entries
    if (needsRichMetadata) {
      const targetGenreId =
        genreFilter !== 'All' ? state.genreNameToId.get(genreFilter.toLowerCase()) : undefined;

      const richPool: Array<{ mediaType: 'movie' | 'tv'; tuple: RawArchiveTuple }> = [];

      if (mediaFilter !== 'tv') {
        for (const t of state.movies.richList) {
          if (qLower) {
            const matches =
              t[1].toLowerCase().includes(qLower) || String(t[0]) === qLower;
            if (!matches) continue;
          }
          if (targetGenreId !== undefined && !(t[7] || []).includes(targetGenreId)) continue;
          if (!tupleMatchesEra(t[3], eraFilter)) continue;
          richPool.push({ mediaType: 'movie', tuple: t });
        }
      }
      if (mediaFilter !== 'movie') {
        for (const t of state.tv.richList) {
          if (qLower) {
            const matches =
              t[1].toLowerCase().includes(qLower) || String(t[0]) === qLower;
            if (!matches) continue;
          }
          if (targetGenreId !== undefined && !(t[7] || []).includes(targetGenreId)) continue;
          if (!tupleMatchesEra(t[3], eraFilter)) continue;
          richPool.push({ mediaType: 'tv', tuple: t });
        }
      }

      if (sortBy === 'rating') {
        richPool.sort((a, b) => {
          const sa = a.tuple[5] >= 20 ? a.tuple[4] : a.tuple[4] * 0.6;
          const sb = b.tuple[5] >= 20 ? b.tuple[4] : b.tuple[4] * 0.6;
          return sb - sa;
        });
      } else if (sortBy === 'newest') {
        richPool.sort((a, b) => (b.tuple[3] || '').localeCompare(a.tuple[3] || ''));
      } else if (sortBy === 'title') {
        richPool.sort((a, b) => a.tuple[1].localeCompare(b.tuple[1]));
      } else {
        richPool.sort((a, b) => (b.tuple[6] || 0) - (a.tuple[6] || 0));
      }

      const totalItems = richPool.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const clampedPage = Math.min(reqPage, totalPages);
      const start = (clampedPage - 1) * limit;
      const slice = richPool.slice(start, start + limit);

      res.json({
        page: clampedPage,
        limit,
        totalItems,
        totalPages,
        indexedTotal:
          mediaFilter === 'movie'
            ? state.movies.ids.length
            : mediaFilter === 'tv'
            ? state.tv.ids.length
            : state.allMedia.length,
        metadataScopeNote:
          'Filtered within top 92,000 detailed TMDB metadata titles. Clear genre/year filter to browse all 1.51M indexed titles.',
        items: slice,
      });
      return;
    }

    // Mode B: Full 1,513,656-Title Index (All Movies + All TV Shows)
    const sliceEntries: Array<{ mediaType: 'movie' | 'tv'; id: number; title: string; pop: number }> = [];
    let totalItems = 0;

    if (!qLower && sortBy === 'popularity') {
      // O(1) instant offset slicing over up to 1,513,656 sorted titles
      if (mediaFilter === 'movie') totalItems = state.movies.ids.length;
      else if (mediaFilter === 'tv') totalItems = state.tv.ids.length;
      else totalItems = state.allMedia.length;

      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const clampedPage = Math.min(reqPage, totalPages);
      const start = (clampedPage - 1) * limit;
      const end = Math.min(totalItems, start + limit);

      for (let i = start; i < end; i++) {
        if (mediaFilter === 'movie') {
          sliceEntries.push({
            mediaType: 'movie',
            id: state.movies.ids[i],
            title: state.movies.titles[i],
            pop: state.movies.pops[i],
          });
        } else if (mediaFilter === 'tv') {
          sliceEntries.push({
            mediaType: 'tv',
            id: state.tv.ids[i],
            title: state.tv.titles[i],
            pop: state.tv.pops[i],
          });
        } else {
          const isTv = state.allMedia[i] === 1;
          const subIdx = state.allIdx[i];
          const src = isTv ? state.tv : state.movies;
          sliceEntries.push({
            mediaType: isTv ? 'tv' : 'movie',
            id: src.ids[subIdx],
            title: src.titles[subIdx],
            pop: src.pops[subIdx],
          });
        }
      }

      const items = hydrate
        ? await hydrateBatch(sliceEntries)
        : sliceEntries.map((e) => ({
            mediaType: e.mediaType,
            tuple:
              (e.mediaType === 'movie'
                ? state.movies.richMap.get(e.id)
                : state.tv.richMap.get(e.id)) ||
              ([e.id, e.title, '', '', 0, 0, e.pop, [], ''] as RawArchiveTuple),
          }));

      res.json({
        page: clampedPage,
        limit,
        totalItems,
        totalPages,
        indexedTotal: totalItems,
        metadataScopeNote: null,
        items,
      });
      return;
    }

    if (!qLower && sortBy === 'title' && mediaFilter !== 'all') {
      const order = getTitleOrder(mediaFilter);
      const src = mediaFilter === 'movie' ? state.movies : state.tv;
      totalItems = order.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const clampedPage = Math.min(reqPage, totalPages);
      const start = (clampedPage - 1) * limit;
      const end = Math.min(totalItems, start + limit);

      for (let i = start; i < end; i++) {
        const idx = order[i];
        sliceEntries.push({
          mediaType: mediaFilter,
          id: src.ids[idx],
          title: src.titles[idx],
          pop: src.pops[idx],
        });
      }

      const items = hydrate ? await hydrateBatch(sliceEntries) : [];
      res.json({
        page: clampedPage,
        limit,
        totalItems,
        totalPages,
        indexedTotal: totalItems,
        metadataScopeNote: null,
        items,
      });
      return;
    }

    // Full-text scan across all 1,513,656 indexed titles (popularity order preserved!)
    const matches: Array<{ mediaType: 'movie' | 'tv'; id: number; title: string; pop: number }> = [];
    const exactIdNum = /^\d+$/.test(qLower) ? Number(qLower) : -1;

    const scanPool = (mediaType: 'movie' | 'tv') => {
      const src = mediaType === 'movie' ? state.movies : state.tv;
      const len = src.ids.length;
      for (let i = 0; i < len; i++) {
        const title = src.titles[i];
        if ((exactIdNum > 0 && src.ids[i] === exactIdNum) || !qLower || title.toLowerCase().includes(qLower)) {
          matches.push({
            mediaType,
            id: src.ids[i],
            title,
            pop: src.pops[i],
          });
        }
      }
    };

    if (mediaFilter === 'movie') {
      scanPool('movie');
    } else if (mediaFilter === 'tv') {
      scanPool('tv');
    } else {
      const totalLen = state.allMedia.length;
      for (let i = 0; i < totalLen; i++) {
        const isTv = state.allMedia[i] === 1;
        const idx = state.allIdx[i];
        const src = isTv ? state.tv : state.movies;
        const title = src.titles[idx];
        if ((exactIdNum > 0 && src.ids[idx] === exactIdNum) || !qLower || title.toLowerCase().includes(qLower)) {
          matches.push({
            mediaType: isTv ? 'tv' : 'movie',
            id: src.ids[idx],
            title,
            pop: src.pops[idx],
          });
        }
      }
    }

    if (sortBy === 'title') {
      matches.sort((a, b) => a.title.localeCompare(b.title));
    }

    totalItems = matches.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const clampedPage = Math.min(reqPage, totalPages);
    const start = (clampedPage - 1) * limit;
    const pageSlice = matches.slice(start, start + limit);

    const items = hydrate
      ? await hydrateBatch(pageSlice)
      : pageSlice.map((e) => ({
          mediaType: e.mediaType,
          tuple: [e.id, e.title, '', '', 0, 0, e.pop, [], ''] as RawArchiveTuple,
        }));

    res.json({
      page: clampedPage,
      limit,
      totalItems,
      totalPages,
      indexedTotal:
        mediaFilter === 'movie'
          ? state.movies.ids.length
          : mediaFilter === 'tv'
          ? state.tv.ids.length
          : state.allMedia.length,
      metadataScopeNote: null,
      items,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Stream X Full-Stack Server listening on http://localhost:${PORT}`);
  });
}

createAppServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
