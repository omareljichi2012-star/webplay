import { createSvgPosterFallback } from '../utils/posterFallback';

export const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_W500 = 'https://image.tmdb.org/t/p/w500';
export const TMDB_IMAGE_ORIGINAL = 'https://image.tmdb.org/t/p/original';

export function getTmdbApiKey(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TMDB_API_KEY) {
    return import.meta.env.VITE_TMDB_API_KEY;
  }
  return '939414741c66f6980834245ee7f754b4';
}

export type TmdbMediaType = 'movie' | 'tv';

export type TmdbFeedType =
  | 'archive'
  | 'trending'
  | 'movie_trending'
  | 'movie_popular'
  | 'movie_top_rated'
  | 'movie_now_playing'
  | 'tv_trending'
  | 'tv_popular'
  | 'tv_top_rated'
  | 'tv_on_the_air';

export interface TmdbFeedMeta {
  key: TmdbFeedType;
  label: string;
  endpoint?: string;
  defaultMediaType?: TmdbMediaType;
}

export const TMDB_FEEDS: TmdbFeedMeta[] = [
  { key: 'archive', label: 'Full Catalog (1.51M+)' },
  { key: 'trending', label: 'Trending', endpoint: '/trending/all/week' },
  { key: 'movie_trending', label: 'Trending Movies', endpoint: '/trending/movie/week', defaultMediaType: 'movie' },
  { key: 'movie_popular', label: 'Popular Movies', endpoint: '/movie/popular', defaultMediaType: 'movie' },
  { key: 'movie_top_rated', label: 'Top Rated Movies', endpoint: '/movie/top_rated', defaultMediaType: 'movie' },
  { key: 'movie_now_playing', label: 'Now Playing', endpoint: '/movie/now_playing', defaultMediaType: 'movie' },
  { key: 'tv_trending', label: 'Trending Shows', endpoint: '/trending/tv/week', defaultMediaType: 'tv' },
  { key: 'tv_popular', label: 'Popular TV', endpoint: '/tv/popular', defaultMediaType: 'tv' },
  { key: 'tv_top_rated', label: 'Top Rated TV', endpoint: '/tv/top_rated', defaultMediaType: 'tv' },
  { key: 'tv_on_the_air', label: 'On The Air', endpoint: '/tv/on_the_air', defaultMediaType: 'tv' },
];

export interface TmdbCatalogItem {
  id: string;
  tmdbId: string;
  mediaType: TmdbMediaType;
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string | null;
  hasPoster: boolean;
  releaseDate: string;
  year: string;
  voteAverage: number;
  voteCount: number;
  popularity?: number;
  genreIds?: number[];
  genreNames: string[];
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profileUrl: string;
  hasProfile: boolean;
}

