import { ComicChapter, ComicSeries } from '../types';

export const INVINCIBLE_ARCHIVE_ITEM_ID = 'invincible-025';
export const ARCHIVE_INVINCIBLE_SERIES_ID = 'archive-invincible-025';
export const INVINCIBLE_ARCHIVE_METADATA_URL = `https://archive.org/metadata/${INVINCIBLE_ARCHIVE_ITEM_ID}`;
export const INVINCIBLE_ARCHIVE_FOLDER_URL = `https://archive.org/download/${INVINCIBLE_ARCHIVE_ITEM_ID}/Invincible/`;
export const INVINCIBLE_ARCHIVE_CACHE_KEY = 'arcadia_archive_invincible_025_v1';

const DEFAULT_INVINCIBLE_ARCHIVE_POSTER =
  'https://archive.org/download/invincible-025/Invincible/Invincible%20000.cbr/Invincible%200%20%2801%29.jpg';

const cbrPagesMemoryCache = new Map<string, string[]>();

export interface ArchiveCbrIssue {
  id: string;
  name: string;
  filename: string;
  issueNumber: number | null;
  issueLabel: string;
  title: string;
  downloadUrl: string;
  sizeBytes: number;
  sizeFormatted: string;
  pageCount?: number;
}

export interface ArchiveCollectionCache {
  itemId: string;
  folderUrl: string;
  fetchedAt: number;
  issues: ArchiveCbrIssue[];
}

export function isArchiveCbrUrl(url?: string | null): boolean {
  if (!url) return false;
  return /^https?:\/\/archive\.org\/download\/.+\.cbr(?:[/?#]|$)/i.test(url.trim());
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[idx]}`;
}

function encodeArchivePath(filePath: string): string {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function extractIssueNumber(filename: string): number | null {
  const endMatch = filename.match(/(?:^|\D)(\d+(?:\.\d+)?)(?=\.cbr$)/i);
  if (endMatch) {
    const n = Number(endMatch[1]);
    return Number.isFinite(n) ? n : null;
  }
  const anyMatch = filename.match(/(\d+)/);
  if (anyMatch) {
    const n = Number(anyMatch[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function formatIssueBadge(issueNumber: number | null, filename: string): string {
  if (issueNumber === null) {
    return filename.replace(/\.cbr$/i, '');
  }
  const intPart = Math.floor(issueNumber);
  const padded = String(intPart).padStart(3, '0');
  if (issueNumber !== intPart) {
    const frac = String(issueNumber).split('.')[1] || '';
    return `#${padded}.${frac}`;
  }
  return `#${padded}`;
}

export function getArchiveCollectionRangeLabel(issues: ArchiveCbrIssue[]): string {
  const numbered = issues.filter((i) => i.issueNumber !== null);
  if (numbered.length === 0) {
    return 'Invincible (#000–#025)';
  }
  const first = numbered[0];
  const last = numbered[numbered.length - 1];
  if (first.issueLabel === last.issueLabel) {
    return `Invincible (${first.issueLabel})`;
  }
  return `Invincible (${first.issueLabel}–${last.issueLabel})`;
}

