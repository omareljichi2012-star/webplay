export type EmbedMediaType = 'movie' | 'tv';
export type ServerFlagCode = 'us' | 'gb' | 'fr' | 'es' | 'it';

export interface MovieServerConfig {
  key: string;
  label: string;
  shortLabel: string;
  flag: ServerFlagCode;
  featured?: boolean;
  baseUrl: string;
  pathPattern: string;
  tvPathPattern: string;
  group: 'vidsrc' | 'custom' | 'language';
  idType?: 'tmdb' | 'imdb';
  acceptsBothIds?: boolean;
  noSandboxBlock?: boolean;
  language?: string;
}

/**
 * Centralized base URLs for multi-server movie & TV embedding.
 */
export const SERVER_BASE_URLS = {
  vidsrcMov: 'https://vidsrc.mov',
  vidsrcSh: 'https://vidsrc.sh',
  vidsrcCc: 'https://vidsrc.cc',
  vidsrcXyz: 'https://vidsrc.xyz',
  vidsrcMe: 'https://vidsrc.me',
  vidsrcTo: 'https://vidsrc.to',
  vidlink: 'https://vidlink.pro',
  embedsu: 'https://embed.su',
  autoembed: 'https://autoembed.me',
  superembed: 'https://multiembed.mov',
  streamex: 'https://streamex.hn',
  framex: 'https://framex.vip',
} as const;

/**
 * Centralized SERVERS config map supporting dynamic movie & TV Show embeds
 * (`{id}`, `{season}`, `{episode}`) across all mirrors, backup providers, and language dubs.
 * Ordered cleanly for the 4-column under-player server grid.
 */
export const SERVERS: Record<string, MovieServerConfig> = {
  streamex: {
    key: 'streamex',
    label: 'StreamX Embed',
    shortLabel: 'streamex',
    flag: 'us',
    featured: true,
    baseUrl: SERVER_BASE_URLS.streamex,
    pathPattern: '/embed/movie/{id}',
    tvPathPattern: '/embed/tv/{id}/{season}/{episode}',
    group: 'custom',
    idType: 'tmdb',
    noSandboxBlock: true,
  },
  vidlink: {
    key: 'vidlink',
    label: 'VidLink Pro',
    shortLabel: 'vidlink',
    flag: 'gb',
    baseUrl: SERVER_BASE_URLS.vidlink,
    pathPattern: '/movie/{id}',
    tvPathPattern: '/tv/{id}/{season}/{episode}',
    group: 'custom',
    idType: 'tmdb',
    noSandboxBlock: true,
  },
  autoembed: {
    key: 'autoembed',
    label: 'AutoEmbed',
    shortLabel: 'autoembed',
    flag: 'us',
    baseUrl: SERVER_BASE_URLS.autoembed,
    pathPattern: '/movie/tmdb/{id}',
    tvPathPattern: '/tv/tmdb/{id}/{season}/{episode}',
    group: 'custom',
    idType: 'tmdb',
    noSandboxBlock: true,
  },
  vidsrc_v2: {
    key: 'vidsrc_v2',
    label: 'VidSrc v2',
    shortLabel: 'vidsrc v2',
    flag: 'us',
    featured: true,
    baseUrl: SERVER_BASE_URLS.vidsrcCc,
    pathPattern: '/v2/embed/movie/{id}',
    tvPathPattern: '/v2/embed/tv/{id}/{season}/{episode}',
    group: 'vidsrc',
    idType: 'tmdb',
    noSandboxBlock: false,
  },
  vidsrc_sh: {
    key: 'vidsrc_sh',
    label: 'VidSrc.sh Direct',
    shortLabel: 'vidsrc.sh',
    flag: 'us',
    baseUrl: SERVER_BASE_URLS.vidsrcSh,
    pathPattern: '/embed/movie/{id}/',
    tvPathPattern: '/embed/tv/{id}/{season}/{episode}/',
    group: 'vidsrc',
    idType: 'tmdb',
    acceptsBothIds: true,
    noSandboxBlock: false,
  },
  embedsu: {
    key: 'embedsu',
    label: 'Embed.su HD',
    shortLabel: 'embed.su',
    flag: 'us',
    baseUrl: SERVER_BASE_URLS.embedsu,
    pathPattern: '/embed/movie/{id}',
    tvPathPattern: '/embed/tv/{id}/{season}/{episode}',
    group: 'custom',
    idType: 'tmdb',
    noSandboxBlock: true,
  },
  vidsrc_xyz: {
    key: 'vidsrc_xyz',
    label: 'VidSrc XYZ',
    shortLabel: 'vidsrc.xyz',
    flag: 'us',
    baseUrl: SERVER_BASE_URLS.vidsrcXyz,
    pathPattern: '/embed/movie/{id}',
    tvPathPattern: '/embed/tv/{id}/{season}-{episode}',
    group: 'vidsrc',
    idType: 'tmdb',
    noSandboxBlock: false,
  },
  superembed: {
    key: 'superembed',
    label: 'SuperEmbed',
    shortLabel: 'superembed',
    flag: 'gb',
    baseUrl: SERVER_BASE_URLS.superembed,
    pathPattern: '/?video_id={id}&tmdb=1',
    tvPathPattern: '/?video_id={id}&tmdb=1&s={season}&e={episode}',
    group: 'custom',
    idType: 'tmdb',
    noSandboxBlock: false,
  },
  vidsrc_mov: {
    key: 'vidsrc_mov',
    label: 'VidSrc.mov',
    shortLabel: 'vidsrc',
    flag: 'us',
    featured: true,
    baseUrl: SERVER_BASE_URLS.vidsrcMov,
    pathPattern: '/embed/movie/{id}',
    tvPathPattern: '/embed/tv/{id}/{season}/{episode}',
    group: 'vidsrc',
    idType: 'tmdb',
    acceptsBothIds: true,
    noSandboxBlock: false,
  },
  vidsrc_me: {
    key: 'vidsrc_me',
    label: 'VidSrc.me',
    shortLabel: 'vidsrc.me',
    flag: 'us',
    baseUrl: SERVER_BASE_URLS.vidsrcMe,
    pathPattern: '/embed/movie/{id}',
    tvPathPattern: '/embed/tv/{id}/{season}-{episode}',
    group: 'vidsrc',
    idType: 'tmdb',
    noSandboxBlock: false,
  },
  framex: {
    key: 'framex',
    label: 'FrameX VIP',
    shortLabel: 'framex',
    flag: 'us',
    baseUrl: SERVER_BASE_URLS.framex,
    pathPattern: '/embed/movie/{id}',
    tvPathPattern: '/embed/tv/{id}/{season}/{episode}',
    group: 'custom',
    idType: 'tmdb',
    noSandboxBlock: true,
  },
  vidsrc_to: {
    key: 'vidsrc_to',
    label: 'VidSrc.to',
    shortLabel: 'vidsrc.to',
    flag: 'us',
    featured: true,
    baseUrl: SERVER_BASE_URLS.vidsrcTo,
    pathPattern: '/embed/movie/{id}',
    tvPathPattern: '/embed/tv/{id}/{season}/{episode}',
    group: 'vidsrc',
    idType: 'tmdb',
    noSandboxBlock: false,
  },
  vidsrc_fr: {
    key: 'vidsrc_fr',
    label: 'French (FR)',
    shortLabel: 'french',
    flag: 'fr',
    baseUrl: SERVER_BASE_URLS.vidsrcMe,
    pathPattern: '/embed/movie?tmdb={id}&ds_lang=fr',
    tvPathPattern: '/embed/tv?tmdb={id}&season={season}&episode={episode}&ds_lang=fr',
    group: 'language',
    idType: 'tmdb',
    noSandboxBlock: false,
    language: 'fr',
  },
  vidsrc_es: {
    key: 'vidsrc_es',
    label: 'Spanish (ES)',
    shortLabel: 'spanish',
    flag: 'es',
    baseUrl: SERVER_BASE_URLS.vidsrcMe,
    pathPattern: '/embed/movie?tmdb={id}&ds_lang=es',
    tvPathPattern: '/embed/tv?tmdb={id}&season={season}&episode={episode}&ds_lang=es',
    group: 'language',
    idType: 'tmdb',
    noSandboxBlock: false,
    language: 'es',
  },
  vidsrc_it: {
    key: 'vidsrc_it',
    label: 'Italian (IT)',
    shortLabel: 'italian',
    flag: 'it',
    baseUrl: SERVER_BASE_URLS.vidsrcMe,
    pathPattern: '/embed/movie?tmdb={id}&ds_lang=it',
    tvPathPattern: '/embed/tv?tmdb={id}&season={season}&episode={episode}&ds_lang=it',
    group: 'language',
    idType: 'tmdb',
    noSandboxBlock: false,
    language: 'it',
  },
};