export interface TmdbSeasonInfo {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  overview?: string;
  posterPath?: string | null;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbMediaDetails extends TmdbCatalogItem {
  tagline: string;
  status: string;
  imdbId: string | null;
  runtime: number | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  seasons: TmdbSeasonInfo[];
  genres: TmdbGenre[];
  cast: TmdbCastMember[];
  recommendations: TmdbCatalogItem[];
  backdropGallery: string[];
}

export interface TmdbCatalogPage {
  page: number;
  totalPages: number;
  totalResults: number;
  items: TmdbCatalogItem[];
}

export interface TmdbArchiveChunkMeta {
  file: string;
  count: number;
}

export interface TmdbArchiveManifest {
  generatedAt: string;
  totalTitles: number;
  moviesCount: number;
  tvCount: number;
  fullMoviesCount?: number;
  fullTvCount?: number;
  fullTotalTitles?: number;
  genres: Record<string, string>;
  movieChunks: TmdbArchiveChunkMeta[];
  tvChunks: TmdbArchiveChunkMeta[];
}

type RawArchiveTuple = [
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

const jsonCache = new Map<string, any>();
let genreLookupPromise: Promise<Record<number, string>> | null = null;
const genreLookupMap: Record<number, string> = {};

let manifestPromise: Promise<TmdbArchiveManifest | null> | null = null;
const archiveChunkCache = new Map<string, TmdbCatalogItem[]>();

export function createCastAvatarFallback(name: string): string {
  const initials = String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#170928"/>
        <stop offset="100%" stop-color="#090612"/>
      </linearGradient>
    </defs>
    <rect width="300" height="450" fill="url(#g)"/>
    <circle cx="150" cy="185" r="56" fill="#25103e" stroke="#7e22ce" stroke-width="2"/>
    <text x="150" y="203" font-family="system-ui, -apple-system, sans-serif" font-size="38" font-weight="800" fill="#d8b4fe" text-anchor="middle">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function fetchTmdbJson<T = any>(
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', getTmdbApiKey());
  url.searchParams.set('language', 'en-US');

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const key = url.toString();
  if (jsonCache.has(key)) {
    return jsonCache.get(key) as T;
  }

  const res = await fetch(key);
  if (!res.ok) {
    throw new Error(`TMDB request failed (${res.status} ${res.statusText})`);
  }
  const data = (await res.json()) as T;
  jsonCache.set(key, data);
  return data;
}

export async function ensureGenreLookup(): Promise<Record<number, string>> {
  if (Object.keys(genreLookupMap).length > 0) {
    return genreLookupMap;
  }
  if (!genreLookupPromise) {
    genreLookupPromise = Promise.all([
      fetchTmdbJson<{ genres: TmdbGenre[] }>('/genre/movie/list').catch(() => ({ genres: [] })),
      fetchTmdbJson<{ genres: TmdbGenre[] }>('/genre/tv/list').catch(() => ({ genres: [] })),
    ]).then(([m, t]) => {
      for (const g of [...(m.genres || []), ...(t.genres || [])]) {
        genreLookupMap[g.id] = g.name;
      }
      return genreLookupMap;
    });
  }
  return genreLookupPromise;
}

export async function fetchTmdbArchiveManifest(): Promise<TmdbArchiveManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetch('/tmdb/manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TmdbArchiveManifest | null) => {
        if (data?.genres) {
          for (const [id, name] of Object.entries(data.genres)) {
            genreLookupMap[Number(id)] = name;
          }
        }
        return data;
      })
      .catch(() => null);
  }
  return manifestPromise;
}

function hydrateArchiveTuple(
  tuple: RawArchiveTuple,
  mediaType: TmdbMediaType,
  genresMap: Record<string, string>
): TmdbCatalogItem {
  const [tmdbId, title, posterPath, releaseDate, voteAverage, voteCount, popularity, genreIds, overview] = tuple;
  const hasPoster = Boolean(posterPath);
  const year = releaseDate ? String(releaseDate).slice(0, 4) : 'N/A';
  const genreNames = Array.isArray(genreIds)
    ? genreIds.map((gid) => genresMap[String(gid)] || genreLookupMap[gid]).filter(Boolean)
    : [];

  return {
    id: `${mediaType}-${tmdbId}`,
    tmdbId: String(tmdbId),
    mediaType,
    title: title || 'Untitled',
    overview: overview || `Stream ${title} in high definition with multi-server playback support.`,
    posterUrl: hasPoster
      ? `${TMDB_IMAGE_W500}${posterPath}`
      : createSvgPosterFallback(title, mediaType === 'tv' ? 'TV Shows' : 'Movies'),
    backdropUrl: null,
    hasPoster,
    releaseDate: releaseDate || '',
    year,
    voteAverage: typeof voteAverage === 'number' ? voteAverage : 0,
    voteCount: typeof voteCount === 'number' ? voteCount : 0,
    popularity: typeof popularity === 'number' ? popularity : 0,
    genreIds: Array.isArray(genreIds) ? genreIds : [],
    genreNames,
  };
}

async function fetchArchiveChunk(
  file: string,
  mediaType: TmdbMediaType,
  genresMap: Record<string, string>
): Promise<TmdbCatalogItem[]> {
  const cacheKey = `${mediaType}:${file}`;
  const cached = archiveChunkCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(`/tmdb/${file}`);
  if (!res.ok) return [];
  const tuples = (await res.json()) as RawArchiveTuple[];
  const hydrated = tuples.map((t) => hydrateArchiveTuple(t, mediaType, genresMap));
  archiveChunkCache.set(cacheKey, hydrated);
  return hydrated;
}

