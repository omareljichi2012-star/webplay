export type NostalgiaChannelId =
  | 'nick-90s'
  | 'silent-1920s'
  | 'era-1990s'
  | 'era-2000s'
  | 'trailers'
  | 'bttf-vault'
  | 'archived-movies';

export interface NostalgiaChannelMeta {
  id: NostalgiaChannelId;
  channelNumber: string;
  label: string;
  shortLabel: string;
  eraLabel: string;
  description: string;
  query: string;
  sort: string;
}

export interface ArchiveBroadcastItem {
  identifier: string;
  title: string;
  description: string;
  year: string;
  creator: string;
  runtime: string;
  collection: string;
  thumbUrl: string;
  embedUrl: string;
  detailsUrl: string;
  channelId: NostalgiaChannelId | 'search';
}

export const NOSTALGIA_CHANNELS: NostalgiaChannelMeta[] = [
  {
    id: 'nick-90s',
    channelNumber: 'CH 01',
    label: '90s Cartoons & Nickelodeon',
    shortLabel: '90s & Nick',
    eraLabel: '1990s Animation',
    description:
      '90s cartoon blocks, Nickelodeon bumpers, classic promo reels, and Saturday morning tape archives.',
    query:
      'mediatype:movies AND (nickelodeon OR "90s cartoons" OR "saturday morning cartoons" OR "cartoon commercials")',
    sort: 'downloads desc',
  },
  {
    id: 'silent-1920s',
    channelNumber: 'CH 02',
    label: '1920s Silent Comedy',
    shortLabel: '1920s Silent',
    eraLabel: '1918–1929',
    description:
      'Charlie Chaplin, Buster Keaton, Harold Lloyd, and Laurel & Hardy restored silent comedy reels.',
    query:
      'mediatype:movies AND (subject:"silent films" OR "Buster Keaton" OR "Charlie Chaplin" OR "Harold Lloyd") AND year:[1915 TO 1930]',
    sort: 'downloads desc',
  },
  {
    id: 'era-1990s',
    channelNumber: 'CH 03',
    label: '1990s Retro TV & VHS',
    shortLabel: '1990s TV',
    eraLabel: '1990–1999',
    description:
      'Late-night 90s TV recordings, retro commercials, MTV-era station IDs, and CRT broadcast nostalgia.',
    query:
      'mediatype:movies AND year:[1990 TO 1999] AND (commercials OR bumper OR promo OR broadcast OR cartoon OR retro)',
    sort: 'downloads desc',
  },
  {
    id: 'era-2000s',
    channelNumber: 'CH 04',
    label: '2000s Nostalgia Vault',
    shortLabel: '2000s',
    eraLabel: '2000–2009',
    description:
      'Early-2000s bumpers, Y2K trailers, retro gaming spots, and turn-of-the-millennium broadcasts.',
    query:
      'mediatype:movies AND year:[2000 TO 2009] AND (commercial OR promo OR trailer OR cartoon OR nostalgia OR animation)',
    sort: 'downloads desc',
  },
  {
    id: 'trailers',
    channelNumber: 'CH 05',
    label: 'Classic Movie Trailers',
    shortLabel: 'Trailers',
    eraLabel: '1980s–2000s',
    description:
      'Original theatrical trailers, VHS previews, and classic coming-soon reels from theater archives.',
    query:
      'mediatype:movies AND (title:"trailer" OR subject:"trailers" OR "theatrical trailer") AND (1985 OR 1990 OR 1995 OR 1999 OR 2000 OR comedy OR sci-fi)',
    sort: 'downloads desc',
  },
  {
    id: 'bttf-vault',
    channelNumber: 'CH 06',
    label: 'Back to the Future & 80s',
    shortLabel: 'Back to the Future',
    eraLabel: '1985–1990',
    description:
      'Archived Back to the Future trailers, vintage 1985 premieres, DeLorean specials, and 80s TV promos.',
    query:
      'mediatype:movies AND ("back to the future" OR "delorean" OR "michael j. fox")',
    sort: 'downloads desc',
  },
  {
    id: 'archived-movies',
    channelNumber: 'CH 07',
    label: 'Archived Feature Films',
    shortLabel: 'Feature Vault',
    eraLabel: 'Public Archive',
    description:
      'Full public-domain feature comedies, cult classics, and golden-age cinema preserved on Archive.org.',
    query:
      'mediatype:movies AND (collection:feature_films OR collection:classic_tv) AND (comedy OR adventure OR classic)',
    sort: 'downloads desc',
  },
];

