import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Search,
  Star,
  Upload,
  ExternalLink,
  Layers,
  CheckCircle2,
  X,
  FileCode2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Globe,
  DownloadCloud,
  Loader2,
  Plus,
  ImagePlus,
  Zap,
  AlertCircle,
  Download,
  Folder,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ComicChapter, ComicSeries } from '../types';
import {
  getComicAssetUrl,
  mergeComicCatalogs,
  parseBatcaveHtml,
  resolveComicAssetCandidates,
  sortComicChaptersForReading,
} from '../utils/batcaveParser';
import {
  ARCHIVE_INVINCIBLE_SERIES_ID,
  ArchiveCbrIssue,
  ArchiveCollectionCache,
  INVINCIBLE_ARCHIVE_FOLDER_URL,
  buildArchiveInvincibleSeries,
  fetchArchiveCbrPages,
  fetchArchiveInvincibleCollection,
  getArchiveCollectionRangeLabel,
  isArchiveCbrUrl,
  loadCachedArchiveInvincible,
} from '../utils/archiveDownloads';
import { ComicReaderModal } from './ComicReaderModal';

interface ComicsSectionProps {
  searchQuery?: string;
}

const COMICS_IDB_NAME = 'arcadia_comics_vault_db';
const COMICS_IDB_VERSION = 1;
const COMICS_IDB_STORE = 'catalog';
const COMICS_IDB_KEY = 'imported_series_v1';
const LEGACY_IMPORTED_COMICS_KEY = 'arcadia_imported_comics_v1';
const PROGRESS_STORAGE_KEY = 'arcadia_comic_progress_v1';
const FAV_CHAPTERS_KEY = 'arcadia_comic_fav_chapters_v1';
const SERIES_PER_PAGE = 50;

function cleanupLegacyHosterStorage(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('arcadia_hoster_catalog_meta_v1');
      localStorage.removeItem('arcadia_comic_hoster_url_v1');
    }
  } catch {}
}

function openComicsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(COMICS_IDB_NAME, COMICS_IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(COMICS_IDB_STORE)) {
        db.createObjectStore(COMICS_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open comics IndexedDB'));
  });
}