/**
 * Streams the 90,000+ generated TMDB Movies & TV Shows archive progressively:
 * chunk 0 loads immediately (~5,000 titles), then remaining chunks stream in batches
 * without blocking the UI.
 */
export async function streamTmdbArchive(options: {
  mediaFilter: 'all' | 'movie' | 'tv';
  onProgress: (items: TmdbCatalogItem[], loadedCount: number, totalCount: number, done: boolean) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { mediaFilter, onProgress, signal } = options;
  const manifest = await fetchTmdbArchiveManifest();
  if (!manifest || signal?.aborted) {
    onProgress([], 0, 0, true);
    return;
  }

  const chunkQueue: Array<{ file: string; mediaType: TmdbMediaType }> = [];
  if (mediaFilter === 'movie') {
    for (const c of manifest.movieChunks) chunkQueue.push({ file: c.file, mediaType: 'movie' });
  } else if (mediaFilter === 'tv') {
    for (const c of manifest.tvChunks) chunkQueue.push({ file: c.file, mediaType: 'tv' });
  } else {
    // Interleave movie & tv chunks so "All" immediately gets both movies & TV shows
    const maxLen = Math.max(manifest.movieChunks.length, manifest.tvChunks.length);
    for (let i = 0; i < maxLen; i++) {
      if (manifest.movieChunks[i]) chunkQueue.push({ file: manifest.movieChunks[i].file, mediaType: 'movie' });
      if (manifest.tvChunks[i]) chunkQueue.push({ file: manifest.tvChunks[i].file, mediaType: 'tv' });
    }
  }

  const totalTarget =
    mediaFilter === 'movie'
      ? manifest.moviesCount
      : mediaFilter === 'tv'
      ? manifest.tvCount
      : manifest.totalTitles;

  if (chunkQueue.length === 0) {
    onProgress([], 0, 0, true);
    return;
  }

  const accumulated: TmdbCatalogItem[] = [];

  // 1. Load the very first chunk immediately so first paint has 5,000 top titles
  const first = chunkQueue[0];
  const firstItems = await fetchArchiveChunk(first.file, first.mediaType, manifest.genres);
  if (signal?.aborted) return;
  accumulated.push(...firstItems);
  onProgress([...accumulated], accumulated.length, totalTarget, chunkQueue.length === 1);

  // 2. Stream remaining chunks in batches of 4
  const BATCH_SIZE = 4;
  for (let i = 1; i < chunkQueue.length; i += BATCH_SIZE) {
    if (signal?.aborted) return;
    const batch = chunkQueue.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((c) => fetchArchiveChunk(c.file, c.mediaType, manifest.genres))
    );
    if (signal?.aborted) return;
    for (const chunkItems of results) {
      accumulated.push(...chunkItems);
    }
    const isDone = i + BATCH_SIZE >= chunkQueue.length;
    onProgress([...accumulated], accumulated.length, totalTarget, isDone);
  }
}

export function normalizeTmdbItem(
  raw: any,
  forcedMediaType?: TmdbMediaType,
  genresMap: Record<number, string> = genreLookupMap
): TmdbCatalogItem {
  const inferredType: TmdbMediaType =
    forcedMediaType ||
    (raw.media_type === 'tv' || (!raw.title && Boolean(raw.name || raw.first_air_date))
      ? 'tv'
      : 'movie');

  const title = raw.title || raw.name || raw.original_title || raw.original_name || 'Untitled';
  const releaseDate = raw.release_date || raw.first_air_date || '';
  const year = releaseDate ? releaseDate.slice(0, 4) : 'N/A';
  const hasPoster = Boolean(raw.poster_path);

  const posterUrl = hasPoster
    ? `${TMDB_IMAGE_W500}${raw.poster_path}`
    : createSvgPosterFallback(title, inferredType === 'tv' ? 'TV Shows' : 'Movies');

  const backdropUrl = raw.backdrop_path ? `${TMDB_IMAGE_ORIGINAL}${raw.backdrop_path}` : null;

  const genreNames: string[] = Array.isArray(raw.genres) && raw.genres.length > 0
    ? raw.genres.map((g: TmdbGenre) => g.name)
    : Array.isArray(raw.genre_ids)
    ? raw.genre_ids.map((id: number) => genresMap[id]).filter(Boolean)
    : [];

  return {
    id: `${inferredType}-${raw.id}`,
    tmdbId: String(raw.id),
    mediaType: inferredType,
    title,
    overview:
      raw.overview ||
      `Stream ${title} in high definition with multi-server playback support.`,
    posterUrl,
    backdropUrl,
    hasPoster,
    releaseDate,
    year,
    voteAverage: typeof raw.vote_average === 'number' ? raw.vote_average : 0,
    voteCount: typeof raw.vote_count === 'number' ? raw.vote_count : 0,
    popularity: typeof raw.popularity === 'number' ? raw.popularity : 0,
    genreIds: Array.isArray(raw.genre_ids) ? raw.genre_ids : [],
    genreNames,
  };
}

