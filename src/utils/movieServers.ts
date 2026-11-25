export type EmbedMediaType = 'movie' | 'tv';
export type ServerFlagCode = 'us' | 'gb' | 'fr' | 'es' | 'it' | 'jp';

export interface MovieServerConfig {
  key: string;
  label: string;
  shortLabel: string;
  flag: ServerFlagCode;
  featured?: boolean;
  baseUrl: string;
  pathPattern: string;
  tvPathPattern: string;
  group: 'vidsrc' | 'custom' | 'anime' | 'language';
  idType?: 'tmdb' | 'imdb' | 'anilist';
  acceptsBothIds?: boolean;
  noSandboxBlock?: boolean;
  language?: string;
  trackLabel?: 'SUB' | 'DUB';
}

/**
 * Centralized base URLs for multi-server movie, TV, cartoon & anime embedding.
 */
export const SERVER_BASE_URLS = {
  cinesrc: 'https://cinesrc.st',
  aniembed: 'https://aniembed.se',
  animeembed: 'https://animeembed.com',
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
  framextv: 'https://framextv.cc',
  vidy: 'https://www.vidy.st',
  bingr: 'https://bingr.one',
} as const;

/**
 * Centralized SERVERS config map supporting dynamic Movies, TV Shows, Cartoons & Anime embeds
 * (`{id}`, `{season}`, `{episode}`) including AniList-backed Sub & Dub anime servers.
 */
export const SERVERS: Record<string, MovieServerConfig> = {
  cinesrc: {
    key: 'cinesrc',
    label: 'CineSrc HD',
    shortLabel: 'cinesrc',
    flag: 'us',
    featured: true,
    baseUrl: SERVER_BASE_URLS.cinesrc,
    pathPattern: '/embed/movie/{id}',
    tvPathPattern: '/embed/tv/{id}?s={season}&e={episode}',
    group: 'custom',
    idType: 'tmdb',
    noSandboxBlock: true,
  },
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
  framextv: {
    key: 'framextv',
    label: 'FrameXTV',
    shortLabel: 'framextv',
    flag: 'us',
    featured: true,
    baseUrl: SERVER_BASE_URLS.framextv,
    pathPattern: '/embed/{id}?autoplay=1&muted=0',
    tvPathPattern: '/embed/{id}/{season}/{episode}?autoplay=1&muted=0',
    group: 'custom',
    idType: 'tmdb',
    noSandboxBlock: true,
  },
  vidy: {
    key: 'vidy',
    label: 'Vidy HD',
    shortLabel: 'vidy',
    flag: 'gb',
    baseUrl: SERVER_BASE_URLS.vidy,
    pathPattern: '/movie/{id}?color=DC2626',
    tvPathPattern: '/tv/{id}/{season}/{episode}?color=DC2626',
    group: 'custom',
    idType: 'tmdb',
    noSandboxBlock: true,
  },
  bingr: {
    key: 'bingr',
    label: 'Bingr',
    shortLabel: 'bingr',
    flag: 'us',
    baseUrl: SERVER_BASE_URLS.bingr,
    pathPattern: '/watch/movie/{id}',
    tvPathPattern: '/watch/tv/{id}/{season}/{episode}',
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

  // --- Dedicated Anime Only Embeds (Sub & Dub via AniList ID) ---
  aniembed_sub: {
    key: 'aniembed_sub',
    label: 'AniEmbed (Sub)',
    shortLabel: 'aniembed',
    flag: 'jp',
    featured: true,
    baseUrl: SERVER_BASE_URLS.aniembed,
    pathPattern: '/e/{id}/1',
    tvPathPattern: '/e/{id}/{episode}',
    group: 'anime',
    idType: 'anilist',
    noSandboxBlock: true,
    trackLabel: 'SUB',
  },
  aniembed_dub: {
    key: 'aniembed_dub',
    label: 'AniEmbed (Dub)',
    shortLabel: 'aniembed',
    flag: 'us',
    baseUrl: SERVER_BASE_URLS.aniembed,
    pathPattern: '/e/{id}/1?lang=dub',
    tvPathPattern: '/e/{id}/{episode}?lang=dub',
    group: 'anime',
    idType: 'anilist',
    noSandboxBlock: true,
    trackLabel: 'DUB',
  },
  animeembed_sub: {
    key: 'animeembed_sub',
    label: 'AnimeEmbed (Sub)',
    shortLabel: 'animeembed',
    flag: 'jp',
    featured: true,
    baseUrl: SERVER_BASE_URLS.animeembed,
    pathPattern: '/embed/ani/{id}/1?track=sub&autoPlay=0&muted=0&autoSkip=1&autoNext=0&start=0&accent=9b87ff',
    tvPathPattern: '/embed/ani/{id}/{episode}?track=sub&autoPlay=0&muted=0&autoSkip=1&autoNext=0&start=0&accent=9b87ff',
    group: 'anime',
    idType: 'anilist',
    noSandboxBlock: true,
    trackLabel: 'SUB',
  },
  animeembed_dub: {
    key: 'animeembed_dub',
    label: 'AnimeEmbed (Dub)',
    shortLabel: 'animeembed',
    flag: 'us',
    baseUrl: SERVER_BASE_URLS.animeembed,
    pathPattern: '/embed/ani/{id}/1?track=dub&autoPlay=0&muted=0&autoSkip=1&autoNext=0&start=0&accent=9b87ff',
    tvPathPattern: '/embed/ani/{id}/{episode}?track=dub&autoPlay=0&muted=0&autoSkip=1&autoNext=0&start=0&accent=9b87ff',
    group: 'anime',
    idType: 'anilist',
    noSandboxBlock: true,
    trackLabel: 'DUB',
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
 * Dynamically generates the embed URL for any Movie, TV Show, Cartoon, or Anime
 * using TMDB, IMDb, or AniList IDs as required by each provider.
 */
export function buildMediaEmbedUrl(
  serverKey: string,
  mediaType: EmbedMediaType,
  id: string,
  options?: {
    imdbId?: string | null;
    tmdbId?: string | null;
    anilistId?: string | number | null;
    season?: number;
    episode?: number;
  }
): string {
  const cfg = SERVERS[serverKey] || SERVERS[DEFAULT_MOVIE_SERVER_KEY];
  const cleanBase = cfg.baseUrl.replace(/\/+$/, '');
  const rawId = String(id || '').trim();
  const imdbId = options?.imdbId ? String(options.imdbId).trim() : '';
  const tmdbId = options?.tmdbId ? String(options.tmdbId).trim() : '';
  const anilistId = options?.anilistId ? String(options.anilistId).trim() : '';

  let selectedId = rawId;
  if (cfg.idType === 'anilist') {
    selectedId = anilistId || tmdbId || rawId;
  } else if (cfg.acceptsBothIds) {
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