export function parseArchiveInvincibleMetadata(rawJson: any): ArchiveCbrIssue[] {
  const rawFiles: any[] = Array.isArray(rawJson?.files) ? rawJson.files : [];

  const filtered = rawFiles.filter((file) => {
    if (!file || typeof file.name !== 'string') return false;
    return /^Invincible\/.+\.cbr$/i.test(file.name);
  });

  const mapped: ArchiveCbrIssue[] = filtered.map((file) => {
    const rawName: string = file.name;
    const filename = rawName.split('/').pop() || rawName;
    const issueNumber = extractIssueNumber(filename);
    const issueLabel = formatIssueBadge(issueNumber, filename);
    const sizeBytes = Number(file.size) || 0;
    const pageCountRaw = Number(file.filecount);
    const pageCount =
      Number.isFinite(pageCountRaw) && pageCountRaw > 0 ? pageCountRaw : undefined;

    return {
      id: rawName,
      name: rawName,
      filename,
      issueNumber,
      issueLabel,
      title: `Invincible ${issueLabel}`,
      downloadUrl: `https://archive.org/download/${INVINCIBLE_ARCHIVE_ITEM_ID}/${encodeArchivePath(rawName)}`,
      sizeBytes,
      sizeFormatted: formatBytes(sizeBytes),
      pageCount,
    };
  });

  mapped.sort((a, b) => {
    if (a.issueNumber !== null && b.issueNumber !== null && a.issueNumber !== b.issueNumber) {
      return a.issueNumber - b.issueNumber;
    }
    if (a.issueNumber !== null && b.issueNumber === null) return -1;
    if (a.issueNumber === null && b.issueNumber !== null) return 1;
    return a.filename.localeCompare(b.filename, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  return mapped;
}

export function parseArchiveCbrListingHtml(html: string, cbrDownloadUrl: string): string[] {
  const cleanBase = cbrDownloadUrl.replace(/\/+$/, '');
  const hrefRegex = /href\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  const seen = new Set<string>();
  const urls: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const rawHref = (match[1] || match[2] || '').trim();
    if (!rawHref) continue;
    const noHash = rawHref.split('#')[0];
    const cleanPath = noHash.split('?')[0];

    if (!/\.cbr(?:\/|%2f)/i.test(cleanPath) && !/^[^/].*\.(jpe?g|png|webp|avif|gif)$/i.test(cleanPath)) {
      continue;
    }
    if (!/\.(jpe?g|png|webp|avif|gif)$/i.test(cleanPath)) continue;
    if (
      /__MACOSX/i.test(cleanPath) ||
      /Thumbs\.db$/i.test(cleanPath) ||
      /\.DS_Store$/i.test(cleanPath) ||
      /\/images\/|apple-touch-icon/i.test(cleanPath)
    ) {
      continue;
    }

    let resolved = '';
    if (noHash.startsWith('//')) {
      resolved = `https:${noHash}`;
    } else if (/^https?:\/\//i.test(noHash)) {
      resolved = noHash;
    } else if (noHash.startsWith('/')) {
      resolved = `https://archive.org${noHash}`;
    } else {
      resolved = `${cleanBase}/${noHash.replace(/^\/+/, '')}`;
    }

    if (!seen.has(resolved)) {
      seen.add(resolved);
      urls.push(resolved);
    }
  }

  const getSortKey = (u: string): string => {
    try {
      const idx = u.toLowerCase().indexOf('.cbr/');
      const inner = idx >= 0 ? u.slice(idx + 5) : u;
      return decodeURIComponent(inner);
    } catch {
      return u;
    }
  };

  urls.sort((a, b) =>
    getSortKey(a).localeCompare(getSortKey(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );

  return urls;
}

export async function fetchArchiveCbrPages(cbrDownloadUrl: string): Promise<string[]> {
  const cleanUrl = cbrDownloadUrl.replace(/\/+$/, '');
  const cached = cbrPagesMemoryCache.get(cleanUrl);
  if (cached && cached.length > 0) {
    return cached;
  }

  const listingUrl = `${cleanUrl}/`;
  const candidates = [listingUrl, `/api/proxy?url=${encodeURIComponent(listingUrl)}`];
  let lastError = 'Unable to open .cbr archive contents on Internet Archive.';

  for (const url of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = `Archive returned HTTP ${res.status}`;
        continue;
      }
      const html = await res.text();
      const pages = parseArchiveCbrListingHtml(html, cleanUrl);
      if (pages.length > 0) {
        cbrPagesMemoryCache.set(cleanUrl, pages);
        return pages;
      }
      lastError = 'No comic page images were found inside this .cbr archive.';
    } catch (err: any) {
      lastError =
        err?.name === 'AbortError'
          ? 'Timed out while loading .cbr pages from Internet Archive.'
          : err?.message || lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

export function buildArchiveInvincibleSeries(
  issues: ArchiveCbrIssue[],
  existingSeries?: ComicSeries
): ComicSeries {
  const existingById = new Map<string, ComicChapter>();
  for (const ch of existingSeries?.chapters || []) {
    existingById.set(String(ch.id), ch);
  }

  const ascendingChapters: ComicChapter[] = issues.map((issue, idx) => {
    const prev = existingById.get(issue.id);
    return {
      id: issue.id,
      title: issue.title,
      readerUrl: issue.downloadUrl,
      pageCount: prev?.pageCount ?? issue.pageCount,
      pages: prev?.pages,
      remotePages: prev?.remotePages,
      hasLocalPages: prev?.hasLocalPages ?? false,
      thumb: prev?.thumb,
      posi: idx + 1,
    };
  });

  const firstThumb =
    ascendingChapters.find((c) => c.thumb)?.thumb ||
    ascendingChapters.find((c) => c.remotePages?.[0])?.remotePages?.[0] ||
    DEFAULT_INVINCIBLE_ARCHIVE_POSTER;

  return {
    id: ARCHIVE_INVINCIBLE_SERIES_ID,
    title: getArchiveCollectionRangeLabel(issues),
    year: 2003,
    publisher: 'Image Comics · Internet Archive',
    status: 'CBR Archive Collection',
    authors: ['Robert Kirkman'],
    artists: ['Cory Walker', 'Ryan Ottley'],
    genres: ['Superhero', 'Sci-Fi', 'Action', 'CBR Archive'],
    synopsis:
      'Complete Invincible issues from the Internet Archive invincible-025 collection. Every .cbr volume streams its pages directly inside the reader modal.',
    poster: existingSeries?.poster || firstThumb,
    remotePoster: existingSeries?.remotePoster || DEFAULT_INVINCIBLE_ARCHIVE_POSTER,
    sourceUrl: INVINCIBLE_ARCHIVE_FOLDER_URL,
    totalChapters: ascendingChapters.length,
    defaultChapterId: ascendingChapters[0]?.id,
    chapters: [...ascendingChapters].reverse(),
    imported: true,
  };
}

export function loadCachedArchiveInvincible(): ArchiveCollectionCache | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(INVINCIBLE_ARCHIVE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.issues) || parsed.issues.length === 0) {
      return null;
    }
    return parsed as ArchiveCollectionCache;
  } catch {
    return null;
  }
}

export function saveCachedArchiveInvincible(cache: ArchiveCollectionCache): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(INVINCIBLE_ARCHIVE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

export async function fetchArchiveInvincibleCollection(
  forceRefresh = false
): Promise<ArchiveCollectionCache> {
  const candidates = [
    INVINCIBLE_ARCHIVE_METADATA_URL,
    `/api/proxy?url=${encodeURIComponent(INVINCIBLE_ARCHIVE_METADATA_URL)}`,
  ];

  let lastError = 'Unable to reach Internet Archive metadata.';

  for (const url of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: forceRefresh ? 'no-store' : 'default',
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = `Internet Archive returned HTTP ${res.status}`;
        continue;
      }
      const json = await res.json();
      const issues = parseArchiveInvincibleMetadata(json);
      const cacheEntry: ArchiveCollectionCache = {
        itemId: INVINCIBLE_ARCHIVE_ITEM_ID,
        folderUrl: INVINCIBLE_ARCHIVE_FOLDER_URL,
        fetchedAt: Date.now(),
        issues,
      };
      if (issues.length > 0) {
        saveCachedArchiveInvincible(cacheEntry);
      }
      return cacheEntry;
    } catch (err: any) {
      lastError =
        err?.name === 'AbortError'
          ? 'Internet Archive request timed out'
          : err?.message || lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}