export async function fetchTmdbFeed(
  feed: TmdbFeedType,
  page = 1
): Promise<TmdbCatalogPage> {
  const meta = TMDB_FEEDS.find((f) => f.key === feed && f.endpoint) || TMDB_FEEDS[1];
  const [genresMap, data] = await Promise.all([
    ensureGenreLookup(),
    fetchTmdbJson<any>(meta.endpoint!, { page }),
  ]);

  const rawResults: any[] = Array.isArray(data.results) ? data.results : [];
  const items = rawResults
    .filter((item) => {
      if (feed === 'trending') {
        return item.media_type === 'movie' || item.media_type === 'tv';
      }
      return true;
    })
    .map((item) => normalizeTmdbItem(item, meta.defaultMediaType, genresMap));

  return {
    page: data.page || page,
    totalPages: Math.min(data.total_pages || 1, 500),
    totalResults: data.total_results || items.length,
    items,
  };
}

export async function searchTmdbMulti(
  query: string,
  page = 1
): Promise<TmdbCatalogPage> {
  const trimmed = query.trim();
  if (!trimmed) {
    return fetchTmdbFeed('trending', page);
  }

  const [genresMap, data] = await Promise.all([
    ensureGenreLookup(),
    fetchTmdbJson<any>('/search/multi', {
      query: trimmed,
      page,
      include_adult: false,
    }),
  ]);

  const rawResults: any[] = Array.isArray(data.results) ? data.results : [];
  const items = rawResults
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map((item) => normalizeTmdbItem(item, undefined, genresMap));

  return {
    page: data.page || page,
    totalPages: Math.min(data.total_pages || 1, 500),
    totalResults: data.total_results || items.length,
    items,
  };
}

export async function searchTmdbByType(
  query: string,
  mediaType: TmdbMediaType,
  page = 1
): Promise<TmdbCatalogPage> {
  const trimmed = query.trim();
  if (!trimmed) {
    return fetchTmdbFeed(mediaType === 'tv' ? 'tv_trending' : 'movie_trending', page);
  }

  const [genresMap, data] = await Promise.all([
    ensureGenreLookup(),
    fetchTmdbJson<any>(`/search/${mediaType}`, {
      query: trimmed,
      page,
      include_adult: false,
    }),
  ]);

  const rawResults: any[] = Array.isArray(data.results) ? data.results : [];
  const items = rawResults.map((item) => normalizeTmdbItem(item, mediaType, genresMap));

  return {
    page: data.page || page,
    totalPages: Math.min(data.total_pages || 1, 500),
    totalResults: data.total_results || items.length,
    items,
  };
}