// Curated verified starter classics per channel in case IA search throttles or filters slowly
const CURATED_FALLBACKS: Record<NostalgiaChannelId, ArchiveBroadcastItem[]> = {
  'nick-90s': [
    {
      identifier: 'blues-clues-s-03-e-59-blues-big-musical-movie',
      title: "Blue's Clues & 90s Nick Vault",
      description: 'Classic late-90s Nickelodeon animation and musical special archived on Internet Archive.',
      year: '1996',
      creator: 'Nickelodeon Archive',
      runtime: 'Full Broadcast',
      collection: '90s Animation',
      thumbUrl: 'https://archive.org/services/img/blues-clues-s-03-e-59-blues-big-musical-movie',
      embedUrl: 'https://archive.org/embed/blues-clues-s-03-e-59-blues-big-musical-movie?autoplay=1',
      detailsUrl: 'https://archive.org/details/blues-clues-s-03-e-59-blues-big-musical-movie',
      channelId: 'nick-90s',
    },
    {
      identifier: 'nickelodeon-bumpers-and-promos-1990s',
      title: '1990s Nickelodeon Bumpers & Promos',
      description: 'Authentic 1990s Nicktoons station IDs and Saturday morning promo bumpers.',
      year: '1994',
      creator: 'Internet Archive TV',
      runtime: 'VHS Rip',
      collection: '90s Cartoons',
      thumbUrl: 'https://archive.org/services/img/nickelodeon-bumpers-and-promos-1990s',
      embedUrl: 'https://archive.org/embed/nickelodeon-bumpers-and-promos-1990s?autoplay=1',
      detailsUrl: 'https://archive.org/details/nickelodeon-bumpers-and-promos-1990s',
      channelId: 'nick-90s',
    },
  ],
  'silent-1920s': [
    {
      identifier: 'Cops1922',
      title: 'Buster Keaton — "Cops" (1922)',
      description: 'Iconic 1922 silent slapstick comedy starring Buster Keaton caught in a city-wide chase.',
      year: '1922',
      creator: 'Buster Keaton Productions',
      runtime: '18:11',
      collection: '1920s Silent Comedy',
      thumbUrl: 'https://archive.org/services/img/Cops1922',
      embedUrl: 'https://archive.org/embed/Cops1922?autoplay=1',
      detailsUrl: 'https://archive.org/details/Cops1922',
      channelId: 'silent-1920s',
    },
    {
      identifier: 'CutTheGoat1921',
      title: 'Buster Keaton — "The Goat" (1921)',
      description: 'Restored 1921 silent comedy short filled with precision physical gags and train chases.',
      year: '1921',
      creator: 'Buster Keaton',
      runtime: '23:00',
      collection: '1920s Silent Comedy',
      thumbUrl: 'https://archive.org/services/img/CutTheGoat1921',
      embedUrl: 'https://archive.org/embed/CutTheGoat1921?autoplay=1',
      detailsUrl: 'https://archive.org/details/CutTheGoat1921',
      channelId: 'silent-1920s',
    },
  ],
  'era-1990s': [],
  'era-2000s': [],
  trailers: [],
  'bttf-vault': [],
  'archived-movies': [
    {
      identifier: 'HisGirlFriday',
      title: 'His Girl Friday (1940)',
      description: 'Screwball comedy classic directed by Howard Hawks starring Cary Grant and Rosalind Russell.',
      year: '1940',
      creator: 'Columbia Pictures',
      runtime: '92:00',
      collection: 'Archived Movies',
      thumbUrl: 'https://archive.org/services/img/HisGirlFriday',
      embedUrl: 'https://archive.org/embed/HisGirlFriday?autoplay=1',
      detailsUrl: 'https://archive.org/details/HisGirlFriday',
      channelId: 'archived-movies',
    },
  ],
};

const channelCache = new Map<string, ArchiveBroadcastItem[]>();
const streamCache = new Map<string, { mp4Url: string | null; embedUrl: string }>();

