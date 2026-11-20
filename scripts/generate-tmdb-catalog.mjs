import fs from 'node:fs/promises';
import path from 'node:path';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '939414741c66f6980834245ee7f754b4';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const OUTPUT_DIR = path.resolve(process.cwd(), 'public', 'tmdb');

const TARGET_MOVIES = 56000;
const TARGET_TV = 36000;
const CHUNK_SIZE = 5000;
const CONCURRENCY = 50;

async function fetchJsonWithRetry(url, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after') || 2);
        await new Promise((r) => setTimeout(r, Math.max(retryAfter * 1000, 1200)));
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
}

async function runPool(tasks, concurrency, worker) {
  let index = 0;
  async function next() {
    while (index < tasks.length) {
      const current = index++;
      await worker(tasks[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => next());
  await Promise.all(workers);
}

function trimOverview(text) {
  if (!text) return '';
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  return cleaned.length > 150 ? `${cleaned.slice(0, 147)}...` : cleaned;
}

async function harvestMedia(mediaType, targetCount) {
  const endpoint = mediaType === 'movie' ? '/discover/movie' : '/discover/tv';
  const yearParam = mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year';
  const collected = new Map();

  // Year buckets from 2026 down to 1955 with balanced page budgets
  const yearPlans = [];
  for (let y = 2026; y >= 2015; y--) yearPlans.push({ year: y, maxPages: 120 });
  for (let y = 2014; y >= 2000; y--) yearPlans.push({ year: y, maxPages: 80 });
  for (let y = 1999; y >= 1980; y--) yearPlans.push({ year: y, maxPages: 45 });
  for (let y = 1979; y >= 1955; y--) yearPlans.push({ year: y, maxPages: 25 });

  // Probe page 1 for every year concurrently first to know exact available pages
  const yearProbes = [];
  await runPool(yearPlans, CONCURRENCY, async (plan) => {
    const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&include_adult=false&sort_by=popularity.desc&${yearParam}=${plan.year}&page=1`;
    try {
      const data = await fetchJsonWithRetry(url);
      if (Array.isArray(data.results)) {
        for (const r of data.results) {
          if (!r.id || !r.poster_path) continue;
          const title = r.title || r.name || r.original_title || r.original_name;
          if (!title) continue;
          if (!collected.has(r.id)) {
            collected.set(r.id, [
              r.id,
              title,
              r.poster_path,
              r.release_date || r.first_air_date || `${plan.year}`,
              Number((r.vote_average || 0).toFixed(1)),
              r.vote_count || 0,
              Number((r.popularity || 0).toFixed(1)),
              Array.isArray(r.genre_ids) ? r.genre_ids : [],
              trimOverview(r.overview),
            ]);
          }
        }
      }
      const availablePages = Math.min(data.total_pages || 1, 500, plan.maxPages);
      yearProbes.push({ year: plan.year, availablePages });
    } catch (err) {
      console.warn(`Probe failed for ${mediaType} ${plan.year}:`, err.message);
    }
  });

  // Sort probes newest-first for high relevance and expand pages
  yearProbes.sort((a, b) => b.year - a.year);

  const pageTasks = [];
  for (let p = 2; p <= 120; p++) {
    for (const probe of yearProbes) {
      if (p <= probe.availablePages) {
        pageTasks.push({ year: probe.year, page: p });
      }
    }
  }

  let stopped = false;
  let completedTasks = 0;

  await runPool(pageTasks, CONCURRENCY, async (task) => {
    if (stopped || collected.size >= targetCount) {
      stopped = true;
      return;
    }
    const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&language=en-US&include_adult=false&sort_by=popularity.desc&${yearParam}=${task.year}&page=${task.page}`;
    try {
      const data = await fetchJsonWithRetry(url);
      if (Array.isArray(data.results)) {
        for (const r of data.results) {
          if (collected.size >= targetCount) {
            stopped = true;
            break;
          }
          if (!r.id || !r.poster_path) continue;
          const title = r.title || r.name || r.original_title || r.original_name;
          if (!title) continue;
          if (!collected.has(r.id)) {
            collected.set(r.id, [
              r.id,
              title,
              r.poster_path,
              r.release_date || r.first_air_date || `${task.year}`,
              Number((r.vote_average || 0).toFixed(1)),
              r.vote_count || 0,
              Number((r.popularity || 0).toFixed(1)),
              Array.isArray(r.genre_ids) ? r.genre_ids : [],
              trimOverview(r.overview),
            ]);
          }
        }
      }
    } catch {
      // Skip transient single-page failure
    }
    completedTasks++;
    if (completedTasks % 250 === 0) {
      console.log(`[${mediaType}] collected=${collected.size}/${targetCount} (tasks=${completedTasks})`);
    }
  });

  const list = Array.from(collected.values());
  // Sort descending by popularity so chunk 0 contains the hottest items
  list.sort((a, b) => (b[6] || 0) - (a[6] || 0));
  return list;
}

async function writeChunks(prefix, items) {
  const files = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunkIndex = Math.floor(i / CHUNK_SIZE);
    const filename = `${prefix}_${chunkIndex}.json`;
    const slice = items.slice(i, i + CHUNK_SIZE);
    await fs.writeFile(path.join(OUTPUT_DIR, filename), JSON.stringify(slice));
    files.push({ file: filename, count: slice.length });
  }
  return files;
}

async function main() {
  const start = Date.now();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log('Fetching TMDB genre lists...');
  const [movieGenresData, tvGenresData] = await Promise.all([
    fetchJsonWithRetry(`${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}&language=en-US`),
    fetchJsonWithRetry(`${TMDB_BASE_URL}/genre/tv/list?api_key=${TMDB_API_KEY}&language=en-US`),
  ]);

  const genres = {};
  for (const g of [...(movieGenresData.genres || []), ...(tvGenresData.genres || [])]) {
    genres[g.id] = g.name;
  }

  console.log(`Harvesting up to ${TARGET_MOVIES} movies from TMDB...`);
  const movies = await harvestMedia('movie', TARGET_MOVIES);
  console.log(`Harvested ${movies.length} movies in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  const tvStart = Date.now();
  console.log(`Harvesting up to ${TARGET_TV} TV shows from TMDB...`);
  const tvShows = await harvestMedia('tv', TARGET_TV);
  console.log(`Harvested ${tvShows.length} TV shows in ${((Date.now() - tvStart) / 1000).toFixed(1)}s`);

  const movieChunks = await writeChunks('movies', movies);
  const tvChunks = await writeChunks('tv', tvShows);

  const manifest = {
    generatedAt: new Date().toISOString(),
    totalTitles: movies.length + tvShows.length,
    moviesCount: movies.length,
    tvCount: tvShows.length,
    genres,
    movieChunks,
    tvChunks,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `Done! Total titles: ${manifest.totalTitles} (${movies.length} movies + ${tvShows.length} TV shows) in ${((Date.now() - start) / 1000).toFixed(1)}s`
  );
}

main().catch((err) => {
  console.error('Fatal generator error:', err);
  process.exit(1);
});