export async function fetchTmdbDetails(
  mediaType: TmdbMediaType,
  tmdbId: string
): Promise<TmdbMediaDetails> {
  const genresMap = await ensureGenreLookup();
  const appendList =
    mediaType === 'tv'
      ? 'credits,images,recommendations,external_ids'
      : 'credits,images,recommendations';

  const data = await fetchTmdbJson<any>(`/${mediaType}/${encodeURIComponent(tmdbId)}`, {
    append_to_response: appendList,
    include_image_language: 'en,null',
  });

  const base = normalizeTmdbItem(data, mediaType, genresMap);

  const rawCast: any[] = Array.isArray(data.credits?.cast) ? data.credits.cast : [];
  const cast: TmdbCastMember[] = rawCast.map((person) => {
    const hasProfile = Boolean(person.profile_path);
    return {
      id: person.id,
      name: person.name || person.original_name || 'Unknown',
      character: person.character || 'Cast',
      profileUrl: hasProfile
        ? `${TMDB_IMAGE_W500}${person.profile_path}`
        : createCastAvatarFallback(person.name || 'Cast'),
      hasProfile,
    };
  });

  const rawSeasons: any[] = Array.isArray(data.seasons) ? data.seasons : [];
  const regularSeasons = rawSeasons.filter(
    (s) => s.season_number > 0 && (s.episode_count || 0) > 0
  );
  const usableSeasons =
    regularSeasons.length > 0
      ? regularSeasons
      : rawSeasons.filter((s) => (s.episode_count || 0) > 0);

  const seasons: TmdbSeasonInfo[] = usableSeasons.map((s) => ({
    id: s.id,
    seasonNumber: s.season_number,
    name: s.name || `Season ${s.season_number}`,
    episodeCount: s.episode_count || 1,
    airDate: s.air_date,
    overview: s.overview,
    posterPath: s.poster_path,
  }));

  const rawRecs: any[] = Array.isArray(data.recommendations?.results)
    ? data.recommendations.results
    : [];
  const recommendations = rawRecs
    .filter((r) => r.id && (r.title || r.name))
    .slice(0, 12)
    .map((r) => normalizeTmdbItem(r, r.media_type || mediaType, genresMap));

  const rawBackdrops: any[] = Array.isArray(data.images?.backdrops)
    ? data.images.backdrops
    : [];
  const backdropGallery = rawBackdrops
    .slice(0, 8)
    .map((b) => `${TMDB_IMAGE_ORIGINAL}${b.file_path}`);

  const imdbId =
    data.imdb_id ||
    data.external_ids?.imdb_id ||
    null;

  return {
    ...base,
    tagline: data.tagline || '',
    status: data.status || '',
    imdbId,
    runtime: typeof data.runtime === 'number' && data.runtime > 0 ? data.runtime : null,
    numberOfSeasons:
      typeof data.number_of_seasons === 'number' ? data.number_of_seasons : null,
    numberOfEpisodes:
      typeof data.number_of_episodes === 'number' ? data.number_of_episodes : null,
    seasons,
    genres: Array.isArray(data.genres) ? data.genres : [],
    cast,
    recommendations,
    backdropGallery,
  };
}

export async function findByImdbId(
  imdbId: string
): Promise<{ mediaType: TmdbMediaType; tmdbId: string } | null> {
  try {
    const data = await fetchTmdbJson<any>(`/find/${encodeURIComponent(imdbId)}`, {
      external_source: 'imdb_id',
    });
    if (Array.isArray(data.movie_results) && data.movie_results[0]) {
      return { mediaType: 'movie', tmdbId: String(data.movie_results[0].id) };
    }
    if (Array.isArray(data.tv_results) && data.tv_results[0]) {
      return { mediaType: 'tv', tmdbId: String(data.tv_results[0].id) };
    }
  } catch {}
  return null;
}

export interface TmdbEpisodeSummary {
  episodeNumber: number;
  name: string;
}

export async function fetchTvSeasonEpisodes(
  tmdbId: string,
  seasonNumber: number
): Promise<TmdbEpisodeSummary[]> {
  try {
    const data = await fetchTmdbJson<any>(
      `/tv/${encodeURIComponent(tmdbId)}/season/${seasonNumber}`
    );
    const eps: any[] = Array.isArray(data.episodes) ? data.episodes : [];
    return eps.map((e) => ({
      episodeNumber: e.episode_number,
      name: e.name || `Episode ${e.episode_number}`,
    }));
  } catch {
    return [];
  }
}

export interface TmdbCollectionSummary {
  id: number;
  name: string;
  overview: string;
  backdropUrl: string | null;
  posterUrl: string;
  movieCount: number;
  parts: TmdbCatalogItem[];
}