export const DEFAULT_MOVIE_SERVER_KEY = 'vidsrc_mov';
export const SANDBOX_SAFE_SERVER_KEY = 'vidlink';
export const DEFAULT_FEATURED_MOVIE_ID = '969681';
export const DEFAULT_FEATURED_IMDB_ID = 'tt22084616';

export function isImdbId(value?: string | null): boolean {
  return Boolean(value && /^tt\d+$/i.test(value.trim()));
}

/**
 * Dynamically generates the embed URL for any TMDB Movie or TV Show ID
 * (and season/episode for TV shows) using the selected server's URL template.
 */
export function buildMediaEmbedUrl(
  serverKey: string,
  mediaType: EmbedMediaType,
  id: string,
  options?: {
    imdbId?: string | null;
    tmdbId?: string | null;
    season?: number;
    episode?: number;
  }
): string {
  const cfg = SERVERS[serverKey] || SERVERS[DEFAULT_MOVIE_SERVER_KEY];
  const cleanBase = cfg.baseUrl.replace(/\/+$/, '');
  const rawId = String(id || '').trim();
  const imdbId = options?.imdbId ? String(options.imdbId).trim() : '';
  const tmdbId = options?.tmdbId ? String(options.tmdbId).trim() : '';

  let selectedId = rawId;
  if (cfg.acceptsBothIds) {
    if (isImdbId(rawId)) {
      selectedId = rawId;
    } else if (rawId) {
      selectedId = rawId;
    } else if (tmdbId) {
      selectedId = tmdbId;
    } else if (imdbId) {
      selectedId = imdbId;
    }
  } else if (cfg.idType === 'imdb') {
    selectedId = isImdbId(rawId) ? rawId : imdbId || rawId;
  } else {
    selectedId = isImdbId(rawId) && tmdbId ? tmdbId : rawId;
  }

  const cleanId = encodeURIComponent(selectedId);
  const seasonNum = Math.max(1, Number(options?.season || 1));
  const episodeNum = Math.max(1, Number(options?.episode || 1));

  const template = mediaType === 'tv' ? cfg.tvPathPattern : cfg.pathPattern;
  const path = template
    .replace(/\{id\}/g, cleanId)
    .replace(/\{season\}/g, String(seasonNum))
    .replace(/\{episode\}/g, String(episodeNum));

  return `${cleanBase}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Backward-compatible wrapper for movie embed generation.
 */
export function buildMovieEmbedUrl(
  serverKey: string,
  id: string,
  imdbId?: string,
  tmdbId?: string
): string {
  return buildMediaEmbedUrl(serverKey, 'movie', id, { imdbId, tmdbId });
}