async function loadImportedFromIdb(): Promise<ComicSeries[]> {
  try {
    const db = await openComicsDb();
    const idbData = await new Promise<ComicSeries[]>((resolve, reject) => {
      const tx = db.transaction(COMICS_IDB_STORE, 'readonly');
      const store = tx.objectStore(COMICS_IDB_STORE);
      const req = store.get(COMICS_IDB_KEY);
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? req.result : []);
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (idbData.length > 0) return idbData;
  } catch {}

  try {
    const lsRaw = localStorage.getItem(LEGACY_IMPORTED_COMICS_KEY);
    if (lsRaw) {
      const parsed = JSON.parse(lsRaw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

async function saveImportedToIdb(catalog: ComicSeries[]): Promise<void> {
  try {
    const db = await openComicsDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(COMICS_IDB_STORE, 'readwrite');
      const store = tx.objectStore(COMICS_IDB_STORE);
      store.put(catalog, COMICS_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    try {
      localStorage.setItem(LEGACY_IMPORTED_COMICS_KEY, JSON.stringify(catalog));
    } catch {}
  }
}

async function clearImportedFromIdb(): Promise<void> {
  try {
    const db = await openComicsDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(COMICS_IDB_STORE, 'readwrite');
      const store = tx.objectStore(COMICS_IDB_STORE);
      store.delete(COMICS_IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {}
  try {
    localStorage.removeItem(LEGACY_IMPORTED_COMICS_KEY);
  } catch {}
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function looksLikeUrl(input: string): boolean {
  const t = input.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t) || /^\/\//.test(t)) return true;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$|\?)/i.test(t) && !/\s/.test(t)) return true;
  return false;
}

function parseUrlsFromText(raw: string): string[] {
  return raw
    .split(/[\n,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('http://') || s.startsWith('https://') ? s : looksLikeUrl(s) ? `https://${s}` : ''))
    .filter(Boolean);
}

function getNextIssueNumber(series?: ComicSeries): number {
  if (!series || series.chapters.length === 0) return 1;
  let maxNum = 0;
  for (const ch of series.chapters) {
    const m = ch.title.match(/#(\d+)/) || ch.title.match(/\b(\d+)\s*$/);
    if (m) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n < 5000 && n > maxNum) maxNum = n;
    }
  }
  return maxNum > 0 ? maxNum + 1 : series.chapters.length + 1;
}

function getMaxPosi(series?: ComicSeries): number {
  if (!series || series.chapters.length === 0) return 0;
  return series.chapters.reduce((max, ch) => (typeof ch.posi === 'number' && ch.posi > max ? ch.posi : max), 0);
}

/**
 * Fetches raw HTML from a batcave.biz URL through available proxy endpoints
 * to bypass browser CORS restrictions.
 */
async function fetchBatcavePageHtml(targetUrl: string): Promise<string> {
  const normalizedUrl = targetUrl.startsWith('http')
    ? targetUrl
    : `https://batcave.biz/${targetUrl.replace(/^\/+/, '')}`;

  const proxyCandidates = [
    getComicAssetUrl(normalizedUrl),
    `/api/proxy?url=${encodeURIComponent(normalizedUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(normalizedUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(normalizedUrl)}`,
  ].filter((u, idx, arr) => Boolean(u) && u !== normalizedUrl && arr.indexOf(u) === idx);

  let lastError = 'Unable to reach BatCave through proxy.';

  for (const proxyUrl of proxyCandidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        lastError = `Proxy returned HTTP ${res.status}`;
        continue;
      }

      const html = await res.text();
      if (html && html.includes('<') && html.length > 500) {
        return html;
      }
    } catch (err: any) {
      lastError = err?.name === 'AbortError' ? 'Request timed out' : err?.message || lastError;
    }
  }

  throw new Error(
    `${lastError}. If BatCave blocks automated requests, save the page as HTML from your browser menu and tap Pick Files or Batch Importer.`
  );
}

interface ExtractedSourceResponse {
  success: boolean;
  type?: 'feed' | 'reader' | 'catalog';
  title?: string;
  sourceUrl?: string;
  items?: Array<{ title: string; url: string; poster: string }>;
  images?: string[];
  error?: string;
}

async function fetchGenericSource(targetUrl: string): Promise<ExtractedSourceResponse> {
  const res = await fetch(`/api/extract-source?url=${encodeURIComponent(targetUrl)}`);
  const data = (await res.json()) as ExtractedSourceResponse;
  return data;
}

function createFallbackComicPoster(title: string, publisher: string): string {
  const safeTitle = (title || 'COMIC SERIES').toUpperCase().slice(0, 26);
  const safePub = (publisher || 'ARCHIVE').toUpperCase().slice(0, 22);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
    <defs>
      <linearGradient id="cbBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#18181b"/>
        <stop offset="100%" stop-color="#09090b"/>
      </linearGradient>
    </defs>
    <rect width="400" height="560" fill="url(#cbBg)"/>
    <rect x="16" y="16" width="368" height="528" fill="none" stroke="#f5c518" stroke-width="2" rx="8"/>
    <rect x="16" y="16" width="368" height="44" fill="#f5c518" rx="6"/>
    <text x="200" y="44" fill="#09090b" font-family="system-ui, sans-serif" font-size="14" font-weight="900" text-anchor="middle" letter-spacing="2">${safePub}</text>
    <text x="200" y="275" fill="#fafafa" font-family="system-ui, sans-serif" font-size="22" font-weight="900" text-anchor="middle">${safeTitle}</text>
    <text x="200" y="310" fill="#a1a1aa" font-family="monospace" font-size="12" text-anchor="middle">COLLECTOR EDITION ARCHIVE</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const ProxyThumb: React.FC<{
  src?: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}> = ({ src, fallbackSrc, alt, className = '', fallback = null }) => {
  const candidates = useMemo(
    () => resolveComicAssetCandidates(src, fallbackSrc),
    [src, fallbackSrc]
  );
  const candidatesKey = candidates.join('|');
  const [stage, setStage] = useState<number>(0);
  const activeUrl = candidates[stage] || '';

  useEffect(() => {
    setStage(0);
  }, [candidatesKey]);

  if (!activeUrl || stage >= candidates.length) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={activeUrl}
      alt={alt}
      onError={() => {
        setStage((prev) => prev + 1);
      }}
      referrerPolicy="no-referrer"
      loading="lazy"
      className={className}
    />
  );
};

const ComicCoverImage: React.FC<{
  series: ComicSeries;
  className?: string;
}> = ({ series, className = '' }) => {
  const fallbackSvg = useMemo(
    () => createFallbackComicPoster(series.title, series.publisher),
    [series.title, series.publisher]
  );
  const chapterFallbackArt = useMemo(() => {
    const firstCh = series.chapters.find(
      (c) => c.thumb || c.pages?.[0] || c.remotePages?.[0]
    );
    return firstCh?.thumb || firstCh?.pages?.[0] || firstCh?.remotePages?.[0] || '';
  }, [series.chapters]);

  const candidates = useMemo(() => {
    const primary = resolveComicAssetCandidates(series.poster, series.remotePoster);
    const secondary = chapterFallbackArt
      ? resolveComicAssetCandidates(chapterFallbackArt)
      : [];
    return Array.from(new Set([...primary, ...secondary, fallbackSvg]));
  }, [series.poster, series.remotePoster, chapterFallbackArt, fallbackSvg]);

  const candidatesKey = candidates.join('|');
  const [stage, setStage] = useState<number>(0);

  useEffect(() => {
    setStage(0);
  }, [series.id, candidatesKey]);

  const activeSrc = candidates[Math.min(stage, candidates.length - 1)] || fallbackSvg;

  return (
    <img
      src={activeSrc}
      alt={series.title}
      onError={() => {
        if (stage + 1 < candidates.length) {
          setStage((prev) => prev + 1);
        }
      }}
      referrerPolicy="no-referrer"
      className={className}
      loading="lazy"
    />
  );
};

export const ComicsSection: React.FC<ComicsSectionProps> = ({ searchQuery = '' }) => {
  const [baseCatalog, setBaseCatalog] = useState<ComicSeries[]>([]);
  const [importedCatalog, setImportedCatalog] = useState<ComicSeries[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('batcave-6975');
  const [seriesPage, setSeriesPage] = useState<number>(1);

  // Issue Vault controls
  const [issueSearch, setIssueSearch] = useState<string>('');
  const [issueFilter, setIssueFilter] = useState<'all' | 'ready' | 'bookmarked'>('all');

  // Reader modal state (tracks seriesId so live updates render immediately)
  const [readerState, setReaderState] = useState<{
    seriesId: string;
    chapterId?: number | string;
    fallbackSeries: ComicSeries;
  } | null>(null);

  // Fast Series Bar + Optional Inline New Series Details
  const [quickSeriesInput, setQuickSeriesInput] = useState<string>('');
  const [showNewSeriesDetails, setShowNewSeriesDetails] = useState<boolean>(false);
  const [newSeriesPublisher, setNewSeriesPublisher] = useState<string>('');
  const [newSeriesYear, setNewSeriesYear] = useState<string>('');
  const [newSeriesCoverUrl, setNewSeriesCoverUrl] = useState<string>('');
  const [newSeriesCoverFileName, setNewSeriesCoverFileName] = useState<string>('');
  const [newSeriesCoverPreview, setNewSeriesCoverPreview] = useState<string>('');
  const [quickSearchResults, setQuickSearchResults] = useState<ComicSeries[]>([]);
  const [isSearchingBatcave, setIsSearchingBatcave] = useState<boolean>(false);
  const [quickBanner, setQuickBanner] = useState<{ kind: 'info' | 'error'; text: string } | null>(
    null
  );

  // Fast Inline Issue Adder (inside active series Issue Directory)
  const [showQuickAddIssue, setShowQuickAddIssue] = useState<boolean>(false);
  const [quickIssueTitle, setQuickIssueTitle] = useState<string>('');
  const [quickIssueInput, setQuickIssueInput] = useState<string>('');
  const [openReaderOnAdd, setOpenReaderOnAdd] = useState<boolean>(true);
  const [isAddingIssue, setIsAddingIssue] = useState<boolean>(false);

  // On-demand chapter fetching & batch unlock
  const [fetchingChapterKey, setFetchingChapterKey] = useState<string | null>(null);
  const [isBatchUnlocking, setIsBatchUnlocking] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(null);

  // BatCave URL & HTML Batch Importer Modal
  const [showImporter, setShowImporter] = useState<boolean>(false);
  const [batcaveUrlInput, setBatcaveUrlInput] = useState<string>('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importingRelatedId, setImportingRelatedId] = useState<string | number | null>(null);
  const [isDraggingOverVault, setIsDraggingOverVault] = useState<boolean>(false);

  const importedCatalogRef = useRef<ComicSeries[]>([]);
  const cancelUnlockRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const quickFilesRef = useRef<HTMLInputElement | null>(null);
  const quickIssueImagesRef = useRef<HTMLInputElement | null>(null);
  const quickCoverFileRef = useRef<HTMLInputElement | null>(null);
  const heroTopRef = useRef<HTMLElement | null>(null);
  const downloadsSectionRef = useRef<HTMLDivElement | null>(null);

  // Internet Archive Invincible (#000–#025) Downloads Collection State
  const [archiveDownloads, setArchiveDownloads] = useState<ArchiveCollectionCache | null>(() =>
    loadCachedArchiveInvincible()
  );
  const [isLoadingDownloads, setIsLoadingDownloads] = useState<boolean>(false);
  const [downloadsError, setDownloadsError] = useState<string | null>(null);
  const [isDownloadsExpanded, setIsDownloadsExpanded] = useState<boolean>(true);
  const [downloadsFilter, setDownloadsFilter] = useState<string>('');

  // Reading progress & bookmarked issues tracking
  const [progressMap, setProgressMap] = useState<
    Record<string, { page: number; total: number }>
  >({});
  const [favChapters, setFavChapters] = useState<Record<string, boolean>>({});

  const refreshLocalTracking = () => {
    try {
      const pRaw = localStorage.getItem(PROGRESS_STORAGE_KEY);
      setProgressMap(pRaw ? JSON.parse(pRaw) : {});
      const fRaw = localStorage.getItem(FAV_CHAPTERS_KEY);
      setFavChapters(fRaw ? JSON.parse(fRaw) : {});
    } catch {}
  };

  const syncArchiveIssuesToCatalog = async (
    issues: ArchiveCbrIssue[],
    skipIdbWrite = false
  ): Promise<ComicSeries | null> => {
    if (!issues || issues.length === 0) return null;
    const existing = importedCatalogRef.current.find(
      (s) => s.id === ARCHIVE_INVINCIBLE_SERIES_ID
    );
    const archiveSeries = buildArchiveInvincibleSeries(issues, existing);
    const updated = mergeComicCatalogs(importedCatalogRef.current, [archiveSeries]);
    importedCatalogRef.current = updated;
    setImportedCatalog(updated);
    if (!skipIdbWrite) {
      await saveImportedToIdb(updated);
    }
    return updated.find((s) => s.id === ARCHIVE_INVINCIBLE_SERIES_ID) || archiveSeries;
  };

  const handleRefreshArchiveDownloads = async (forceRefresh = true, skipInitialSync = false) => {
    setIsLoadingDownloads(true);
    setDownloadsError(null);
    try {
      const fresh = await fetchArchiveInvincibleCollection(forceRefresh);
      setArchiveDownloads(fresh);
      if (!skipInitialSync && fresh.issues.length > 0) {
        await syncArchiveIssuesToCatalog(fresh.issues);
      }
      return fresh;
    } catch (err: any) {
      setDownloadsError(
        err?.message || 'Unable to reach Internet Archive metadata for invincible-025.'
      );
      return null;
    } finally {
      setIsLoadingDownloads(false);
    }
  };

  useEffect(() => {
    cleanupLegacyHosterStorage();
    refreshLocalTracking();

    Promise.all([
      fetch('/comics/comics.json')
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => []),
      loadImportedFromIdb(),
      handleRefreshArchiveDownloads(false, true),
    ])
      .then(async ([baseData, savedImported, freshArchive]) => {
        const validBase = Array.isArray(baseData) ? baseData : [];
        let validImported = Array.isArray(savedImported) ? savedImported : [];

        const archiveIssues =
          freshArchive?.issues?.length
            ? freshArchive.issues
            : loadCachedArchiveInvincible()?.issues || [];

        if (archiveIssues.length > 0) {
          const existingArchive = validImported.find(
            (s) => s.id === ARCHIVE_INVINCIBLE_SERIES_ID
          );
          const archiveSeries = buildArchiveInvincibleSeries(archiveIssues, existingArchive);
          validImported = mergeComicCatalogs(validImported, [archiveSeries]);
          saveImportedToIdb(validImported).catch(() => {});
        }

        setBaseCatalog(validBase);
        importedCatalogRef.current = validImported;
        setImportedCatalog(validImported);

        const preferredImported =
          validImported.find((s) => s.id !== ARCHIVE_INVINCIBLE_SERIES_ID) || validImported[0];
        if (preferredImported?.id) {
          setSelectedSeriesId(preferredImported.id);
        } else if (validBase[0]?.id) {
          setSelectedSeriesId(validBase[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const allSeries = useMemo(
    () => mergeComicCatalogs(baseCatalog, importedCatalog),
    [baseCatalog, importedCatalog]
  );

  const filteredSeries = useMemo(() => {
    if (!searchQuery.trim()) return allSeries;
    const q = searchQuery.toLowerCase();
    return allSeries.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.publisher.toLowerCase().includes(q) ||
        s.authors.some((a) => a.toLowerCase().includes(q)) ||
        s.genres.some((g) => g.toLowerCase().includes(q))
    );
  }, [allSeries, searchQuery]);

  const totalSeriesPages = Math.max(1, Math.ceil(filteredSeries.length / SERIES_PER_PAGE));

  useEffect(() => {
    if (seriesPage > totalSeriesPages) {
      setSeriesPage(totalSeriesPages);
    }
  }, [seriesPage, totalSeriesPages]);

  const paginatedSeries = useMemo(() => {
    const start = (seriesPage - 1) * SERIES_PER_PAGE;
    return filteredSeries.slice(start, start + SERIES_PER_PAGE);
  }, [filteredSeries, seriesPage]);

  useEffect(() => {
    setSeriesPage(1);
  }, [searchQuery]);

  const activeSeries: ComicSeries | undefined = useMemo(
    () =>
      allSeries.find((s) => s.id === selectedSeriesId) ||
      filteredSeries[0] ||
      allSeries[0],
    [allSeries, filteredSeries, selectedSeriesId]
  );

  const activeReaderSeries: ComicSeries | undefined = useMemo(() => {
    if (!readerState) return undefined;
    return allSeries.find((s) => s.id === readerState.seriesId) || readerState.fallbackSeries;
  }, [readerState, allSeries]);

  const orderedIssues = useMemo(() => {
    if (!activeSeries) return [];
    return sortComicChaptersForReading(activeSeries.chapters);
  }, [activeSeries]);

  const filteredIssues = useMemo(() => {
    if (!activeSeries) return [];
    return orderedIssues.filter((ch) => {
      if (issueFilter === 'ready' && !ch.hasLocalPages) return false;
      if (issueFilter === 'bookmarked' && !favChapters[`${activeSeries.id}:${ch.id}`]) {
        return false;
      }
      if (issueSearch.trim()) {
        return ch.title.toLowerCase().includes(issueSearch.trim().toLowerCase());
      }
      return true;
    });
  }, [orderedIssues, activeSeries, issueFilter, favChapters, issueSearch]);

  const uncachedFetchableIssues = useMemo(
    () => orderedIssues.filter((ch) => !ch.hasLocalPages && Boolean(ch.readerUrl)),
    [orderedIssues]
  );

  const readyChapter = useMemo(
    () =>
      orderedIssues.find((ch) => ch.hasLocalPages) ||
      orderedIssues.find((ch) => ch.id === activeSeries?.defaultChapterId) ||
      orderedIssues[0],
    [orderedIssues, activeSeries]
  );

  const persistDeltaSeries = async (deltaItems: ComicSeries[], skipIdbWrite = false) => {
    const updated = mergeComicCatalogs(importedCatalogRef.current, deltaItems);
    importedCatalogRef.current = updated;
    setImportedCatalog(updated);
    if (!skipIdbWrite) {
      await saveImportedToIdb(updated);
    }
    return updated;
  };

  const toggleFavIssue = (seriesId: string, chapterId: number | string) => {
    const key = `${seriesId}:${chapterId}`;
    setFavChapters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(FAV_CHAPTERS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  /**
   * Adds a new issue directly onto a target series (existing or newly created) in IndexedDB.
   */
  const appendChapterToSeries = async (
    targetSeries: ComicSeries,
    chapter: ComicChapter,
    openImmediately = openReaderOnAdd
  ) => {
    const delta: ComicSeries = {
      ...targetSeries,
      poster: targetSeries.poster || chapter.pages?.[0] || chapter.remotePages?.[0] || '',
      chapters: [chapter],
      totalChapters: targetSeries.chapters.length + 1,
      defaultChapterId: targetSeries.defaultChapterId || chapter.id,
      imported: true,
    };
    await persistDeltaSeries([delta]);
    setSelectedSeriesId(targetSeries.id);
    if (openImmediately) {
      setReaderState({
        seriesId: targetSeries.id,
        chapterId: chapter.id,
        fallbackSeries: { ...targetSeries, chapters: [...targetSeries.chapters, chapter] },
      });
    }
  };

  /**
   * Creates a new custom series in 1 step from a title + optional metadata and stores it in IndexedDB.
   */
  const handleCreateCustomSeries = async (rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title) {
      setQuickBanner({ kind: 'error', text: 'Enter a series title to create it.' });
      return;
    }

    const parsedYear = Number(newSeriesYear.trim());
    const newId = `custom-series-${Date.now()}`;
    const coverUrlInput = newSeriesCoverUrl.trim();
    const resolvedPoster = newSeriesCoverPreview || coverUrlInput;
    const finalSeries: ComicSeries = {
      id: newId,
      title,
      year: !Number.isNaN(parsedYear) && parsedYear > 1900 && parsedYear < 2100 ? parsedYear : undefined,
      publisher: newSeriesPublisher.trim() || 'Personal Vault',
      status: 'Ongoing',
      authors: [],
      artists: [],
      genres: ['Comics'],
      synopsis: `Custom comic series in local IndexedDB vault (${title}). Add issues below by pasting URLs or picking page images.`,
      poster: resolvedPoster,
      remotePoster: coverUrlInput || undefined,
      totalChapters: 0,
      chapters: [],
      imported: true,
    };

    await persistDeltaSeries([finalSeries]);
    setSelectedSeriesId(finalSeries.id);
    setQuickSeriesInput('');
    setNewSeriesPublisher('');
    setNewSeriesYear('');
    setNewSeriesCoverUrl('');
    setNewSeriesCoverFileName('');
    setNewSeriesCoverPreview('');
    setShowNewSeriesDetails(false);
    setQuickSearchResults([]);
    setShowQuickAddIssue(true);
    setQuickBanner({
      kind: 'info',
      text: `Created "${title}" in local vault. Drop page images or paste an issue URL below to add Issue #1.`,
    });
  };

  /**
   * Imports any URL: BatCave URLs via BatCave proxy parser, or any external comic/gallery/RSS URL via /api/extract-source.
   */
  const importFromAnyUrl = async (
    rawInput: string,
    options?: { attachToSeries?: ComicSeries; customIssueTitle?: string }
  ): Promise<{ seriesCount: number; unlockedCount: number; message: string }> => {
    const urls = parseUrlsFromText(rawInput);
    if (urls.length === 0) {
      throw new Error('Please enter a valid URL.');
    }

    const batcaveUrls = urls.filter((u) => /batcave\.biz/i.test(u));
    const externalUrls = urls.filter((u) => !/batcave\.biz/i.test(u));

    const parsedItems: ComicSeries[] = [];
    let unlockedIssuesCount = 0;

    for (let i = 0; i < batcaveUrls.length; i++) {
      const url = batcaveUrls[i];
      const matchNewsId = url.match(/\/(\d+)-/);
      const matchedSeries = baseCatalog.find((s) => {
        if (matchNewsId && s.newsId && Number(s.newsId) === Number(matchNewsId[1])) return true;
        if (s.sourceUrl && s.sourceUrl.toLowerCase() === url.toLowerCase()) return true;
        if (/invincible/i.test(url) && /invincible/i.test(s.title)) return true;
        return false;
      });

      if (matchedSeries) {
        parsedItems.push(matchedSeries);
        unlockedIssuesCount += matchedSeries.chapters.filter((c) => c.hasLocalPages).length;
      } else {
        const html = await fetchBatcavePageHtml(url);
        const extracted = parseBatcaveHtml(html);
        parsedItems.push(...extracted);
        unlockedIssuesCount += extracted.reduce(
          (sum, s) => sum + s.chapters.filter((c) => c.hasLocalPages).length,
          0
        );
      }
    }

    for (const extUrl of externalUrls) {
      const extracted = await fetchGenericSource(extUrl);
      if (!extracted.success) {
        throw new Error(extracted.error || `Unable to extract content from ${extUrl}`);
      }

      if (extracted.type === 'reader' && extracted.images && extracted.images.length > 0) {
        const hostTitle = (() => {
          try {
            return new URL(extUrl).hostname;
          } catch {
            return 'Web Comic';
          }
        })();
        const target = options?.attachToSeries;
        const nextNum = getNextIssueNumber(target);
        const chapterTitle =
          options?.customIssueTitle?.trim() ||
          (target ? `${target.title} Issue #${nextNum}` : extracted.title || `Issue #${nextNum}`);

        const chapter: ComicChapter = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          title: chapterTitle,
          readerUrl: extUrl,
          pageCount: extracted.images.length,
          posi: getMaxPosi(target) + 1,
          thumb: extracted.images[0],
          remotePages: extracted.images,
          hasLocalPages: true,
        };

        if (target) {
          parsedItems.push({
            ...target,
            poster: target.poster || extracted.images[0],
            chapters: [chapter],
            totalChapters: target.chapters.length + 1,
            imported: true,
          });
        } else {
          parsedItems.push({
            id: `web-${Date.now()}`,
            title: extracted.title || hostTitle,
            publisher: hostTitle,
            authors: [],
            artists: [],
            genres: ['Web Comic'],
            synopsis: `Imported directly from ${extUrl}.`,
            poster: extracted.images[0],
            remotePoster: extracted.images[0],
            sourceUrl: extUrl,
            totalChapters: 1,
            defaultChapterId: chapter.id,
            chapters: [chapter],
            imported: true,
          });
        }
        unlockedIssuesCount += 1;
      } else if (extracted.items && extracted.items.length > 0) {
        const hostTitle = (() => {
          try {
            return new URL(extUrl).hostname;
          } catch {
            return 'Web Archive';
          }
        })();
        const chapters: ComicChapter[] = extracted.items.map((item, idx) => ({
          id: Date.now() + idx,
          title: item.title || `Issue #${idx + 1}`,
          readerUrl: item.url,
          posi: idx + 1,
          thumb: item.poster || undefined,
          hasLocalPages: false,
        }));
        parsedItems.push({
          id: `web-${Date.now()}`,
          title: extracted.title || hostTitle,
          publisher: hostTitle,
          authors: [],
          artists: [],
          genres: ['Comics'],
          synopsis: `Indexed ${chapters.length} entries from ${extUrl}.`,
          poster: extracted.items.find((i) => i.poster)?.poster || '',
          sourceUrl: extUrl,
          totalChapters: chapters.length,
          defaultChapterId: chapters[0]?.id,
          chapters: [...chapters].reverse(),
          imported: true,
        });
      }
    }

    if (parsedItems.length === 0) {
      throw new Error('Connected to the URL, but no comic chapters or pages were detected.');
    }

    await persistDeltaSeries(parsedItems);
    setSelectedSeriesId(parsedItems[0].id);

    const uniqueSeriesCount = new Set(parsedItems.map((p) => p.id)).size;
    return {
      seriesCount: uniqueSeriesCount,
      unlockedCount: unlockedIssuesCount,
      message: `Added ${uniqueSeriesCount} series${
        unlockedIssuesCount > 0
          ? ` and unlocked ${unlockedIssuesCount} readable issue${
              unlockedIssuesCount === 1 ? '' : 's'
            }`
          : ''
      }.`,
    };
  };

  /**
   * Smart Quick Bar submit: imports URL immediately, or creates a series immediately from a title.
   */
  const handleQuickSeriesSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = quickSeriesInput.trim();
    if (!raw) {
      setShowNewSeriesDetails((v) => !v);
      return;
    }

    if (looksLikeUrl(raw)) {
      setIsImporting(true);
      setQuickBanner({ kind: 'info', text: 'Fetching comic metadata & pages...' });
      try {
        const res = await importFromAnyUrl(raw);
        setQuickSeriesInput('');
        setQuickSearchResults([]);
        setQuickBanner({ kind: 'info', text: res.message });
      } catch (err: any) {
        setQuickBanner({
          kind: 'error',
          text: err?.message || 'Unable to fetch that URL. You can still drop saved HTML or images.',
        });
      } finally {
        setIsImporting(false);
      }
    } else {
      await handleCreateCustomSeries(raw);
    }
  };

  /**
   * Searches BatCave.biz live by title and surfaces clickable 1-click import cards.
   */
  const handleSearchBatcave = async () => {
    const q = quickSeriesInput.trim();
    if (!q || looksLikeUrl(q)) return;

    setIsSearchingBatcave(true);
    setQuickBanner({ kind: 'info', text: `Searching BatCave.biz for "${q}"...` });
    try {
      const searchUrl = `https://batcave.biz/index.php?do=search&subaction=search&story=${encodeURIComponent(q)}`;
      const html = await fetchBatcavePageHtml(searchUrl);
      const found = parseBatcaveHtml(html);
      setQuickSearchResults(found.slice(0, 12));
      if (found.length === 0) {
        setQuickBanner({
          kind: 'info',
          text: `No BatCave results parsed for "${q}". Click "+ Create Series" to add it immediately.`,
        });
      } else {
        setQuickBanner({
          kind: 'info',
          text: `Found ${found.length} BatCave matches for "${q}". Click any card to add it in 1 click.`,
        });
      }
    } catch (err: any) {
      setQuickSearchResults([]);
      setQuickBanner({
        kind: 'error',
        text: err?.message || 'BatCave search unavailable right now. Use "+ Create Series" instead.',
      });
    } finally {
      setIsSearchingBatcave(false);
    }
  };

  /**
   * One-click fetch for any un-cached issue row or from inside ComicReaderModal.
   * Saves fetched issue URLs directly into IndexedDB.
   */
  const fetchChapterPages = async (
    series: ComicSeries,
    chapter: ComicChapter,
    skipIdbWrite = false
  ): Promise<boolean> => {
    if (!chapter.readerUrl) return false;
    const key = `${series.id}:${chapter.id}`;
    setFetchingChapterKey(key);
    if (!skipIdbWrite) setQuickBanner(null);

    try {
      if (isArchiveCbrUrl(chapter.readerUrl)) {
        const pageUrls = await fetchArchiveCbrPages(chapter.readerUrl);
        if (pageUrls.length > 0) {
          const updatedChapter: ComicChapter = {
            ...chapter,
            pageCount: pageUrls.length,
            thumb: chapter.thumb || pageUrls[0],
            remotePages: pageUrls,
            hasLocalPages: true,
          };
          const draftSeries: ComicSeries = {
            ...series,
            poster: series.poster || pageUrls[0],
            chapters: [updatedChapter],
            imported: true,
          };
          await persistDeltaSeries([draftSeries], skipIdbWrite);
          return true;
        }
        return false;
      } else if (/batcave\.biz/i.test(chapter.readerUrl)) {
        const html = await fetchBatcavePageHtml(chapter.readerUrl);
        const extracted = parseBatcaveHtml(html, chapter.readerUrl);
        if (extracted.length > 0 && extracted.some((s) => s.chapters.some((c) => c.hasLocalPages))) {
          await persistDeltaSeries(extracted, skipIdbWrite);
          return true;
        }
        return false;
      } else {
        const extracted = await fetchGenericSource(chapter.readerUrl);
        if (extracted.success && extracted.images && extracted.images.length > 0) {
          const updatedChapter: ComicChapter = {
            ...chapter,
            pageCount: extracted.images.length,
            thumb: chapter.thumb || extracted.images[0],
            remotePages: extracted.images,
            hasLocalPages: true,
          };
          const draftSeries: ComicSeries = {
            ...series,
            chapters: [updatedChapter],
            imported: true,
          };
          await persistDeltaSeries([draftSeries], skipIdbWrite);
          return true;
        }
        return false;
      }
    } catch (err: any) {
      if (!skipIdbWrite) {
        setQuickBanner({
          kind: 'error',
          text: err?.message || `Failed to fetch ${chapter.title}.`,
        });
      }
      return false;
    } finally {
      setFetchingChapterKey(null);
    }
  };

  /**
   * Opens a chapter directly, auto-fetching pages first if it's an un-cached issue with a readerUrl.
   */
  const handleOpenOrFetchIssue = async (series: ComicSeries, ch: ComicChapter) => {
    if (ch.hasLocalPages || !ch.readerUrl) {
      setReaderState({ seriesId: series.id, chapterId: ch.id, fallbackSeries: series });
      return;
    }

    await fetchChapterPages(series, ch);
    const updatedSeries =
      importedCatalogRef.current.find((s) => s.id === series.id) || series;
    setReaderState({ seriesId: series.id, chapterId: ch.id, fallbackSeries: updatedSeries });
  };

  const handleReadArchiveCbrIssue = async (issue: ArchiveCbrIssue) => {
    const issues = archiveDownloads?.issues || [issue];
    let targetSeries =
      allSeries.find((s) => s.id === ARCHIVE_INVINCIBLE_SERIES_ID) ||
      buildArchiveInvincibleSeries(issues);

    if (!allSeries.some((s) => s.id === ARCHIVE_INVINCIBLE_SERIES_ID)) {
      const synced = await syncArchiveIssuesToCatalog(issues);
      if (synced) targetSeries = synced;
    }

    const targetChapter =
      targetSeries.chapters.find((c) => String(c.id) === String(issue.id)) || {
        id: issue.id,
        title: issue.title,
        readerUrl: issue.downloadUrl,
        pageCount: issue.pageCount,
        hasLocalPages: false,
      };

    setSelectedSeriesId(targetSeries.id);
    await handleOpenOrFetchIssue(targetSeries, targetChapter);
  };

  /**
   * Batch-unlocks N (or all) un-cached issues on the active series in 1 click, with Stop support.
   */
  const handleUnlockNextBatch = async (limit?: number) => {
    if (!activeSeries || isBatchUnlocking) return;
    const targets =
      typeof limit === 'number'
        ? uncachedFetchableIssues.slice(0, limit)
        : [...uncachedFetchableIssues];
    if (targets.length === 0) return;

    cancelUnlockRef.current = false;
    setIsBatchUnlocking(true);
    setBatchProgress({ done: 0, total: targets.length });
    let unlocked = 0;

    try {
      for (let i = 0; i < targets.length; i++) {
        if (cancelUnlockRef.current) break;
        setBatchProgress({ done: i + 1, total: targets.length });
        setQuickBanner({
          kind: 'info',
          text: `Unlocking issue ${i + 1} / ${targets.length}: ${targets[i].title}...`,
        });
        const shouldFlushIdb = (i + 1) % 3 === 0 || i === targets.length - 1;
        const ok = await fetchChapterPages(activeSeries, targets[i], !shouldFlushIdb);
        if (ok) unlocked++;
      }
      await saveImportedToIdb(importedCatalogRef.current);

      if (cancelUnlockRef.current) {
        setQuickBanner({
          kind: 'info',
          text: `Stopped batch unlock. Unlocked ${unlocked} issue${unlocked === 1 ? '' : 's'}.`,
        });
      } else {
        setQuickBanner({
          kind: unlocked > 0 ? 'info' : 'error',
          text:
            unlocked > 0
              ? `Unlocked ${unlocked} of ${targets.length} issue${
                  targets.length === 1 ? '' : 's'
                } into your local vault.`
              : 'Target site blocked automated batch fetching. Drop saved reader HTML or page images directly instead.',
        });
      }
    } finally {
      cancelUnlockRef.current = false;
      setIsBatchUnlocking(false);
      setBatchProgress(null);
    }
  };

  /**
   * Fast inline Add Issue handler: supports image URLs, BatCave reader URLs, or external reader URLs.
   */
  const handleQuickAddIssueSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSeries) return;

    const rawInput = quickIssueInput.trim();
    if (!rawInput) {
      quickIssueImagesRef.current?.click();
      return;
    }

    const urls = parseUrlsFromText(rawInput);
    if (urls.length === 0) {
      setQuickBanner({
        kind: 'error',
        text: 'Paste an issue/reader URL or one or more image URLs, or pick local page images.',
      });
      return;
    }

    setIsAddingIssue(true);
    setQuickBanner(null);

    try {
      const nextNum = getNextIssueNumber(activeSeries);
      const customTitle = quickIssueTitle.trim() || `${activeSeries.title} Issue #${nextNum}`;

      const looksLikeDirectImages =
        urls.length > 1 || /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(urls[0]);

      if (looksLikeDirectImages) {
        const chapter: ComicChapter = {
          id: Date.now(),
          title: customTitle,
          pageCount: urls.length,
          posi: getMaxPosi(activeSeries) + 1,
          thumb: urls[0],
          remotePages: urls,
          hasLocalPages: true,
        };
        await appendChapterToSeries(activeSeries, chapter, openReaderOnAdd);
        setQuickIssueTitle('');
        setQuickIssueInput('');
        setQuickBanner({
          kind: 'info',
          text: `Added "${customTitle}" (${urls.length} pages) to ${activeSeries.title}.`,
        });
      } else {
        const targetUrl = urls[0];
        if (/batcave\.biz/i.test(targetUrl)) {
          const html = await fetchBatcavePageHtml(targetUrl);
          const extracted = parseBatcaveHtml(html, targetUrl);
          if (extracted.length === 0) {
            throw new Error('No readable pages found at that BatCave URL.');
          }
          const firstExtracted = extracted[0];
          const reMapped: ComicSeries =
            firstExtracted.id === activeSeries.id
              ? firstExtracted
              : {
                  ...activeSeries,
                  chapters: firstExtracted.chapters.map((c, idx) => ({
                    ...c,
                    title:
                      quickIssueTitle.trim() && idx === 0
                        ? quickIssueTitle.trim()
                        : c.title,
                    posi: getMaxPosi(activeSeries) + idx + 1,
                  })),
                  imported: true,
                };
          await persistDeltaSeries([reMapped]);
          const firstReady = reMapped.chapters.find((c) => c.hasLocalPages) || reMapped.chapters[0];
          setQuickIssueTitle('');
          setQuickIssueInput('');
          if (openReaderOnAdd && firstReady) {
            setReaderState({
              seriesId: activeSeries.id,
              chapterId: firstReady.id,
              fallbackSeries: activeSeries,
            });
          }
          setQuickBanner({
            kind: 'info',
            text: `Added issue from BatCave to ${activeSeries.title}.`,
          });
        } else {
          const res = await importFromAnyUrl(targetUrl, {
            attachToSeries: activeSeries,
            customIssueTitle: customTitle,
          });
          setQuickIssueTitle('');
          setQuickIssueInput('');
          setQuickBanner({ kind: 'info', text: res.message });
        }
      }
    } catch (err: any) {
      setQuickBanner({
        kind: 'error',
        text: err?.message || 'Unable to add issue from that input.',
      });
    } finally {
      setIsAddingIssue(false);
    }
  };

  /**
   * Converts picked/dropped local image files to data URLs and stores them inside the IndexedDB
   * chapter record so they render immediately offline and in previews.
   */
  const handleImageFilesAsIssue = async (
    imageFiles: File[],
    targetSeries?: ComicSeries,
    titleOverride?: string
  ) => {
    if (imageFiles.length === 0) return;

    const sorted = [...imageFiles].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    setIsAddingIssue(true);
    setQuickBanner({
      kind: 'info',
      text: `Saving ${sorted.length} local comic page${sorted.length === 1 ? '' : 's'} into IndexedDB vault...`,
    });

    try {
      const dataUrls = (await Promise.all(sorted.map((file) => readFileAsDataUrl(file)))).filter(
        Boolean
      );
      if (dataUrls.length === 0) {
        throw new Error('Unable to read selected image files.');
      }

      const hostSeries = targetSeries || activeSeries;
      const chapterId = Date.now();
      const seriesTitle =
        hostSeries?.title || sorted[0].name.replace(/\.[^.]+$/, '') || 'Custom Comic';
      const nextNum = hostSeries ? getNextIssueNumber(hostSeries) : 1;
      const issueTitle =
        titleOverride?.trim() ||
        quickIssueTitle.trim() ||
        `${seriesTitle} Issue #${nextNum}`;

      const chapter: ComicChapter = {
        id: chapterId,
        title: issueTitle,
        pageCount: dataUrls.length,
        posi: hostSeries ? getMaxPosi(hostSeries) + 1 : 1,
        thumb: dataUrls[0],
        pages: dataUrls,
        hasLocalPages: true,
      };

      if (hostSeries) {
        await appendChapterToSeries(hostSeries, chapter, openReaderOnAdd);
        setQuickIssueTitle('');
        setQuickBanner({
          kind: 'info',
          text: `Saved "${issueTitle}" (${dataUrls.length} offline pages) to ${hostSeries.title}.`,
        });
      } else {
        const newSeries: ComicSeries = {
          id: `custom-series-${chapterId}`,
          title: seriesTitle,
          publisher: 'Personal Vault',
          authors: [],
          artists: [],
          genres: ['Comics'],
          synopsis: `Saved ${dataUrls.length} comic pages offline in local IndexedDB vault.`,
          poster: dataUrls[0],
          totalChapters: 1,
          defaultChapterId: chapterId,
          chapters: [chapter],
          imported: true,
        };
        await persistDeltaSeries([newSeries]);
        setSelectedSeriesId(newSeries.id);
        if (openReaderOnAdd) {
          setReaderState({
            seriesId: newSeries.id,
            chapterId,
            fallbackSeries: newSeries,
          });
        }
        setQuickBanner({
          kind: 'info',
          text: `Created "${seriesTitle}" with ${dataUrls.length} offline pages.`,
        });
      }
    } catch (err: any) {
      setQuickBanner({
        kind: 'error',
        text: err?.message || 'Failed to read selected image files.',
      });
    } finally {
      setIsAddingIssue(false);
    }
  };

  /**
   * Imports one or more BatCave or general URLs directly via proxy (used by modal).
   */
  const handleBatcaveUrlsImport = async (rawUrls: string) => {
    const urls = parseUrlsFromText(rawUrls);
    if (urls.length === 0) {
      setImportStatus('Please enter a valid comic or BatCave.biz URL.');
      return;
    }

    setIsImporting(true);
    setImportStatus(`Fetching ${urls.length} page${urls.length === 1 ? '' : 's'}...`);

    try {
      const res = await importFromAnyUrl(rawUrls);
      setBatcaveUrlInput('');
      setImportStatus(res.message);
    } catch (err: any) {
      setImportStatus(err?.message || 'Failed to fetch from URL.');
    } finally {
      setIsImporting(false);
    }
  };

  /**
   * One-click import directly from a Related BatCave Series card or search result.
   */
  const handleQuickImportRelated = async (
    e: React.MouseEvent,
    rel: { id: string | number; title: string; url: string }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!rel.url || importingRelatedId !== null) return;

    setImportingRelatedId(rel.id);
    try {
      const html = await fetchBatcavePageHtml(rel.url);
      const extracted = parseBatcaveHtml(html, rel.url);
      if (extracted.length > 0) {
        await persistDeltaSeries(extracted);
        setSelectedSeriesId(extracted[0].id);
        setQuickSearchResults([]);
        heroTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        setImportStatus(`Could not parse "${rel.title}" automatically. Try importing its URL.`);
        setBatcaveUrlInput(rel.url);
        setShowImporter(true);
      }
    } catch (err: any) {
      setImportStatus(err?.message || `Failed to import ${rel.title}.`);
      setBatcaveUrlInput(rel.url);
      setShowImporter(true);
    } finally {
      setImportingRelatedId(null);
    }
  };

  const handleFilesImport = async (e: React.ChangeEvent<HTMLInputElement> | FileList | null) => {
    const files = e && 'target' in e ? e.target.files : e;
    if (!files || files.length === 0) return;

    const allFiles = Array.from(files);
    const imageFiles = allFiles.filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
    const docFiles = allFiles.filter((f) => /\.(html?|json)$/i.test(f.name));

    if (imageFiles.length > 0 && docFiles.length === 0) {
      await handleImageFilesAsIssue(imageFiles, activeSeries);
      if (e && 'target' in e && e.target) e.target.value = '';
      return;
    }

    if (docFiles.length === 0) {
      const msg = 'No .html, .json, or image files found in selection.';
      setImportStatus(msg);
      setQuickBanner({ kind: 'error', text: msg });
      return;
    }

    setIsImporting(true);
    setImportStatus(`Scanning ${docFiles.length} file${docFiles.length === 1 ? '' : 's'}...`);

    try {
      const parsedItems: ComicSeries[] = [];
      let unlockedIssuesCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < docFiles.length; i++) {
        const file = docFiles[i];
        if (docFiles.length > 10 && i % 10 === 0) {
          setImportStatus(`Parsing ${i + 1} / ${docFiles.length} files...`);
        }
        try {
          const text = await file.text();
          if (file.name.toLowerCase().endsWith('.json')) {
            const json = JSON.parse(text);
            const list = Array.isArray(json) ? json : json && json.title ? [json] : [];
            parsedItems.push(...list);
            unlockedIssuesCount += list.reduce(
              (sum, s) =>
                sum + (s.chapters?.filter((c: ComicChapter) => c.hasLocalPages).length || 0),
              0
            );
          } else {
            const extracted = parseBatcaveHtml(text, file.name);
            parsedItems.push(...extracted);
            unlockedIssuesCount += extracted.reduce(
              (sum, s) => sum + s.chapters.filter((c) => c.hasLocalPages).length,
              0
            );
          }
        } catch {
          skippedCount++;
        }
      }

      if (parsedItems.length === 0) {
        const msg = 'No comic metadata, issue links, or reader images were found in the selected HTML/JSON file(s).';
        setImportStatus(msg);
        setQuickBanner({ kind: 'error', text: msg });
      } else {
        await persistDeltaSeries(parsedItems);
        setSelectedSeriesId(parsedItems[0].id);
        const uniqueSeriesCount = new Set(parsedItems.map((p) => p.id)).size;
        const totalIndexedIssues = parsedItems.reduce((sum, s) => sum + s.chapters.length, 0);
        const uncachedFetchableCount = parsedItems.reduce(
          (sum, s) => sum + s.chapters.filter((c) => !c.hasLocalPages && Boolean(c.readerUrl)).length,
          0
        );
        const msg = `Imported ${uniqueSeriesCount} series with ${totalIndexedIssues} issue${
          totalIndexedIssues === 1 ? '' : 's'
        }${unlockedIssuesCount > 0 ? ` (${unlockedIssuesCount} ready to read)` : ''}${
          uncachedFetchableCount > 0
            ? ` — ${uncachedFetchableCount} fetchable via "Unlock All"`
            : ''
        }${skippedCount > 0 ? ` (${skippedCount} invalid skipped)` : ''}.`;
        setImportStatus(msg);
        setQuickBanner({ kind: 'info', text: msg });
      }
    } catch (err: any) {
      const msg = `Import error: ${err?.message || 'Unable to parse file.'}`;
      setImportStatus(msg);
      setQuickBanner({ kind: 'error', text: msg });
    } finally {
      setIsImporting(false);
      if (e && 'target' in e && e.target) {
        e.target.value = '';
      }
    }
  };

  const handleClearImported = async () => {
    importedCatalogRef.current = [];
    setImportedCatalog([]);
    setSeriesPage(1);
    await clearImportedFromIdb();
    cleanupLegacyHosterStorage();
    if (baseCatalog[0]?.id) setSelectedSeriesId(baseCatalog[0].id);
    setImportStatus('Cleared local vault imports; restored base catalog.');
    setQuickBanner({ kind: 'info', text: 'Cleared vault imports; restored base catalog.' });
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-zinc-400 text-sm">
        Loading BatCave collector vault...
      </div>
    );
  }

  const inputIsUrl = looksLikeUrl(quickSeriesInput);
  const nextIssueNum = getNextIssueNumber(activeSeries);

  return (
    <section
      ref={heroTopRef}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          setIsDraggingOverVault(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDraggingOverVault(false);
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          setIsDraggingOverVault(false);
          handleFilesImport(e.dataTransfer.files);
        }
      }}
      className="space-y-6 pb-12 relative"
    >
      {/* Global Drag & Drop Overlay */}
      {isDraggingOverVault && (
        <div className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-none">
          <div className="max-w-md w-full rounded-2xl border-2 border-dashed border-amber-400 bg-[#0c0c10] p-8 text-center space-y-2 shadow-2xl">
            <Upload size={32} className="mx-auto text-amber-400" />
            <p className="text-sm font-bold text-zinc-100">
              Drop files to import instantly
            </p>
            <p className="text-xs text-zinc-400">
              Drop <code className="text-zinc-200">.html</code> / <code className="text-zinc-200">.json</code> to add series, or drop page images to add a new issue{activeSeries ? ` to ${activeSeries.title}` : ''}.
            </p>
          </div>
        </div>
      )}

      {/* Fast 1-Step Quick Add Series / URL Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-3.5 sm:p-4 space-y-3">
        <form onSubmit={handleQuickSeriesSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Zap
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none"
            />
            <input
              type="text"
              value={quickSeriesInput}
              onChange={(e) => setQuickSeriesInput(e.target.value)}
              placeholder="Paste any comic / BatCave URL, or type a series name to create or search..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-amber-400 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {inputIsUrl ? (
              <button
                type="submit"
                disabled={isImporting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isImporting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <DownloadCloud size={14} />
                )}
                <span>Import URL</span>
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>{quickSeriesInput.trim() ? 'Create Series' : 'New Series'}</span>
                </button>
                {quickSeriesInput.trim() && (
                  <button
                    type="button"
                    disabled={isSearchingBatcave}
                    onClick={handleSearchBatcave}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {isSearchingBatcave ? (
                      <Loader2 size={13} className="animate-spin text-amber-400" />
                    ) : (
                      <Search size={13} className="text-amber-400" />
                    )}
                    <span>Search BatCave</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => quickFilesRef.current?.click()}
              disabled={isImporting || isAddingIssue}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Pick HTML, JSON, or comic page images"
            >
              <Upload size={13} className="text-amber-400" />
              <span>Pick Files</span>
            </button>

            {uncachedFetchableIssues.length > 0 && (
              isBatchUnlocking ? (
                <button
                  type="button"
                  onClick={() => {
                    cancelUnlockRef.current = true;
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Loader2 size={13} className="animate-spin text-red-300" />
                  <span>
                    Stop ({batchProgress?.done ?? 0}/{batchProgress?.total ?? 0})
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleUnlockNextBatch()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-400/60 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title={`Fetch and unlock all ${uncachedFetchableIssues.length} indexed issues`}
                >
                  <DownloadCloud size={13} />
                  <span>Unlock All {uncachedFetchableIssues.length} Issues</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => {
                setIsDownloadsExpanded(true);
                downloadsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Jump to readable Invincible (#000–#025) Archive CBR collection"
            >
              <BookOpen size={13} className="text-amber-400" />
              <span>Archive CBR</span>
              {archiveDownloads?.issues?.length ? (
                <span className="text-[10px] font-mono tabular-nums text-amber-400">
                  ({archiveDownloads.issues.length})
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setShowNewSeriesDetails((v) => !v)}
              className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showNewSeriesDetails
                  ? 'border-amber-400/60 bg-amber-400/10 text-amber-300'
                  : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {showNewSeriesDetails ? 'Hide Details' : 'Options'}
            </button>

            <input
              ref={quickFilesRef}
              type="file"
              multiple
              accept=".html,.htm,.json,image/*"
              onChange={(e) => handleFilesImport(e)}
              className="hidden"
            />
          </div>
        </form>

        {/* Optional Quick New Series Details Row */}
        {showNewSeriesDetails && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-zinc-800/80">
            <input
              type="text"
              value={quickSeriesInput}
              onChange={(e) => setQuickSeriesInput(e.target.value)}
              placeholder="Series title (required)"
              className="sm:col-span-4 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-amber-400 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none"
            />
            <input
              type="text"
              value={newSeriesPublisher}
              onChange={(e) => setNewSeriesPublisher(e.target.value)}
              placeholder="Publisher (optional)"
              className="sm:col-span-3 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-amber-400 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none"
            />
            <input
              type="text"
              value={newSeriesYear}
              onChange={(e) => setNewSeriesYear(e.target.value)}
              placeholder="Year"
              className="sm:col-span-1 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-amber-400 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none"
            />
            <div className="sm:col-span-4 flex items-center gap-1.5">
              {(newSeriesCoverPreview || newSeriesCoverUrl.trim()) && (
                <div className="w-7 h-9 rounded overflow-hidden border border-zinc-700 bg-zinc-900 shrink-0">
                  <ProxyThumb
                    src={newSeriesCoverPreview || newSeriesCoverUrl.trim()}
                    alt="Cover preview"
                    className="w-full h-full object-cover block"
                    fallback={
                      <div className="w-full h-full flex items-center justify-center text-zinc-500">
                        <BookOpen size={11} />
                      </div>
                    }
                  />
                </div>
              )}
              <input
                type="text"
                value={newSeriesCoverFileName || newSeriesCoverUrl}
                onChange={(e) => {
                  setNewSeriesCoverFileName('');
                  setNewSeriesCoverPreview('');
                  setNewSeriesCoverUrl(e.target.value);
                }}
                placeholder="Cover image URL (optional)"
                className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-amber-400 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none"
              />
              <button
                type="button"
                onClick={() => quickCoverFileRef.current?.click()}
                className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 shrink-0 cursor-pointer"
                title="Pick Local Cover Image"
              >
                <ImagePlus size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleCreateCustomSeries(quickSeriesInput)}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Create
              </button>
              <input
                ref={quickCoverFileRef}
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    try {
                      const dataUrl = await readFileAsDataUrl(f);
                      if (dataUrl) {
                        setNewSeriesCoverFileName(f.name);
                        setNewSeriesCoverPreview(dataUrl);
                        setNewSeriesCoverUrl('');
                      }
                    } catch {}
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* Quick Search Results from BatCave */}
        {quickSearchResults.length > 0 && (
          <div className="pt-2 border-t border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>BatCave Matches ({quickSearchResults.length})</span>
              <button
                type="button"
                onClick={() => setQuickSearchResults([])}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {quickSearchResults.map((res) => (
                <button
                  key={res.id}
                  type="button"
                  onClick={(e) =>
                    handleQuickImportRelated(e, {
                      id: res.id,
                      title: res.title,
                      url: res.sourceUrl || '',
                    })
                  }
                  disabled={importingRelatedId === res.id}
                  className="text-left rounded-lg border border-zinc-800 hover:border-amber-400 bg-zinc-950 overflow-hidden transition-colors cursor-pointer group"
                >
                  <div className="aspect-[2/3] bg-zinc-900 relative overflow-hidden">
                    <ComicCoverImage
                      series={res}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-amber-400 text-zinc-950 text-[10px] font-bold shadow">
                      {importingRelatedId === res.id ? 'Adding...' : '+ Add'}
                    </span>
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] font-semibold text-zinc-100 line-clamp-1">
                      {res.title}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Inline Status / Feedback */}
        {quickBanner && (
          <div
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border text-xs ${
              quickBanner.kind === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-200'
                : 'bg-zinc-900 border-zinc-800 text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {quickBanner.kind === 'error' ? (
                <AlertCircle size={14} className="text-red-400 shrink-0" />
              ) : (
                <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
              )}
              <span className="truncate">{quickBanner.text}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isBatchUnlocking ? (
                <button
                  type="button"
                  onClick={() => {
                    cancelUnlockRef.current = true;
                  }}
                  className="px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-200 text-[11px] font-semibold cursor-pointer"
                >
                  Stop
                </button>
              ) : (
                uncachedFetchableIssues.length > 0 &&
                quickBanner.kind === 'info' &&
                quickBanner.text.includes('Unlock All') && (
                  <button
                    type="button"
                    onClick={() => handleUnlockNextBatch()}
                    className="px-2.5 py-1 rounded-md bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[11px] font-bold whitespace-nowrap cursor-pointer"
                  >
                    Unlock All {uncachedFetchableIssues.length} Issues
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setQuickBanner(null)}
                className="text-zinc-400 hover:text-white shrink-0 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Featured Collector Editorial Hero Showcase */}
      {activeSeries && (
        <div className="rounded-2xl border border-zinc-800 bg-[#0c0c10] overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Left Copy Column */}
            <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span className="font-semibold text-amber-400">{activeSeries.publisher}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {activeSeries.id === ARCHIVE_INVINCIBLE_SERIES_ID
                      ? 'Internet Archive CBR Edition'
                      : 'BatCave Archive Edition'}
                  </span>
                  {activeSeries.status && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-zinc-200 font-medium">{activeSeries.status}</span>
                    </>
                  )}
                  {activeSeries.year && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{activeSeries.year}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {activeSeries.totalChapters} Issues Indexed
                  </span>
                  {typeof activeSeries.rating === 'number' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-amber-300">
                        <Star size={12} fill="currentColor" />
                        <span>{activeSeries.rating.toFixed(1)}</span>
                        {activeSeries.votes && (
                          <span className="text-zinc-500">
                            ({activeSeries.votes.toLocaleString()})
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </div>

                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-50 leading-tight max-w-xl">
                  {activeSeries.title}
                </h2>

                {(activeSeries.authors.length > 0 || activeSeries.artists.length > 0) && (
                  <p className="text-xs sm:text-sm text-zinc-300">
                    {activeSeries.authors.length > 0 && (
                      <span>
                        Written by{' '}
                        <strong className="font-semibold text-zinc-100">
                          {activeSeries.authors.join(', ')}
                        </strong>
                      </span>
                    )}
                    {activeSeries.authors.length > 0 && activeSeries.artists.length > 0 && (
                      <span className="mx-2 text-zinc-600" aria-hidden="true">
                        ·
                      </span>
                    )}
                    {activeSeries.artists.length > 0 && (
                      <span>
                        Art by{' '}
                        <strong className="font-semibold text-zinc-100">
                          {activeSeries.artists.join(', ')}
                        </strong>
                      </span>
                    )}
                  </p>
                )}

                <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                  {activeSeries.synopsis}
                </p>

                {activeSeries.genres.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 pt-1">
                    {activeSeries.genres.map((g, idx) => (
                      <React.Fragment key={g}>
                        {idx > 0 && (
                          <span className="text-zinc-700" aria-hidden="true">
                            /
                          </span>
                        )}
                        <span>{g}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {readyChapter && (
                  <button
                    type="button"
                    onClick={() => handleOpenOrFetchIssue(activeSeries, readyChapter)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs sm:text-sm font-bold transition-colors shadow-lg cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <BookOpen size={16} />
                    <span>
                      {readyChapter.hasLocalPages ? 'Read ' : 'Fetch & Read '}
                      {readyChapter.title.replace(`${activeSeries.title} `, '')}
                      {readyChapter.pageCount ? ` (${readyChapter.pageCount} Pages)` : ''}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddIssue(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus size={15} className="text-amber-400" />
                  <span>Quick Add Issue</span>
                </button>

                {uncachedFetchableIssues.length > 0 && (
                  isBatchUnlocking ? (
                    <button
                      type="button"
                      onClick={() => {
                        cancelUnlockRef.current = true;
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-200 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Loader2 size={15} className="animate-spin text-red-300" />
                      <span>
                        Stop Unlock ({batchProgress?.done ?? 0}/{batchProgress?.total ?? 0})
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUnlockNextBatch()}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-400/60 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <DownloadCloud size={15} />
                      <span>Unlock All {uncachedFetchableIssues.length} Issues</span>
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setShowImporter(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Globe size={15} className="text-amber-400" />
                  <span>Batch Importer</span>
                </button>

                {activeSeries.sourceUrl && (
                  <a
                    href={activeSeries.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>
                      {activeSeries.id === ARCHIVE_INVINCIBLE_SERIES_ID
                        ? 'Archive Source'
                        : 'BatCave Source'}
                    </span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>

            {/* Right Cover + Live Page Spread Preview */}
            <div className="lg:col-span-5 bg-[#08080b] border-t lg:border-t-0 lg:border-l border-zinc-800 p-6 flex items-center justify-center gap-4">
              <div className="w-44 sm:w-52 aspect-[2/3] rounded-xl overflow-hidden border border-zinc-700/80 shadow-2xl shrink-0">
                <ComicCoverImage
                  series={activeSeries}
                  className="w-full h-full object-cover block"
                />
              </div>

              {(() => {
                const previewList = readyChapter?.pages?.length
                  ? readyChapter.pages
                  : readyChapter?.remotePages || [];
                if (previewList.length < 2) return null;
                return (
                  <div className="hidden sm:flex flex-col gap-3 w-28 shrink-0">
                    {previewList.slice(0, 3).map((pageUrl, idx) => (
                      <button
                        key={pageUrl}
                        type="button"
                        onClick={() =>
                          setReaderState({
                            seriesId: activeSeries.id,
                            chapterId: readyChapter!.id,
                            fallbackSeries: activeSeries,
                          })
                        }
                        className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-zinc-800 hover:border-amber-400 transition-colors cursor-pointer"
                        title={`Preview Page ${idx + 1}`}
                      >
                        <ProxyThumb
                          src={pageUrl}
                          fallbackSrc={readyChapter?.remotePages?.[idx]}
                          alt={`Preview Page ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          fallback={
                            <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 text-[10px] font-mono">
                              <BookOpen size={14} className="text-amber-400/70 mb-1" />
                              <span>p.{idx + 1}</span>
                            </div>
                          }
                        />
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Readable Internet Archive .cbr Collection View */}
      {(() => {
        const archiveIssues = archiveDownloads?.issues || [];
        const collectionTitle = getArchiveCollectionRangeLabel(archiveIssues);
        const totalSizeMb = archiveIssues.reduce((sum, item) => sum + item.sizeBytes, 0) / (1024 * 1024);
        const archiveSeriesObj = allSeries.find((s) => s.id === ARCHIVE_INVINCIBLE_SERIES_ID);
        const archiveChapterMap = new Map<string, ComicChapter>(
          (archiveSeriesObj?.chapters || []).map((c) => [String(c.id), c])
        );
        const readyCbrCount = archiveIssues.filter(
          (item) => archiveChapterMap.get(item.id)?.hasLocalPages
        ).length;
        const filteredArchiveIssues = downloadsFilter.trim()
          ? archiveIssues.filter(
              (item) =>
                item.filename.toLowerCase().includes(downloadsFilter.trim().toLowerCase()) ||
                item.issueLabel.toLowerCase().includes(downloadsFilter.trim().toLowerCase())
            )
          : archiveIssues;

        return (
          <div
            ref={downloadsSectionRef}
            id="comic-downloads-section"
            className="rounded-2xl border border-zinc-800 bg-[#0c0c10] overflow-hidden"
          >
            {/* Collection Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Folder size={19} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-zinc-100 truncate">
                      {collectionTitle} — CBR Reader
                    </h3>
                    <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-amber-300">
                      {archiveIssues.length} {archiveIssues.length === 1 ? 'issue' : 'issues'}
                    </span>
                    {readyCbrCount > 0 && (
                      <span className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/30 text-amber-300">
                        {readyCbrCount} cached
                      </span>
                    )}
                    {totalSizeMb > 0 && (
                      <span className="text-[11px] font-mono tabular-nums text-zinc-400">
                        {totalSizeMb >= 1024
                          ? `${(totalSizeMb / 1024).toFixed(2)} GB`
                          : `${totalSizeMb.toFixed(0)} MB`}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-2 mt-0.5">
                    <span>Internet Archive · invincible-025 · Click any issue to read in modal</span>
                    {archiveDownloads?.fetchedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Synced {new Date(archiveDownloads.fetchedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {archiveIssues[0] && (
                  <button
                    type="button"
                    disabled={
                      fetchingChapterKey === `${ARCHIVE_INVINCIBLE_SERIES_ID}:${archiveIssues[0].id}`
                    }
                    onClick={() => handleReadArchiveCbrIssue(archiveIssues[0])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-zinc-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <BookOpen size={13} />
                    <span>Read {archiveIssues[0].issueLabel}</span>
                  </button>
                )}

                <a
                  href={INVINCIBLE_ARCHIVE_FOLDER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  <span>Archive Folder</span>
                  <ExternalLink size={12} className="text-amber-400" />
                </a>

                <button
                  type="button"
                  disabled={isLoadingDownloads}
                  onClick={() => handleRefreshArchiveDownloads(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-zinc-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  title="Refresh .cbr list from Internet Archive metadata"
                >
                  <RefreshCw
                    size={12}
                    className={isLoadingDownloads ? 'animate-spin text-amber-400' : 'text-amber-400'}
                  />
                  <span>{isLoadingDownloads ? 'Refreshing...' : 'Refresh'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDownloadsExpanded((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  {isDownloadsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  <span>
                    {isDownloadsExpanded ? 'Hide' : `Show (${archiveIssues.length})`}
                  </span>
                </button>
              </div>
            </div>

            {downloadsError && (
              <div className="px-4 sm:px-5 py-2.5 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between gap-3 text-xs text-red-200">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <span className="truncate">
                    {archiveIssues.length > 0
                      ? `Showing cached issues (${downloadsError})`
                      : downloadsError}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRefreshArchiveDownloads(true)}
                  className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-100 text-[11px] font-semibold cursor-pointer shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {isDownloadsExpanded && (
              <div>
                {archiveIssues.length > 0 && (
                  <div className="px-4 sm:px-5 py-2.5 border-b border-zinc-800/80 bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[11px] text-zinc-400 font-mono">
                      Stream &amp; read .cbr volumes in Comic Reader · Sorted naturally (
                      {archiveIssues[0]?.issueLabel} →{' '}
                      {archiveIssues[archiveIssues.length - 1]?.issueLabel})
                    </span>
                    <div className="relative">
                      <Search
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
                      />
                      <input
                        type="text"
                        value={downloadsFilter}
                        onChange={(e) => setDownloadsFilter(e.target.value)}
                        placeholder="Filter issue #..."
                        className="pl-7 pr-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-amber-400 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none w-40 sm:w-48"
                      />
                    </div>
                  </div>
                )}

                {isLoadingDownloads && archiveIssues.length === 0 ? (
                  <div className="py-10 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                    <Loader2 size={15} className="animate-spin text-amber-400" />
                    <span>Fetching Invincible .cbr collection from Internet Archive...</span>
                  </div>
                ) : filteredArchiveIssues.length === 0 ? (
                  <div className="py-10 text-center text-xs text-zinc-500">
                    {archiveIssues.length === 0
                      ? 'No .cbr files loaded yet. Click Refresh to sync with archive.org/metadata/invincible-025.'
                      : 'No .cbr issues match your filter.'}
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800/70">
                    {filteredArchiveIssues.map((issue) => {
                      const matchedCh = archiveChapterMap.get(issue.id);
                      const isCached = Boolean(matchedCh?.hasLocalPages);
                      const isLoadingThis =
                        fetchingChapterKey === `${ARCHIVE_INVINCIBLE_SERIES_ID}:${issue.id}`;
                      const pageCountDisplay = matchedCh?.pageCount ?? issue.pageCount;

                      return (
                        <div
                          key={issue.id}
                          className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 hover:bg-zinc-900/50 transition-colors"
                        >
                          <button
                            type="button"
                            disabled={isLoadingThis}
                            onClick={() => handleReadArchiveCbrIssue(issue)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer disabled:opacity-60"
                          >
                            <span
                              className={`px-2 py-1 rounded-md border text-[11px] font-mono font-bold shrink-0 ${
                                isCached
                                  ? 'bg-amber-400/15 border-amber-400/40 text-amber-300'
                                  : 'bg-zinc-900 border-zinc-800 text-amber-400'
                              }`}
                            >
                              {issue.issueLabel}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs sm:text-sm font-medium text-zinc-100 truncate">
                                {issue.title}{' '}
                                <span className="text-xs text-zinc-500 font-normal">
                                  ({issue.filename})
                                </span>
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono tabular-nums flex items-center gap-2">
                                <span>{issue.sizeFormatted}</span>
                                {pageCountDisplay && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className={isCached ? 'text-amber-400/90 font-semibold' : ''}>
                                      {pageCountDisplay} pages
                                    </span>
                                  </>
                                )}
                                <span aria-hidden="true">·</span>
                                <span className={isCached ? 'text-amber-400/90' : ''}>
                                  {isCached ? 'Ready in Reader' : 'Streamable CBR'}
                                </span>
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isLoadingThis}
                              onClick={() => handleReadArchiveCbrIssue(issue)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 ${
                                isCached
                                  ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                                  : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                              }`}
                              title={`Open ${issue.title} in Comic Reader`}
                            >
                              {isLoadingThis ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  <span>Opening...</span>
                                </>
                              ) : (
                                <>
                                  <BookOpen size={13} />
                                  <span>Read Issue</span>
                                </>
                              )}
                            </button>

                            <a
                              href={issue.downloadUrl}
                              download={issue.filename}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
                              title={`Download raw ${issue.filename}`}
                              aria-label={`Download raw ${issue.filename}`}
                            >
                              <Download size={13} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Series Switcher (if more than 1 series exists or imported) */}
      {allSeries.length > 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Layers size={15} className="text-amber-400" />
              <span>Comic Series Catalog ({filteredSeries.length})</span>
            </h3>
            {importedCatalog.length > 0 && (
              <button
                type="button"
                onClick={handleClearImported}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Clear Imports</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {paginatedSeries.map((s) => {
              const isSelected = s.id === activeSeries?.id;
              const localReadyCount = s.chapters.filter((c) => c.hasLocalPages).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedSeriesId(s.id);
                    heroTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`text-left rounded-xl border overflow-hidden bg-[#0c0c10] transition-all cursor-pointer ${
                    isSelected
                      ? 'border-amber-400 ring-1 ring-amber-400/50'
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="aspect-[2/3] w-full bg-zinc-900 overflow-hidden">
                    <ComicCoverImage
                      series={s}
                      className="w-full h-full object-cover block"
                    />
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="text-xs font-bold text-zinc-100 line-clamp-1">{s.title}</div>
                    <div className="text-[11px] text-zinc-400 truncate">
                      {localReadyCount > 0 ? (
                        <span className="text-amber-400 font-semibold">
                          {localReadyCount} HD Ready · {s.totalChapters} indexed
                        </span>
                      ) : (
                        <span>
                          {s.publisher}
                          {s.year ? ` · ${s.year}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredSeries.length > SERIES_PER_PAGE && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                disabled={seriesPage === 1}
                onClick={() => setSeriesPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                <span>Previous</span>
              </button>
              <span className="text-xs font-mono tabular-nums text-zinc-400">
                Page {seriesPage} of {totalSeriesPages}
              </span>
              <button
                type="button"
                disabled={seriesPage === totalSeriesPages}
                onClick={() => setSeriesPage((p) => Math.min(totalSeriesPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs text-zinc-200 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Full Issue Vault Directory */}
      {activeSeries && (
        <div className="rounded-2xl border border-zinc-800 bg-[#0c0c10] overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-zinc-100">
                {activeSeries.title} — Issue Directory
              </h3>
              <p className="text-xs text-zinc-400">
                {(() => {
                  const readyCount = orderedIssues.filter((c) => c.hasLocalPages).length;
                  return `${readyCount} ${
                    readyCount === 1 ? 'issue' : 'issues'
                  } ready in offline HD studio · ${orderedIssues.length} total ${
                    orderedIssues.length === 1 ? 'issue' : 'issues'
                  } indexed`;
                })()}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQuickAddIssue((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showQuickAddIssue
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                }`}
              >
                <Plus size={13} />
                <span>Add Issue</span>
              </button>

              {uncachedFetchableIssues.length > 0 && (
                <>
                  {isBatchUnlocking ? (
                    <button
                      type="button"
                      onClick={() => {
                        cancelUnlockRef.current = true;
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 text-red-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Loader2 size={13} className="animate-spin text-red-300" />
                      <span>
                        Stop ({batchProgress?.done ?? 0}/{batchProgress?.total ?? 0})
                      </span>
                    </button>
                  ) : (
                    <>
                      {uncachedFetchableIssues.length > 5 && (
                        <button
                          type="button"
                          onClick={() => handleUnlockNextBatch(5)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          title="Fetch and cache the next 5 un-cached issues"
                        >
                          <DownloadCloud size={13} className="text-amber-400" />
                          <span>Unlock Next 5</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleUnlockNextBatch()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/50 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        title={`Fetch and cache all ${uncachedFetchableIssues.length} indexed issues`}
                      >
                        <DownloadCloud size={13} />
                        <span>Unlock All {uncachedFetchableIssues.length} Issues</span>
                      </button>
                    </>
                  )}
                </>
              )}

              <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-950 border border-zinc-800">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'ready', label: 'Ready HD' },
                    { id: 'bookmarked', label: 'Bookmarked' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setIssueFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      issueFilter === tab.id
                        ? 'bg-amber-400 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
                />
                <input
                  type="text"
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                  placeholder="Find issue # or TPB..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-amber-400 w-44 sm:w-52"
                />
              </div>
            </div>
          </div>

          {/* 1-Step Inline Quick Add Issue Panel */}
          {showQuickAddIssue && (
            <form
              onSubmit={handleQuickAddIssueSubmit}
              className="p-4 bg-zinc-950/80 border-b border-zinc-800 space-y-3"
            >
              <div className="flex flex-col md:flex-row gap-2.5">
                <input
                  type="text"
                  value={quickIssueTitle}
                  onChange={(e) => setQuickIssueTitle(e.target.value)}
                  placeholder={`Issue #${nextIssueNum} (optional title)`}
                  className="md:w-56 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-amber-400 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none"
                />
                <textarea
                  rows={1}
                  value={quickIssueInput}
                  onChange={(e) => setQuickIssueInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleQuickAddIssueSubmit();
                    }
                  }}
                  placeholder="Paste reader URL, BatCave /reader/... link, or one/multiple image URLs..."
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 focus:border-amber-400 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none resize-y"
                />
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isAddingIssue}
                    onClick={() => quickIssueImagesRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ImagePlus size={14} className="text-amber-400" />
                    <span>Pick Images</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingIssue || !quickIssueInput.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isAddingIssue ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    <span>Add Issue</span>
                  </button>
                </div>
                <input
                  ref={quickIssueImagesRef}
                  type="file"
                  multiple
                  accept="image/*,.html,.htm,.json"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    const arr = Array.from(files);
                    const imgs = arr.filter((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
                    if (imgs.length > 0) {
                      await handleImageFilesAsIssue(imgs, activeSeries, quickIssueTitle);
                    } else {
                      await handleFilesImport(files);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span>
                  Tip: Drag &amp; drop a folder of page images anywhere on this page to add an issue instantly.
                </span>
                <label className="inline-flex items-center gap-1.5 text-zinc-300 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={openReaderOnAdd}
                    onChange={(e) => setOpenReaderOnAdd(e.target.checked)}
                    className="accent-amber-400"
                  />
                  <span>Open reader after adding</span>
                </label>
              </div>
            </form>
          )}

          <div className="max-h-[480px] overflow-y-auto divide-y divide-zinc-800/70">
            {filteredIssues.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-xs text-zinc-500">
                  {orderedIssues.length === 0
                    ? 'No issues in this series yet.'
                    : 'No issues match your filter criteria.'}
                </p>
                {orderedIssues.length === 0 && (
                  <button
                    type="button"
                    onClick={() => quickIssueImagesRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ImagePlus size={14} />
                    <span>Pick Page Images for Issue #1</span>
                  </button>
                )}
              </div>
            ) : (
              filteredIssues.map((ch: ComicChapter) => {
                const prog = progressMap[`${activeSeries.id}:${ch.id}`];
                const isFav = Boolean(favChapters[`${activeSeries.id}:${ch.id}`]);
                const isFetchingThis = fetchingChapterKey === `${activeSeries.id}:${ch.id}`;
                return (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 hover:bg-zinc-900/60 transition-colors"
                  >
                    <button
                      type="button"
                      disabled={isFetchingThis}
                      onClick={() => handleOpenOrFetchIssue(activeSeries, ch)}
                      className="flex items-center gap-3.5 min-w-0 flex-1 text-left cursor-pointer disabled:opacity-60"
                    >
                      <div className="w-9 h-12 rounded-md overflow-hidden border border-zinc-800 bg-zinc-950 shrink-0 flex items-center justify-center">
                        <ProxyThumb
                          src={ch.thumb || activeSeries.poster || activeSeries.remotePoster}
                          fallbackSrc={activeSeries.poster || activeSeries.remotePoster}
                          alt={ch.title}
                          className="w-full h-full object-cover block"
                          fallback={
                            <span
                              className={
                                ch.hasLocalPages ? 'text-amber-400' : 'text-zinc-600'
                              }
                            >
                              {ch.hasLocalPages ? (
                                <CheckCircle2 size={15} />
                              ) : (
                                <BookOpen size={15} />
                              )}
                            </span>
                          }
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-medium text-zinc-100 truncate">
                          {ch.title}
                        </div>
                        <div className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-2 font-mono tabular-nums">
                          {ch.hasLocalPages ? (
                            <span className="text-amber-400/95 font-semibold">
                              {ch.pageCount} Pages ·{' '}
                              {ch.pages?.length ? 'Cached Local HD' : 'Streamed HD'}
                            </span>
                          ) : (
                            <span>
                              {ch.pageCount ? `${ch.pageCount} Pages` : `Index #${ch.id}`}
                            </span>
                          )}
                          {ch.date && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{ch.date}</span>
                            </>
                          )}
                          {!ch.hasLocalPages && ch.readerUrl && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-zinc-400">1-Click Fetch Ready</span>
                            </>
                          )}
                          {prog && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-zinc-300">
                                Resume p.{prog.page}/{prog.total}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFavIssue(activeSeries.id, ch.id)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isFav
                            ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-200'
                        }`}
                        title={isFav ? 'Remove bookmark' : 'Bookmark issue'}
                      >
                        <Star size={13} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        disabled={isFetchingThis}
                        onClick={() => handleOpenOrFetchIssue(activeSeries, ch)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                          ch.hasLocalPages
                            ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                            : 'border border-zinc-700 bg-zinc-900 hover:border-amber-400/70 text-zinc-200'
                        }`}
                      >
                        {isFetchingThis ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-amber-400" />
                            <span>Loading...</span>
                          </>
                        ) : ch.hasLocalPages ? (
                          <span>Read Issue</span>
                        ) : ch.readerUrl ? (
                          <>
                            <DownloadCloud size={12} className="text-amber-400" />
                            <span>Fetch &amp; Read</span>
                          </>
                        ) : (
                          <span>Inspect</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Character Roster & Related BatCave Series */}
      {activeSeries &&
        ((activeSeries.characters && activeSeries.characters.length > 0) ||
          (activeSeries.relatedComics && activeSeries.relatedComics.length > 0)) && (
          <div className="space-y-6">
            {activeSeries.characters && activeSeries.characters.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <h3 className="text-sm font-bold text-zinc-100">
                    Key Characters ({activeSeries.characters.length})
                  </h3>
                  <span className="text-[11px] text-zinc-500">BatCave Universe Index</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
                  {activeSeries.characters.map((ch) => (
                    <a
                      key={ch.name}
                      href={ch.url || activeSeries.sourceUrl || 'https://batcave.biz'}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2.5 p-2 rounded-lg border border-zinc-800/80 bg-zinc-950/70 hover:border-amber-400/50 transition-colors min-w-0"
                    >
                      <div className="w-8 h-8 rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 shrink-0 flex items-center justify-center text-[11px] font-bold text-zinc-400">
                        <ProxyThumb
                          src={ch.thumb}
                          alt={ch.name}
                          className="w-full h-full object-cover block"
                          fallback={<span>{ch.name.slice(0, 2).toUpperCase()}</span>}
                        />
                      </div>
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {ch.name}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {activeSeries.relatedComics && activeSeries.relatedComics.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-[#0c0c10] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <h3 className="text-sm font-bold text-zinc-100">
                    Related Series on BatCave ({activeSeries.relatedComics.length})
                  </h3>
                  <span className="text-[11px] text-zinc-500">Click + to import directly into vault</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-3">
                  {activeSeries.relatedComics.map((rel) => {
                    const isFetchingThis = importingRelatedId === rel.id;
                    return (
                      <div
                        key={rel.id}
                        className="group relative rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden hover:border-amber-400/60 transition-colors flex flex-col"
                      >
                        <a
                          href={rel.url}
                          target="_blank"
                          rel="noreferrer"
                          className="aspect-[2/3] w-full bg-zinc-900 overflow-hidden block"
                        >
                          <ProxyThumb
                            src={rel.poster}
                            alt={rel.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            fallback={
                              <div className="w-full h-full flex items-center justify-center p-2 text-center text-[11px] font-semibold text-zinc-500">
                                {rel.title}
                              </div>
                            }
                          />
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleQuickImportRelated(e, rel)}
                          disabled={isFetchingThis}
                          title={`Import ${rel.title} directly from BatCave.biz`}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-950/90 hover:bg-amber-400 text-zinc-200 hover:text-zinc-950 border border-zinc-700/80 shadow-lg transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {isFetchingThis ? (
                            <Loader2 size={13} className="animate-spin text-amber-400" />
                          ) : (
                            <DownloadCloud size={13} />
                          )}
                        </button>
                        <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                          <a
                            href={rel.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-zinc-100 hover:text-amber-300 line-clamp-2 leading-snug"
                          >
                            {rel.title}
                          </a>
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono tabular-nums pt-1">
                            <span>{rel.status || rel.year || 'BatCave'}</span>
                            {typeof rel.rating === 'number' && (
                              <span className="text-amber-400">★ {rel.rating.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      {/* BatCave.biz Direct URL & HTML Batch Importer Modal */}
      {showImporter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-[#111116] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCode2 size={18} className="text-amber-400" />
                <h3 className="text-sm font-bold text-zinc-100">
                  Batch Import Series &amp; Issues
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImporter(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Direct URL Fetcher */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-200">
                Paste One or Multiple URLs (BatCave.biz, Webcomics, RSS, JSON)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={batcaveUrlInput}
                  onChange={(e) => setBatcaveUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && batcaveUrlInput.trim() && !isImporting) {
                      handleBatcaveUrlsImport(batcaveUrlInput);
                    }
                  }}
                  placeholder="https://batcave.biz/6975-batman-2016.html"
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-amber-400 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none"
                />
                <button
                  type="button"
                  disabled={isImporting || !batcaveUrlInput.trim()}
                  onClick={() => handleBatcaveUrlsImport(batcaveUrlInput)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  {isImporting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <DownloadCloud size={14} />
                  )}
                  <span>Fetch</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">
                Works with series overview pages, individual reader issue links, or multiple URLs separated by spaces/commas.
              </p>
            </div>

            <div className="relative flex items-center py-0.5">
              <div className="flex-grow border-t border-zinc-800" />
              <span className="shrink mx-3 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Or import saved files &amp; images
              </span>
              <div className="flex-grow border-t border-zinc-800" />
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Drop saved <code className="text-zinc-200">.html</code> /{' '}
              <code className="text-zinc-200">.json</code> exports, or select a folder of page images (<code className="text-zinc-200">.jpg</code>, <code className="text-zinc-200">.png</code>, <code className="text-zinc-200">.webp</code>) to create a readable issue immediately.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFilesImport(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-zinc-700 hover:border-amber-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-zinc-950/60 space-y-2"
            >
              <Upload size={24} className="mx-auto text-amber-400" />
              <p className="text-xs font-semibold text-zinc-100">
                {isImporting || isAddingIssue
                  ? 'Importing comic data...'
                  : 'Click to select or drag .html, .json, or image files here'}
              </p>
              <p className="text-[11px] text-zinc-500">
                Supports single issues, full series overviews, page image batches, and folders
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".html,.htm,.json,image/*"
                onChange={(e) => handleFilesImport(e)}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                onChange={(e) => handleFilesImport(e)}
                className="hidden"
              />
            </div>

            {importStatus && (
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200">
                {importStatus}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={isImporting || isAddingIssue}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 disabled:opacity-50 cursor-pointer"
                >
                  <Layers size={13} />
                  <span>Select Folder</span>
                </button>
                {uncachedFetchableIssues.length > 0 && !isBatchUnlocking && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowImporter(false);
                      handleUnlockNextBatch();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold cursor-pointer"
                  >
                    <DownloadCloud size={13} />
                    <span>Unlock All {uncachedFetchableIssues.length} Issues</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowImporter(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-100 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pro Collector Comic Reader Skin */}
      {readerState && activeReaderSeries && (
        <ComicReaderModal
          series={activeReaderSeries}
          initialChapterId={readerState.chapterId}
          onClose={() => {
            setReaderState(null);
            refreshLocalTracking();
          }}
          onOpenImporter={() => setShowImporter(true)}
          onOpenQuickAdd={() => setShowQuickAddIssue(true)}
          onFetchChapter={(chapter) => fetchChapterPages(activeReaderSeries, chapter)}
          uncachedCount={
            activeReaderSeries.chapters.filter((c) => !c.hasLocalPages && Boolean(c.readerUrl)).length
          }
          isBatchUnlocking={isBatchUnlocking}
          batchProgress={batchProgress}
          onUnlockAll={() => handleUnlockNextBatch()}
          onStopUnlock={() => {
            cancelUnlockRef.current = true;
          }}
        />
      )}
    </section>
  );
};

export default ComicsSection;