export async function fetchTmdbTrendingSplit(
  mediaType: TmdbMediaType,
  page = 1
): Promise<TmdbCatalogPage> {
  const [genresMap, data] = await Promise.all([
    ensureGenreLookup(),
    fetchTmdbJson<any>(`/trending/${mediaType}/week`, { page }),
  ]);

  const rawResults: any[] = Array.isArray(data.results) ? data.results : [];
  const items = rawResults.map((item) =>
    normalizeTmdbItem(item, mediaType, genresMap)
  );

  return {
    page: data.page || page,
    totalPages: Math.min(data.total_pages || 1, 500),
    totalResults: data.total_results || items.length,
    items,
  };
}

export async function fetchTmdbCollection(
  collectionId: number
): Promise<TmdbCollectionSummary | null> {
  try {
    const [genresMap, data] = await Promise.all([
      ensureGenreLookup(),
      fetchTmdbJson<any>(`/collection/${collectionId}`),
    ]);
    const rawParts: any[] = Array.isArray(data.parts) ? data.parts : [];
    const parts = rawParts
      .map((p) => normalizeTmdbItem(p, 'movie', genresMap))
      .sort((a, b) => (a.releaseDate || '9999').localeCompare(b.releaseDate || '9999'));

    const backdropPath =
      data.backdrop_path ||
      rawParts.find((p) => p.backdrop_path)?.backdrop_path ||
      null;

    return {
      id: data.id || collectionId,
      name: data.name || 'Collection',
      overview: data.overview || '',
      backdropUrl: backdropPath ? `${TMDB_IMAGE_ORIGINAL}${backdropPath}` : null,
      posterUrl: data.poster_path
        ? `${TMDB_IMAGE_W500}${data.poster_path}`
        : parts[0]?.posterUrl || '',
      movieCount: parts.length,
      parts,
    };
  } catch {
    return null;
  }
}

export async function fetchTmdbCollectionsBatch(
  collectionIds: number[]
): Promise<TmdbCollectionSummary[]> {
  const results = await Promise.all(
    collectionIds.map((id) => fetchTmdbCollection(id))
  );
  return results.filter((c): c is TmdbCollectionSummary => Boolean(c));
}

export async function fetchTmdbNetworkContent(
  tvNetworkId: string,
  watchProviderId: string,
  preferredMode: 'all' | 'movie' | 'tv' = 'all',
  page = 1
): Promise<TmdbCatalogPage> {
  const genresMap = await ensureGenreLookup();

  const movieReq =
    preferredMode === 'tv'
      ? Promise.resolve({ results: [], total_pages: 1, total_results: 0 })
      : fetchTmdbJson<any>('/discover/movie', {
          with_watch_providers: watchProviderId,
          watch_region: 'US',
          sort_by: 'popularity.desc',
          page,
        }).catch(() => ({ results: [], total_pages: 1, total_results: 0 }));

  const tvReq =
    preferredMode === 'movie'
      ? Promise.resolve({ results: [], total_pages: 1, total_results: 0 })
      : fetchTmdbJson<any>('/discover/tv', {
          with_networks: tvNetworkId,
          sort_by: 'popularity.desc',
          page,
        }).catch(() => ({ results: [], total_pages: 1, total_results: 0 }));

  const [movieData, tvData] = await Promise.all([movieReq, tvReq]);

  const movies = (Array.isArray(movieData.results) ? movieData.results : []).map((r: any) =>
    normalizeTmdbItem(r, 'movie', genresMap)
  );
  const shows = (Array.isArray(tvData.results) ? tvData.results : []).map((r: any) =>
    normalizeTmdbItem(r, 'tv', genresMap)
  );

  const combined = [...shows, ...movies].sort(
    (a, b) => (b.popularity || 0) - (a.popularity || 0)
  );

  return {
    page,
    totalPages: Math.min(
      Math.max(movieData.total_pages || 1, tvData.total_pages || 1),
      500
    ),
    totalResults: (movieData.total_results || 0) + (tvData.total_results || 0),
    items: combined,
  };
}