function cleanText(raw: unknown): string {
  if (Array.isArray(raw)) return cleanText(raw[0]);
  if (typeof raw !== 'string') return '';
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapArchiveDoc(
  doc: Record<string, unknown>,
  channelId: NostalgiaChannelId | 'search'
): ArchiveBroadcastItem | null {
  const identifier = cleanText(doc.identifier);
  if (!identifier) return null;

  const title = cleanText(doc.title) || identifier.replace(/[_-]+/g, ' ');
  const description =
    cleanText(doc.description) ||
    `Preserved broadcast archived on Internet Archive (${identifier}).`;
  const year = cleanText(doc.year) || cleanText(doc.date).slice(0, 4) || '';
  const creator = cleanText(doc.creator) || 'Internet Archive';
  const runtime = cleanText(doc.runtime) || '';
  const collection = Array.isArray(doc.collection)
    ? cleanText(doc.collection[0])
    : cleanText(doc.collection) || 'Archive Vault';

  return {
    identifier,
    title,
    description,
    year,
    creator,
    runtime,
    collection,
    thumbUrl: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    embedUrl: `https://archive.org/embed/${encodeURIComponent(identifier)}?autoplay=1`,
    detailsUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    channelId,
  };
}

export async function fetchNostalgiaChannel(
  channelId: NostalgiaChannelId,
  rows = 24
): Promise<ArchiveBroadcastItem[]> {
  const cacheKey = `${channelId}:${rows}`;
  if (channelCache.has(cacheKey)) {
    return channelCache.get(cacheKey)!;
  }

  const channel = NOSTALGIA_CHANNELS.find((c) => c.id === channelId) || NOSTALGIA_CHANNELS[0];
  const url = new URL('https://archive.org/advancedsearch.php');
  url.searchParams.set('q', channel.query);
  url.searchParams.append('fl[]', 'identifier');
  url.searchParams.append('fl[]', 'title');
  url.searchParams.append('fl[]', 'description');
  url.searchParams.append('fl[]', 'year');
  url.searchParams.append('fl[]', 'date');
  url.searchParams.append('fl[]', 'creator');
  url.searchParams.append('fl[]', 'runtime');
  url.searchParams.append('fl[]', 'collection');
  url.searchParams.append('sort[]', channel.sort);
  url.searchParams.set('rows', String(rows));
  url.searchParams.set('page', '1');
  url.searchParams.set('output', 'json');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Archive API ${res.status}`);
    const data = await res.json();
    const docs: Record<string, unknown>[] = data?.response?.docs || [];
    const mapped = docs
      .map((d) => mapArchiveDoc(d, channelId))
      .filter((x): x is ArchiveBroadcastItem => Boolean(x));

    // Prepend any curated channel classics seamlessly without duplicating IDs
    const seen = new Set(mapped.map((m) => m.identifier));
    const curated = (CURATED_FALLBACKS[channelId] || []).filter(
      (c) => !seen.has(c.identifier)
    );
    const merged = [...curated, ...mapped];

    if (merged.length > 0) {
      channelCache.set(cacheKey, merged);
    }
    return merged;
  } catch {
    return CURATED_FALLBACKS[channelId] || [];
  }
}

export async function searchNostalgiaArchive(
  query: string,
  rows = 24
): Promise<ArchiveBroadcastItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = `search:${trimmed.toLowerCase()}:${rows}`;
  if (channelCache.has(cacheKey)) {
    return channelCache.get(cacheKey)!;
  }

  const url = new URL('https://archive.org/advancedsearch.php');
  const escaped = trimmed.replace(/"/g, '');
  url.searchParams.set('q', `mediatype:movies AND (${escaped})`);
  url.searchParams.append('fl[]', 'identifier');
  url.searchParams.append('fl[]', 'title');
  url.searchParams.append('fl[]', 'description');
  url.searchParams.append('fl[]', 'year');
  url.searchParams.append('fl[]', 'date');
  url.searchParams.append('fl[]', 'creator');
  url.searchParams.append('fl[]', 'runtime');
  url.searchParams.append('fl[]', 'collection');
  url.searchParams.append('sort[]', 'downloads desc');
  url.searchParams.set('rows', String(rows));
  url.searchParams.set('page', '1');
  url.searchParams.set('output', 'json');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Archive Search ${res.status}`);
    const data = await res.json();
    const docs: Record<string, unknown>[] = data?.response?.docs || [];
    const mapped = docs
      .map((d) => mapArchiveDoc(d, 'search'))
      .filter((x): x is ArchiveBroadcastItem => Boolean(x));

    if (mapped.length > 0) {
      channelCache.set(cacheKey, mapped);
    }
    return mapped;
  } catch {
    return [];
  }
}

interface ArchiveFileEntry {
  name?: string;
  format?: string;
  size?: string | number;
  height?: string | number;
}

/**
 * Resolves the direct CORS-playable MP4 stream inside Internet Archive metadata
 * so videos play directly inside the CRT TV glass screen with <video>, plus embed fallback.
 */
export async function resolveArchiveStream(
  identifier: string
): Promise<{ mp4Url: string | null; embedUrl: string }> {
  if (streamCache.has(identifier)) {
    return streamCache.get(identifier)!;
  }

  const embedUrl = `https://archive.org/embed/${encodeURIComponent(identifier)}?autoplay=1`;

  try {
    const res = await fetch(
      `https://archive.org/metadata/${encodeURIComponent(identifier)}/files`
    );
    if (!res.ok) {
      const fallback = { mp4Url: null, embedUrl };
      streamCache.set(identifier, fallback);
      return fallback;
    }

    const data = await res.json();
    const files: ArchiveFileEntry[] = Array.isArray(data?.result) ? data.result : [];

    // Filter playable MP4s, preferring fast-streaming 480p–720p derivatives under ~600MB
    const mp4Candidates = files.filter((f) => {
      const name = String(f.name || '').toLowerCase();
      const fmt = String(f.format || '').toLowerCase();
      return (
        name.endsWith('.mp4') ||
        fmt.includes('mpeg4') ||
        fmt.includes('h.264')
      );
    });

    mp4Candidates.sort((a, b) => {
      const sa = Number(a.size || 0);
      const sb = Number(b.size || 0);
      const prefA = sa > 0 && sa < 450_000_000 ? 0 : 1;
      const prefB = sb > 0 && sb < 450_000_000 ? 0 : 1;
      if (prefA !== prefB) return prefA - prefB;
      return sa - sb;
    });

    const chosen = mp4Candidates[0]?.name;
    const mp4Url = chosen
      ? `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURI(chosen)}`
      : null;

    const result = { mp4Url, embedUrl };
    streamCache.set(identifier, result);
    return result;
  } catch {
    const fallback = { mp4Url: null, embedUrl };
    streamCache.set(identifier, fallback);
    return fallback;
  }
}