export async function fetchTmdbStudioContent(
  companyId: string,
  preferredMode: 'all' | 'movie' | 'tv' = 'all',
  page = 1,
  tvCompanyId?: string
): Promise<TmdbCatalogPage> {
  const genresMap = await ensureGenreLookup();

  const movieReq =
    preferredMode === 'tv'
      ? Promise.resolve({ results: [], total_pages: 1, total_results: 0 })
      : fetchTmdbJson<any>('/discover/movie', {
          with_companies: companyId,
          sort_by: 'popularity.desc',
          page,
        }).catch(() => ({ results: [], total_pages: 1, total_results: 0 }));

  const tvReq =
    preferredMode === 'movie'
      ? Promise.resolve({ results: [], total_pages: 1, total_results: 0 })
      : fetchTmdbJson<any>('/discover/tv', {
          with_companies: tvCompanyId || companyId,
          sort_by: 'popularity.desc',
          page,
        }).catch(() => ({ results: [], total_pages: 1, total_results: 0 }));

  const [movieData, tvData] = await Promise.all([movieReq, tvReq]);

  const movies = (Array.isArray(movieData.results) ? movieData.results : []).map((r: any) =>
    normalizeTmdbItem(r, 'movie', genresMap)
  );
  const shows = (Array.isArray(tvData.results) ? tvData.results : []).map((r: any) =>
    normalizeTmdbItem(r, 'tv', genresMap)
  );

  const combined = [...movies, ...shows].sort(
    (a, b) => (b.popularity || 0) - (a.popularity || 0)
  );

  return {
    page,
    totalPages: Math.min(
      Math.max(movieData.total_pages || 1, tvData.total_pages || 1),
      500
    ),
    totalResults: (movieData.total_results || 0) + (tvData.total_results || 0),
    items: combined,
  };
}

export interface ServerCatalogStats {
  ready: boolean;
  moviesCount: number;
  tvCount: number;
  totalTitles: number;
  richMoviesCount: number;
  richTvCount: number;
  genres: Record<string, string>;
}

export interface ServerCatalogQueryResult {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  indexedTotal: number;
  metadataScopeNote: string | null;
  items: TmdbCatalogItem[];
}

let serverStatsPromise: Promise<ServerCatalogStats | null> | null = null;

export async function fetchServerCatalogStats(): Promise<ServerCatalogStats | null> {
  if (!serverStatsPromise) {
    serverStatsPromise = fetch('/api/tmdb-catalog/stats')
      .then((res) => (res.ok ? (res.json() as Promise<ServerCatalogStats>) : null))
      .then((data) => {
        if (data?.genres) {
          for (const [id, name] of Object.entries(data.genres)) {
            genreLookupMap[Number(id)] = name;
          }
        }
        return data && data.totalTitles > 0 ? data : null;
      })
      .catch(() => null);
  }
  return serverStatsPromise;
}

export async function queryServerCatalogPage(options: {
  media: 'all' | 'movie' | 'tv';
  q?: string;
  genre?: string;
  era?: string;
  sort?: 'popularity' | 'rating' | 'newest' | 'title';
  page?: number;
  limit?: number;
  genresMap?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<ServerCatalogQueryResult> {
  const url = new URL('/api/tmdb-catalog/query', window.location.origin);
  url.searchParams.set('media', options.media);
  if (options.q) url.searchParams.set('q', options.q);
  if (options.genre && options.genre !== 'All') url.searchParams.set('genre', options.genre);
  if (options.era && options.era !== 'All') url.searchParams.set('era', options.era);
  if (options.sort) url.searchParams.set('sort', options.sort);
  url.searchParams.set('page', String(options.page || 1));
  url.searchParams.set('limit', String(options.limit || 50));

  const res = await fetch(url.toString(), { signal: options.signal });
  if (!res.ok) {
    throw new Error(`Catalog query failed (${res.status})`);
  }

  const data = (await res.json()) as {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    indexedTotal: number;
    metadataScopeNote: string | null;
    items: Array<{ mediaType: TmdbMediaType; tuple: RawArchiveTuple }>;
  };

  const gMap = options.genresMap || {};
  const items = (data.items || []).map((entry) =>
    hydrateArchiveTuple(entry.tuple, entry.mediaType, gMap)
  );

  return {
    page: data.page,
    limit: data.limit,
    totalItems: data.totalItems,
    totalPages: data.totalPages,
    indexedTotal: data.indexedTotal,
    metadataScopeNote: data.metadataScopeNote || null,
    items,
  };
}


