import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play,
  Plus,
  Check,
  Star,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowUp,
  Search,
  X,
  Loader2,
  AlertCircle,
  Bookmark,
} from 'lucide-react';
import { isImdbId } from '../utils/movieServers';
import {
  TMDB_FEEDS,
  ServerCatalogStats,
  TmdbArchiveManifest,
  TmdbCatalogItem,
  TmdbCollectionSummary,
  TmdbFeedType,
  fetchServerCatalogStats,
  fetchTmdbArchiveManifest,
  fetchTmdbCollectionsBatch,
  fetchTmdbFeed,
  fetchTmdbNetworkContent,
  fetchTmdbStudioContent,
  fetchTmdbTrendingSplit,
  findByImdbId,
  queryServerCatalogPage,
  searchTmdbByType,
  streamTmdbArchive,
} from '../services/tmdb';
import { handlePosterImageError } from '../utils/posterFallback';
import type { MoviePlayerTarget } from './MoviePlayerView';
import {
  COLLECTION_IMAGE_OVERRIDES,
  FEATURED_COLLECTION_IDS,
  FEATURED_STUDIOS,
  POPULAR_NETWORKS,
  NetworkBrandItem,
  StudioBrandItem,
} from './CinemaBrands';

const ARCHIVE_PAGE_SIZE = 50;
const WATCHLIST_STORAGE_KEY = 'streamx_cinema_watchlist_v1';

export interface MoviesCatalogState {
  feed: TmdbFeedType;
  mediaFilter: 'all' | 'movie' | 'tv';
  genre: string;
  era: string;
  sortBy: 'popularity' | 'rating' | 'newest' | 'title';
  page: number;
}

type DrilldownView =
  | { kind: 'network'; network: NetworkBrandItem }
  | { kind: 'studio'; studio: StudioBrandItem }
  | { kind: 'collection'; collection: TmdbCollectionSummary }
  | { kind: 'all_collections' }
  | null;

interface MoviesSectionProps {
  mode?: 'movies' | 'tv';
  searchQuery?: string;
  onClearSearch?: () => void;
  onSelectMedia: (target: MoviePlayerTarget) => void;
  savedState?: MoviesCatalogState | null;
  onStateChange?: (state: MoviesCatalogState) => void;
}

/**
 * Reusable poster card preserving authentic TMDB w500 posters with sleek obsidian typography.
 */
const CinemaPosterCard: React.FC<{
  media: TmdbCatalogItem;
  onSelect: (media: TmdbCatalogItem) => void;
  className?: string;
}> = ({ media, onSelect, className = '' }) => {
  const yearLabel = media.year && media.year !== 'N/A' ? media.year : '';
  return (
    <article
      onClick={() => onSelect(media)}
      className={`group flex flex-col cursor-pointer select-none ${className}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(media);
        }}
        aria-label={`Play ${media.title}`}
        className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#141418] border border-white/5 group-hover:border-white/25 shadow-lg transition-all duration-300 group-hover:-translate-y-1 p-0 block text-left cursor-pointer"
      >
        <img
          src={media.posterUrl}
          alt={media.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) =>
            handlePosterImageError(
              e,
              media.title,
              media.mediaType === 'tv' ? 'TV Shows' : 'Movies'
            )
          }
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Top-left rating badge with green star */}
        {media.voteAverage > 0 && (
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-sm text-[11px] font-bold text-white tabular-nums pointer-events-none">
            <Star size={10} className="text-[#22c55e] fill-[#22c55e]" />
            <span>{media.voteAverage.toFixed(1)}</span>
          </div>
        )}

        {/* Centered hover Play circle */}
        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 grid place-items-center pointer-events-none">
          <span className="w-11 h-11 rounded-full bg-black/70 backdrop-blur-md border border-white/25 text-white grid place-items-center shadow-2xl">
            <Play size={18} fill="currentColor" className="ml-0.5" />
          </span>
        </div>
      </button>

      {/* Clean minimal footer below poster */}
      <div className="pt-2 px-0.5 space-y-0.5 min-w-0">
        <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-neutral-400 uppercase tabular-nums">
          <span>{media.mediaType === 'tv' ? 'TV' : 'MOVIE'}</span>
          <span>{yearLabel}</span>
        </div>
        <h4
          className="text-xs sm:text-[13px] font-bold text-white truncate group-hover:text-neutral-200 transition-colors"
          title={media.title}
        >
          {media.title}
        </h4>
      </div>
    </article>
  );
};

/**
 * Horizontal scrollable shelf with left/right arrow controls in top right.
 */
const HorizontalPosterShelf: React.FC<{
  title: string;
  items: TmdbCatalogItem[];
  loading?: boolean;
  onSelect: (media: TmdbCatalogItem) => void;
}> = ({ title, items, loading = false, onSelect }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollTrack = (direction: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    const distance = Math.max(320, el.clientWidth * 0.78);
    el.scrollBy({
      left: direction === 'right' ? distance : -distance,
      behavior: 'smooth',
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
          {title}
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => scrollTrack('left')}
            aria-label={`Scroll ${title} left`}
            className="w-8 h-8 rounded-lg bg-[#141418] hover:bg-[#23232a] border border-[#27272d] text-neutral-200 grid place-items-center transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollTrack('right')}
            aria-label={`Scroll ${title} right`}
            className="w-8 h-8 rounded-lg bg-[#141418] hover:bg-[#23232a] border border-[#27272d] text-neutral-200 grid place-items-center transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex gap-3.5 overflow-hidden">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="w-[148px] sm:w-[168px] shrink-0 space-y-2 animate-pulse">
              <div className="aspect-[2/3] rounded-xl bg-[#16161b]" />
              <div className="h-2.5 w-16 rounded bg-[#1b1b22]" />
              <div className="h-3.5 w-32 rounded bg-[#202028]" />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={trackRef}
          className="flex gap-3.5 overflow-x-auto pb-2 scroll-smooth"
          style={{ scrollbarWidth: 'none' }}
        >
          {items.map((media) => (
            <CinemaPosterCard
              key={media.id}
              media={media}
              onSelect={onSelect}
              className="w-[148px] sm:w-[168px] shrink-0"
            />
          ))}
        </div>
      )}
    </section>
  );
};

export const MoviesSection: React.FC<MoviesSectionProps> = ({
  mode = 'movies',
  searchQuery = '',
  onClearSearch,
  onSelectMedia,
  savedState,
  onStateChange,
}) => {
  const fullCatalogRef = useRef<HTMLElement | null>(null);
  const collectionsTrackRef = useRef<HTMLDivElement | null>(null);

  // Watchlist persisted in localStorage (+ button in Hero)
  const [watchlist, setWatchlist] = useState<TmdbCatalogItem[]>(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
    } catch {}
  }, [watchlist]);

  const toggleWatchlist = (item: TmdbCatalogItem) => {
    setWatchlist((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      return exists ? prev.filter((x) => x.id !== item.id) : [item, ...prev];
    });
  };

  const lockedMediaType: 'movie' | 'tv' = mode === 'tv' ? 'tv' : 'movie';

  const modeWatchlist = useMemo(
    () => watchlist.filter((w) => w.mediaType === lockedMediaType),
    [watchlist, lockedMediaType]
  );

  // Curated TMDB shelves state (strictly separated by media type)
  const [trendingMovies, setTrendingMovies] = useState<TmdbCatalogItem[]>([]);
  const [popularMovies, setPopularMovies] = useState<TmdbCatalogItem[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<TmdbCatalogItem[]>([]);
  const [trendingShows, setTrendingShows] = useState<TmdbCatalogItem[]>([]);
  const [popularShows, setPopularShows] = useState<TmdbCatalogItem[]>([]);
  const [onTheAirShows, setOnTheAirShows] = useState<TmdbCatalogItem[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<TmdbCatalogItem[]>([]);
  const [topRatedShows, setTopRatedShows] = useState<TmdbCatalogItem[]>([]);
  const [shelvesLoading, setShelvesLoading] = useState<boolean>(true);
  const [collections, setCollections] = useState<TmdbCollectionSummary[]>([]);
  const [heroIndex, setHeroIndex] = useState<number>(0);

  // Drilldown state (Network, Studio, Collection, All Collections)
  const [drilldown, setDrilldown] = useState<DrilldownView>(null);
  const [drilldownItems, setDrilldownItems] = useState<TmdbCatalogItem[]>([]);
  const [drilldownPage, setDrilldownPage] = useState<number>(1);
  const [drilldownTotalPages, setDrilldownTotalPages] = useState<number>(1);
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false);

  // 1.51M Full TMDB Index Server State (with static 92,000 chunk fallback)
  const [serverStats, setServerStats] = useState<ServerCatalogStats | null>(null);
  const [serverCheckDone, setServerCheckDone] = useState<boolean>(false);
  const [serverPageItems, setServerPageItems] = useState<TmdbCatalogItem[]>([]);
  const [serverTotalItems, setServerTotalItems] = useState<number>(0);
  const [serverTotalPages, setServerTotalPages] = useState<number>(1);
  const [serverScopeNote, setServerScopeNote] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState<boolean>(true);

  const modeFeeds = useMemo(
    () =>
      TMDB_FEEDS.filter(
        (f) => f.key === 'archive' || f.defaultMediaType === lockedMediaType
      ),
    [lockedMediaType]
  );

  // Static archive fallback state
  const [activeFeed, setActiveFeed] = useState<TmdbFeedType>(() => {
    const saved = savedState?.feed;
    if (saved) {
      const feedMeta = TMDB_FEEDS.find((f) => f.key === saved);
      if (feedMeta && (feedMeta.key === 'archive' || feedMeta.defaultMediaType === (mode === 'tv' ? 'tv' : 'movie'))) {
        return saved;
      }
    }
    return 'archive';
  });
  const archiveMediaFilter: 'movie' | 'tv' = lockedMediaType;
  const [archiveManifest, setArchiveManifest] = useState<TmdbArchiveManifest | null>(null);
  const [archiveItems, setArchiveItems] = useState<TmdbCatalogItem[]>([]);
  const [archiveLoadedCount, setArchiveLoadedCount] = useState<number>(0);
  const [archiveTotalCount, setArchiveTotalCount] = useState<number>(0);
  const [archiveStreamingDone, setArchiveStreamingDone] = useState<boolean>(false);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(true);
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<string>(
    () => savedState?.genre || 'All'
  );
  const [selectedEraFilter, setSelectedEraFilter] = useState<string>(
    () => savedState?.era || 'All'
  );
  const [sortBy, setSortBy] = useState<'popularity' | 'rating' | 'newest' | 'title'>(
    () => savedState?.sortBy || 'popularity'
  );
  const [archivePage, setArchivePage] = useState<number>(() => savedState?.page || 1);
  const [pageJumpInput, setPageJumpInput] = useState<string>('');
  const [customIdInput, setCustomIdInput] = useState<string>('');

  // Live TMDB search & secondary feeds
  const [debouncedQuery, setDebouncedQuery] = useState<string>(searchQuery.trim());
  const [liveItems, setLiveItems] = useState<TmdbCatalogItem[]>([]);
  const [liveSearchExtra, setLiveSearchExtra] = useState<TmdbCatalogItem[]>([]);
  const [livePage, setLivePage] = useState<number>(1);
  const [liveTotalPages, setLiveTotalPages] = useState<number>(1);
  const [liveTotalResults, setLiveTotalResults] = useState<number>(0);
  const [liveLoading, setLiveLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  // Preserve archive filter/page across watch navigation
  useEffect(() => {
    onStateChange?.({
      feed: activeFeed,
      mediaFilter: archiveMediaFilter,
      genre: selectedGenreFilter,
      era: selectedEraFilter,
      sortBy,
      page: archivePage,
    });
  }, [activeFeed, archiveMediaFilter, selectedGenreFilter, selectedEraFilter, sortBy, archivePage, onStateChange]);

  // Reset mode filter only when top tab switches Movies <-> TV Shows
  const prevModeRef = useRef<'movies' | 'tv'>(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    setHeroIndex(0);
    setDrilldown(null);
    setActiveFeed('archive');
    setArchivePage(1);
    setSelectedGenreFilter('All');
    setSelectedEraFilter('All');
  }, [mode]);

  // Show back-to-top floating button when scrolled down
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 480);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Load curated TMDB rows strictly matching the active mode (Movies or TV Shows)
  useEffect(() => {
    let cancelled = false;
    setShelvesLoading(true);

    if (mode === 'tv') {
      Promise.all([
        fetchTmdbTrendingSplit('tv', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('tv_popular', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('tv_top_rated', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('tv_on_the_air', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
      ]).then(([tTv, popTv, topTv, airTv]) => {
        if (cancelled) return;
        setTrendingShows(tTv.items.filter((i) => i.mediaType === 'tv'));
        setPopularShows(popTv.items.filter((i) => i.mediaType === 'tv'));
        setTopRatedShows(topTv.items.filter((i) => i.mediaType === 'tv'));
        setOnTheAirShows(airTv.items.filter((i) => i.mediaType === 'tv'));
        setCollections([]);
        setShelvesLoading(false);
      });
    } else {
      Promise.all([
        fetchTmdbTrendingSplit('movie', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('movie_popular', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('movie_top_rated', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('movie_now_playing', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
      ]).then(([tMov, popMov, topMov, nowMov]) => {
        if (cancelled) return;
        setTrendingMovies(tMov.items.filter((i) => i.mediaType === 'movie'));
        setPopularMovies(popMov.items.filter((i) => i.mediaType === 'movie'));
        setTopRatedMovies(topMov.items.filter((i) => i.mediaType === 'movie'));
        setNowPlayingMovies(nowMov.items.filter((i) => i.mediaType === 'movie'));
        setShelvesLoading(false);
      });

      fetchTmdbCollectionsBatch(FEATURED_COLLECTION_IDS).then((cols) => {
        if (!cancelled) setCollections(cols);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Hero slides strictly derived from the active section's media type
  const heroSlides = useMemo(() => {
    const pool =
      mode === 'tv'
        ? [...trendingShows, ...popularShows, ...topRatedShows]
        : [...trendingMovies, ...popularMovies, ...topRatedMovies];
    const seen = new Set<string>();
    const unique: TmdbCatalogItem[] = [];
    for (const item of pool) {
      if (item.mediaType === lockedMediaType && item.backdropUrl && !seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
        if (unique.length >= 10) break;
      }
    }
    return unique;
  }, [
    mode,
    lockedMediaType,
    trendingMovies,
    popularMovies,
    topRatedMovies,
    trendingShows,
    popularShows,
    topRatedShows,
  ]);

  // Auto-rotate hero spotlight gently every 9s when viewing main discovery
  useEffect(() => {
    if (heroSlides.length <= 1 || drilldown || searchQuery.trim()) return;
    const id = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 9000);
    return () => window.clearInterval(id);
  }, [heroSlides.length, drilldown, searchQuery]);

  // Debounce search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = searchQuery.trim();
      setDebouncedQuery((prev) => {
        if (prev !== next) setArchivePage(1);
        return next;
      });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  // Check whether 1.51M backend catalog index is available
  useEffect(() => {
    let cancelled = false;
    fetchServerCatalogStats().then((stats) => {
      if (cancelled) return;
      setServerStats(stats);
      setServerCheckDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Query 1.51M Backend Index OR fallback to static 92,000 TMDB chunks (only when searching)
  useEffect(() => {
    if (activeFeed !== 'archive' || !serverCheckDone || !debouncedQuery) return;
    const controller = new AbortController();

    if (serverStats) {
      setServerLoading(true);
      setCatalogError(null);
      queryServerCatalogPage({
        media: archiveMediaFilter,
        q: debouncedQuery,
        genre: selectedGenreFilter,
        era: selectedEraFilter,
        sort: sortBy,
        page: archivePage,
        limit: ARCHIVE_PAGE_SIZE,
        genresMap: serverStats.genres,
        signal: controller.signal,
      })
        .then((res) => {
          if (controller.signal.aborted) return;
          setServerPageItems(res.items);
          setServerTotalItems(res.totalItems);
          setServerTotalPages(res.totalPages);
          setServerScopeNote(res.metadataScopeNote);
          setServerLoading(false);
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          setCatalogError(err?.message || 'Failed querying TMDB catalog index.');
          setServerLoading(false);
        });

      return () => {
        controller.abort();
      };
    }

    // Fallback when running without Express backend
    let hasManifest = true;
    setArchiveLoading(true);
    setArchiveStreamingDone(false);
    setCatalogError(null);

    fetchTmdbArchiveManifest().then((manifest) => {
      if (controller.signal.aborted) return;
      if (!manifest) {
        hasManifest = false;
        setArchiveLoading(false);
        return;
      }
      setArchiveManifest(manifest);

      streamTmdbArchive({
        mediaFilter: archiveMediaFilter,
        signal: controller.signal,
        onProgress: (items, loaded, total, done) => {
          if (controller.signal.aborted || !hasManifest) return;
          setArchiveItems(items);
          setArchiveLoadedCount(loaded);
          setArchiveTotalCount(total);
          setArchiveLoading(false);
          setArchiveStreamingDone(done);
        },
      });
    });

    return () => {
      controller.abort();
    };
  }, [
    activeFeed,
    serverCheckDone,
    serverStats,
    archiveMediaFilter,
    debouncedQuery,
    selectedGenreFilter,
    selectedEraFilter,
    sortBy,
    archivePage,
  ]);

  // Fetch live TMDB typed search results (/search/movie or /search/tv) strictly matching active mode
  useEffect(() => {
    if (!debouncedQuery) {
      setLiveSearchExtra([]);
      return;
    }
    let cancelled = false;
    searchTmdbByType(debouncedQuery, lockedMediaType, 1)
      .then((res) => {
        if (!cancelled) setLiveSearchExtra(res.items);
      })
      .catch(() => {
        if (!cancelled) setLiveSearchExtra([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, lockedMediaType]);

  // Secondary live TMDB feed loader (when activeFeed !== 'archive')
  const loadLiveFeedPage = useCallback(
    async (pageNum: number, append = false) => {
      if (activeFeed === 'archive') return;
      if (append) setLoadingMore(true);
      else setLiveLoading(true);
      setCatalogError(null);

      try {
        const res = debouncedQuery
          ? await searchTmdbByType(debouncedQuery, lockedMediaType, pageNum)
          : await fetchTmdbFeed(activeFeed, pageNum);

        const scopedItems = res.items.filter((i) => i.mediaType === lockedMediaType);

        setLivePage(res.page);
        setLiveTotalPages(res.totalPages);
        setLiveTotalResults(res.totalResults);

        setLiveItems((prev) => {
          if (!append) return scopedItems;
          const seen = new Set(prev.map((i) => i.id));
          const merged = [...prev];
          for (const item of scopedItems) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              merged.push(item);
            }
          }
          return merged;
        });
      } catch (err: any) {
        setCatalogError(err?.message || 'Unable to load titles from TMDB.');
      } finally {
        setLiveLoading(false);
        setLoadingMore(false);
      }
    },
    [activeFeed, debouncedQuery, lockedMediaType]
  );

  useEffect(() => {
    if (activeFeed !== 'archive') {
      loadLiveFeedPage(1, false);
    }
  }, [activeFeed, loadLiveFeedPage]);

  // Network / Studio / Collection drill-down openers (strictly scoped to active mode)
  const openNetworkDrilldown = async (network: NetworkBrandItem, page = 1, append = false) => {
    setDrilldown({ kind: 'network', network });
    setDrilldownLoading(true);
    if (!append) window.scrollTo({ top: 0, behavior: 'smooth' });
    const res = await fetchTmdbNetworkContent(
      network.tvNetworkId,
      network.watchProviderId,
      lockedMediaType,
      page
    );
    const scoped = res.items.filter((i) => i.mediaType === lockedMediaType);
    setDrilldownPage(res.page);
    setDrilldownTotalPages(res.totalPages);
    setDrilldownItems((prev) => {
      if (!append) return scoped;
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...scoped.filter((i) => !seen.has(i.id))];
    });
    setDrilldownLoading(false);
  };

  const openStudioDrilldown = async (studio: StudioBrandItem, page = 1, append = false) => {
    setDrilldown({ kind: 'studio', studio });
    setDrilldownLoading(true);
    if (!append) window.scrollTo({ top: 0, behavior: 'smooth' });
    const res = await fetchTmdbStudioContent(
      studio.companyId,
      lockedMediaType,
      page,
      studio.tvCompanyId
    );
    const scoped = res.items.filter((i) => i.mediaType === lockedMediaType);
    setDrilldownPage(res.page);
    setDrilldownTotalPages(res.totalPages);
    setDrilldownItems((prev) => {
      if (!append) return scoped;
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...scoped.filter((i) => !seen.has(i.id))];
    });
    setDrilldownLoading(false);
  };

  const openCollectionDrilldown = (collection: TmdbCollectionSummary) => {
    setDrilldown({ kind: 'collection', collection });
    setDrilldownItems(collection.parts);
    setDrilldownPage(1);
    setDrilldownTotalPages(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPoster = (media: TmdbCatalogItem) => {
    onSelectMedia({
      mediaType: media.mediaType,
      tmdbId: media.tmdbId,
      previewItem: media,
    });
  };

  const handleCustomIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customIdInput.trim();
    if (!cleaned) return;

    if (isImdbId(cleaned)) {
      const resolved = await findByImdbId(cleaned);
      if (resolved) {
        onSelectMedia({
          mediaType: resolved.mediaType,
          tmdbId: resolved.tmdbId,
          customRawId: cleaned,
        });
        return;
      }
    }

    onSelectMedia({
      mediaType: mode === 'tv' ? 'tv' : 'movie',
      tmdbId: cleaned,
    });
  };

  const availableGenres = useMemo(() => {
    const genreSource = serverStats?.genres || archiveManifest?.genres;
    if (!genreSource) return ['All'];
    const names = Array.from(new Set(Object.values(genreSource))).sort();
    return ['All', ...names];
  }, [serverStats, archiveManifest]);

  const filteredArchiveItems = useMemo(() => {
    if (activeFeed !== 'archive' || serverStats) return [];
    const q = searchQuery.trim().toLowerCase();

    let source = archiveItems;
    if (q && liveSearchExtra.length > 0) {
      const seen = new Set(archiveItems.map((i) => i.id));
      const extras = liveSearchExtra.filter((i) => {
        if (seen.has(i.id)) return false;
        if (i.mediaType !== archiveMediaFilter) return false;
        return true;
      });
      if (extras.length > 0) {
        source = [...extras, ...archiveItems];
      }
    }

    const filtered = source.filter((item) => {
      if (q) {
        const matchesText =
          item.title.toLowerCase().includes(q) ||
          item.tmdbId === q ||
          item.genreNames.some((g) => g.toLowerCase().includes(q));
        if (!matchesText) return false;
      }

      if (selectedGenreFilter !== 'All') {
        if (!item.genreNames.includes(selectedGenreFilter)) return false;
      }

      if (selectedEraFilter !== 'All') {
        const y = parseInt(item.year, 10);
        if (!Number.isFinite(y)) return false;
        if (selectedEraFilter === '2020s' && y < 2020) return false;
        if (selectedEraFilter === '2010s' && (y < 2010 || y > 2019)) return false;
        if (selectedEraFilter === '2000s' && (y < 2000 || y > 2009)) return false;
        if (selectedEraFilter === '1990s' && (y < 1990 || y > 1999)) return false;
        if (selectedEraFilter === '1980s' && (y < 1980 || y > 1989)) return false;
        if (selectedEraFilter === 'Classic' && y >= 1980) return false;
      }

      return true;
    });

    if (sortBy === 'rating') {
      return [...filtered].sort((a, b) => {
        const scoreA = a.voteCount >= 20 ? a.voteAverage : a.voteAverage * 0.6;
        const scoreB = b.voteCount >= 20 ? b.voteAverage : b.voteAverage * 0.6;
        return scoreB - scoreA;
      });
    }
    if (sortBy === 'newest') {
      return [...filtered].sort((a, b) =>
        (b.releaseDate || '').localeCompare(a.releaseDate || '')
      );
    }
    if (sortBy === 'title') {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }
    return filtered;
  }, [
    activeFeed,
    serverStats,
    archiveItems,
    liveSearchExtra,
    archiveMediaFilter,
    searchQuery,
    selectedGenreFilter,
    selectedEraFilter,
    sortBy,
  ]);

  const archiveTotalPages = serverStats
    ? serverTotalPages
    : Math.max(1, Math.ceil(filteredArchiveItems.length / ARCHIVE_PAGE_SIZE));
  const clampedArchivePage = Math.min(archivePage, archiveTotalPages);

  const displayedItems = useMemo(() => {
    const raw =
      activeFeed !== 'archive'
        ? liveItems
        : serverStats
        ? serverPageItems
        : filteredArchiveItems.slice(
            (clampedArchivePage - 1) * ARCHIVE_PAGE_SIZE,
            clampedArchivePage * ARCHIVE_PAGE_SIZE
          );
    return raw.filter((item) => item.mediaType === lockedMediaType);
  }, [
    activeFeed,
    serverStats,
    serverPageItems,
    liveItems,
    filteredArchiveItems,
    clampedArchivePage,
    lockedMediaType,
  ]);

  const currentPage = activeFeed === 'archive' ? clampedArchivePage : livePage;
  const currentTotalPages = activeFeed === 'archive' ? archiveTotalPages : liveTotalPages;
  const isLoading =
    activeFeed === 'archive'
      ? !serverCheckDone || (serverStats ? serverLoading : archiveLoading)
      : liveLoading;

  const goToCatalogPage = (pageNum: number) => {
    const target = Math.max(1, Math.min(currentTotalPages, pageNum));
    if (activeFeed === 'archive') {
      setArchivePage(target);
      fullCatalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      loadLiveFeedPage(target, false);
      fullCatalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(pageJumpInput, 10);
    if (Number.isFinite(num) && num >= 1) {
      goToCatalogPage(num);
      setPageJumpInput('');
    }
  };

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, currentPage - half);
    const end = Math.min(currentTotalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    const nums: number[] = [];
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  }, [currentPage, currentTotalPages]);

  const activeHero = heroSlides[heroIndex % Math.max(1, heroSlides.length)] || null;
  const isHeroSaved = activeHero ? watchlist.some((w) => w.id === activeHero.id) : false;

  const scrollCollections = (dir: 'left' | 'right') => {
    const el = collectionsTrackRef.current;
    if (!el) return;
    const delta = Math.max(360, el.clientWidth * 0.75);
    el.scrollBy({ left: dir === 'right' ? delta : -delta, behavior: 'smooth' });
  };

  // ============================================================================
  // DRILL-DOWN VIEW: Selected Network, Studio, Collection, or All Collections
  // ============================================================================
  if (drilldown && !searchQuery.trim()) {
    return (
      <section className="space-y-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#202026] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrilldown(null)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#141418] hover:bg-[#222228] border border-[#27272e] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <ArrowLeft size={15} />
              <span>Back to Browse</span>
            </button>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">
                {drilldown.kind === 'network'
                  ? drilldown.network.name
                  : drilldown.kind === 'studio'
                  ? drilldown.studio.name
                  : drilldown.kind === 'collection'
                  ? drilldown.collection.name
                  : 'All Collections'}
              </h2>
              <p className="text-xs text-neutral-400">
                {drilldown.kind === 'collection'
                  ? `${drilldown.collection.movieCount} movies in this collection`
                  : drilldown.kind === 'all_collections'
                  ? `${collections.length} curated saga collections`
                  : mode === 'tv'
                  ? 'Click any TV show poster to watch'
                  : 'Click any movie poster to watch'}
              </p>
            </div>
          </div>
        </div>

        {drilldown.kind === 'all_collections' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((col) => {
              const colImage =
                COLLECTION_IMAGE_OVERRIDES[col.id] || col.backdropUrl || col.posterUrl;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => openCollectionDrilldown(col)}
                  className="group relative aspect-[16/9] rounded-2xl overflow-hidden bg-[#141418] border border-[#27272d] hover:border-white/30 text-left cursor-pointer shadow-xl"
                >
                  {colImage && (
                    <img
                      src={colImage}
                      alt={col.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />
                  <div className="absolute bottom-3.5 left-4 right-4">
                    <div className="text-base font-extrabold text-white">{col.name}</div>
                    <div className="text-xs text-neutral-300 mt-0.5">{col.movieCount} movies</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : drilldownLoading && drilldownItems.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="aspect-[2/3] rounded-xl bg-[#16161b]" />
                <div className="h-3 w-28 rounded bg-[#202028]" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {drilldownItems.map((media) => (
                <CinemaPosterCard
                  key={media.id}
                  media={media}
                  onSelect={handleOpenPoster}
                />
              ))}
            </div>

            {drilldown.kind !== 'collection' && drilldownPage < drilldownTotalPages && (
              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  disabled={drilldownLoading}
                  onClick={() => {
                    if (drilldown.kind === 'network') {
                      openNetworkDrilldown(drilldown.network, drilldownPage + 1, true);
                    } else if (drilldown.kind === 'studio') {
                      openStudioDrilldown(drilldown.studio, drilldownPage + 1, true);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {drilldownLoading ? 'Loading...' : `Load More Titles (Page ${drilldownPage + 1})`}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    );
  }

  // ============================================================================
  // ACTIVE SEARCH VIEW (Instant Search across 92,000+ Archive + TMDB Search)
  // ============================================================================
  const hasSearchQuery = Boolean(searchQuery.trim());

  return (
    <div className="space-y-10 pb-16">
      {!hasSearchQuery && (
        <>
          {/* 1. CINEMA HERO SPOTLIGHT CAROUSEL */}
          {activeHero && (
            <section className="relative rounded-2xl overflow-hidden bg-[#121216] border border-[#232329] min-h-[320px] sm:min-h-[420px] lg:min-h-[460px] flex items-end shadow-2xl">
              {activeHero.backdropUrl && (
                <img
                  key={activeHero.id}
                  src={activeHero.backdropUrl}
                  alt={activeHero.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#08080a] via-[#08080a]/70 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-transparent to-black/30" />

              {/* Top-right carousel slide indicator bars */}
              {heroSlides.length > 1 && (
                <div className="absolute top-4 right-5 z-20 flex items-center gap-1.5">
                  {heroSlides.map((slide, idx) => (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Show featured slide ${idx + 1}: ${slide.title}`}
                      onClick={() => setHeroIndex(idx)}
                      className={`h-1 rounded-full transition-all cursor-pointer ${
                        idx === heroIndex
                          ? 'w-7 bg-white'
                          : 'w-4 bg-white/30 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Hero Title, Synopsis & Play / + Buttons */}
              <div className="relative z-10 p-6 sm:p-10 max-w-2xl space-y-3.5">
                <div className="flex items-center gap-2.5 text-xs font-bold text-neutral-300 tabular-nums">
                  <span className="uppercase tracking-widest text-white/80">
                    {activeHero.mediaType === 'tv' ? 'Featured Series' : 'Featured Film'}
                  </span>
                  {activeHero.year && activeHero.year !== 'N/A' && (
                    <>
                      <span className="text-neutral-500">·</span>
                      <span>{activeHero.year}</span>
                    </>
                  )}
                  {activeHero.voteAverage > 0 && (
                    <>
                      <span className="text-neutral-500">·</span>
                      <span className="inline-flex items-center gap-1 text-white">
                        <Star size={12} className="text-[#22c55e] fill-[#22c55e]" />
                        {activeHero.voteAverage.toFixed(1)}
                      </span>
                    </>
                  )}
                </div>

                <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase text-white leading-[1.02] drop-shadow-lg">
                  {activeHero.title}
                </h2>

                <p className="text-xs sm:text-sm text-neutral-200/90 leading-relaxed line-clamp-2">
                  {activeHero.overview}
                </p>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenPoster(activeHero)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs sm:text-sm font-extrabold transition-colors shadow-lg cursor-pointer"
                  >
                    <Play size={15} fill="currentColor" />
                    <span>Play</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWatchlist(activeHero)}
                    title={isHeroSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    aria-label={isHeroSaved ? 'Remove from Watchlist' : 'Add to Watchlist'}
                    className="w-10 h-10 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white grid place-items-center transition-colors backdrop-blur-sm cursor-pointer"
                  >
                    {isHeroSaved ? <Check size={17} /> : <Plus size={17} />}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* 2, 3, 4 & 5. STRICTLY SEPARATED MOVIES OR TV SHOWS SHELVES */}
          {mode === 'tv' ? (
            <>
              <HorizontalPosterShelf
                title="Trending Shows"
                items={trendingShows}
                loading={shelvesLoading}
                onSelect={handleOpenPoster}
              />
              <HorizontalPosterShelf
                title="Popular Shows"
                items={popularShows}
                loading={shelvesLoading}
                onSelect={handleOpenPoster}
              />
              <HorizontalPosterShelf
                title="Top Rated Shows"
                items={topRatedShows}
                loading={shelvesLoading}
                onSelect={handleOpenPoster}
              />
              <HorizontalPosterShelf
                title="On The Air"
                items={onTheAirShows}
                loading={shelvesLoading}
                onSelect={handleOpenPoster}
              />
            </>
          ) : (
            <>
              <HorizontalPosterShelf
                title="Trending Movies"
                items={trendingMovies}
                loading={shelvesLoading}
                onSelect={handleOpenPoster}
              />
              <HorizontalPosterShelf
                title="Popular Movies"
                items={popularMovies}
                loading={shelvesLoading}
                onSelect={handleOpenPoster}
              />
              <HorizontalPosterShelf
                title="Top Rated Movies"
                items={topRatedMovies}
                loading={shelvesLoading}
                onSelect={handleOpenPoster}
              />
              <HorizontalPosterShelf
                title="Now Playing"
                items={nowPlayingMovies}
                loading={shelvesLoading}
                onSelect={handleOpenPoster}
              />
            </>
          )}

          {/* 6. POPULAR NETWORKS */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Popular Networks
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Jump straight to content from your favorite services
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {POPULAR_NETWORKS.map((net) => (
                <button
                  key={net.id}
                  type="button"
                  onClick={() => openNetworkDrilldown(net, 1, false)}
                  aria-label={net.name}
                  title={`Browse ${net.name}`}
                  className={`group h-28 sm:h-32 rounded-xl border overflow-hidden flex items-center justify-center transition-all hover:scale-[1.03] hover:ring-2 hover:ring-white/30 cursor-pointer shadow-lg ${
                    net.imageFit === 'cover' ? 'p-0' : 'p-2.5'
                  } ${net.cardBg}`}
                >
                  <img
                    src={net.logoUrl}
                    alt={net.name}
                    className={`w-full h-full transition-transform duration-200 group-hover:scale-105 ${
                      net.imageFit === 'cover' ? 'object-cover' : 'object-contain'
                    }`}
                  />
                </button>
              ))}
            </div>
          </section>

          {/* 7. STUDIOS */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Studios
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {FEATURED_STUDIOS.map((studio) => (
                <button
                  key={studio.id}
                  type="button"
                  onClick={() => openStudioDrilldown(studio, 1, false)}
                  aria-label={studio.name}
                  title={`Browse ${studio.name}`}
                  className="group h-24 sm:h-28 rounded-xl bg-[#efefef] hover:bg-white border border-white/20 px-5 py-3.5 sm:px-6 sm:py-4 flex items-center justify-center overflow-hidden transition-all hover:scale-[1.02] shadow-md cursor-pointer"
                >
                  <img
                    src={studio.logoUrl}
                    alt={studio.name}
                    className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          </section>

          {/* 8. COLLECTIONS (Movies-only sagas) */}
          {mode === 'movies' && collections.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                    Collections
                  </h2>
                  <button
                    type="button"
                    onClick={() => setDrilldown({ kind: 'all_collections' })}
                    className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Explore All
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollCollections('left')}
                    aria-label="Scroll Collections left"
                    className="w-8 h-8 rounded-lg bg-[#141418] hover:bg-[#23232a] border border-[#27272d] text-neutral-200 grid place-items-center transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCollections('right')}
                    aria-label="Scroll Collections right"
                    className="w-8 h-8 rounded-lg bg-[#141418] hover:bg-[#23232a] border border-[#27272d] text-neutral-200 grid place-items-center transition-colors cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              <div
                ref={collectionsTrackRef}
                className="flex gap-3.5 overflow-x-auto pb-2 scroll-smooth"
                style={{ scrollbarWidth: 'none' }}
              >
                {collections.map((col) => {
                  const colImage =
                    COLLECTION_IMAGE_OVERRIDES[col.id] || col.backdropUrl || col.posterUrl;
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => openCollectionDrilldown(col)}
                      className="group relative w-[270px] sm:w-[310px] aspect-[16/9] shrink-0 rounded-xl overflow-hidden bg-[#141418] border border-[#27272d] hover:border-white/30 text-left cursor-pointer shadow-lg"
                    >
                      {colImage && (
                        <img
                          src={colImage}
                          alt={col.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />
                      <div className="absolute bottom-3 left-3.5 right-3.5">
                        <div className="text-sm sm:text-base font-extrabold text-white truncate">
                          {col.name}
                        </div>
                        <div className="text-[11px] font-medium text-neutral-300 mt-0.5">
                          {col.movieCount} movies
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 9. MY WATCHLIST (Filtered to active section: Movies or TV Shows) */}
          {modeWatchlist.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Bookmark size={16} className="text-[#22c55e]" />
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  My Watchlist ({modeWatchlist.length})
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {modeWatchlist.map((media) => (
                  <CinemaPosterCard
                    key={`wl-${media.id}`}
                    media={media}
                    onSelect={handleOpenPoster}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* 10. CLEAN SEARCH RESULTS VIEW (Only rendered while searching; normal browse ends cleanly after Collections) */}
      {hasSearchQuery && (
      <section ref={fullCatalogRef} className="space-y-5 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
              <Search size={17} className="text-neutral-300" />
              <span>Results for &ldquo;{searchQuery.trim()}&rdquo;</span>
            </h2>
            <p className="text-xs text-neutral-400 tabular-nums">
              {activeFeed === 'archive'
                ? serverStats
                  ? serverLoading
                    ? 'Loading TMDB catalog page...'
                    : `${serverTotalItems.toLocaleString()} titles (${(archiveMediaFilter === 'movie'
                        ? serverStats.moviesCount
                        : archiveMediaFilter === 'tv'
                        ? serverStats.tvCount
                        : serverStats.totalTitles
                      ).toLocaleString()} indexed) · Page ${clampedArchivePage.toLocaleString()} of ${archiveTotalPages.toLocaleString()}`
                  : archiveLoading
                  ? 'Loading TMDB catalog...'
                  : `${filteredArchiveItems.length.toLocaleString()} titles (${archiveLoadedCount.toLocaleString()} / ${(archiveTotalCount || archiveManifest?.totalTitles || 92000).toLocaleString()} indexed${archiveStreamingDone ? '' : ' · loading shards...'}) · Page ${clampedArchivePage.toLocaleString()} of ${archiveTotalPages.toLocaleString()}`
                : liveLoading
                ? 'Loading TMDB...'
                : `Showing ${liveItems.length} · Page ${livePage} of ${liveTotalPages.toLocaleString()} (${liveTotalResults.toLocaleString()} titles)`}
            </p>
            {activeFeed === 'archive' && serverScopeNote && (
              <p className="text-[11px] text-neutral-500">{serverScopeNote}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {hasSearchQuery && onClearSearch && (
              <button
                type="button"
                onClick={onClearSearch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-colors cursor-pointer"
              >
                <X size={13} />
                <span>Clear Search</span>
              </button>
            )}

            {modeFeeds.map((feed) => {
              const isSelected = activeFeed === feed.key;
              const scopedCount =
                mode === 'tv'
                  ? serverStats?.tvCount || archiveManifest?.tvCount
                  : serverStats?.moviesCount || archiveManifest?.moviesCount;
              const displayLabel =
                feed.key === 'archive'
                  ? scopedCount
                    ? `${mode === 'tv' ? 'TV Catalog' : 'Movies Catalog'} (${scopedCount.toLocaleString()})`
                    : mode === 'tv'
                    ? 'Full TV Catalog'
                    : 'Full Movies Catalog'
                  : feed.label;
              return (
                <button
                  key={feed.key}
                  type="button"
                  onClick={() => {
                    setActiveFeed(feed.key);
                    setArchivePage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-white text-black border-white'
                      : 'bg-[#141418] text-neutral-300 border-[#27272d] hover:bg-[#1e1e24] hover:text-white'
                  }`}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Archive Facet Bar (Strictly locked to Movies or TV Shows) */}
        {activeFeed === 'archive' && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#111115] border border-[#232329]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-black border-white whitespace-nowrap tabular-nums">
                {mode === 'tv'
                  ? `TV Shows (${(serverStats?.tvCount || archiveManifest?.tvCount || 237189).toLocaleString()})`
                  : `Movies (${(serverStats?.moviesCount || archiveManifest?.moviesCount || 1276553).toLocaleString()})`}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by genre"
                value={selectedGenreFilter}
                onChange={(e) => {
                  setSelectedGenreFilter(e.target.value);
                  setArchivePage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#18181d] border border-[#2a2a32] text-xs font-semibold text-neutral-200 outline-none focus:border-white/40 cursor-pointer"
              >
                {availableGenres.map((g) => (
                  <option key={g} value={g}>
                    {g === 'All' ? 'All Genres' : g}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by decade"
                value={selectedEraFilter}
                onChange={(e) => {
                  setSelectedEraFilter(e.target.value);
                  setArchivePage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#18181d] border border-[#2a2a32] text-xs font-semibold text-neutral-200 outline-none focus:border-white/40 cursor-pointer"
              >
                <option value="All">All Years</option>
                <option value="2020s">2020s</option>
                <option value="2010s">2010s</option>
                <option value="2000s">2000s</option>
                <option value="1990s">1990s</option>
                <option value="1980s">1980s</option>
                <option value="Classic">Pre-1980 Classics</option>
              </select>

              <select
                aria-label="Sort titles"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setArchivePage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#18181d] border border-[#2a2a32] text-xs font-semibold text-neutral-200 outline-none focus:border-white/40 cursor-pointer"
              >
                <option value="popularity">Sort: Popularity</option>
                <option value="rating">Sort: Top Rated</option>
                <option value="newest">Sort: Newest Release</option>
                <option value="title">Sort: Title (A-Z)</option>
              </select>

              <form onSubmit={handleCustomIdSubmit} className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={customIdInput}
                  onChange={(e) => setCustomIdInput(e.target.value)}
                  placeholder="TMDB ID or tt..."
                  className="w-32 px-2.5 py-1.5 rounded-lg bg-[#09090b] border border-[#2a2a32] focus:border-white/40 outline-none text-xs font-mono text-white placeholder:text-neutral-500"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 rounded-lg border border-[#2a2a32] bg-[#18181d] hover:bg-[#23232b] text-xs font-bold text-neutral-200 cursor-pointer whitespace-nowrap"
                >
                  Open ID
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Full Posters Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {Array.from({ length: 18 }).map((_, idx) => (
              <div key={idx} className="space-y-2 animate-pulse">
                <div className="aspect-[2/3] rounded-xl bg-[#16161b]" />
                <div className="h-3 w-28 rounded bg-[#202028]" />
              </div>
            ))}
          </div>
        ) : catalogError ? (
          <div className="empty-state border border-[#232329] rounded-2xl p-8 bg-[#111115]">
            <AlertCircle size={34} className="text-rose-400" />
            <h3>Failed to fetch TMDB catalog</h3>
            <p>{catalogError}</p>
            <button
              type="button"
              onClick={() => loadLiveFeedPage(1, false)}
              className="mt-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-neutral-200 text-xs font-bold cursor-pointer"
            >
              Retry TMDB Fetch
            </button>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="empty-state border border-[#232329] rounded-2xl p-8 bg-[#111115]">
            <h3>No titles match your filters</h3>
            <p>
              Try clearing your search or resetting the genre/year filter to browse all{' '}
              {(archiveManifest?.totalTitles || 92000).toLocaleString()}+ titles.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {displayedItems.map((media) => (
                <CinemaPosterCard
                  key={media.id}
                  media={media}
                  onSelect={handleOpenPoster}
                />
              ))}
            </div>

            {/* Clean Obsidian Pagination */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-[#1e1e24]">
              {activeFeed !== 'archive' && livePage < liveTotalPages ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => loadLiveFeedPage(livePage + 1, true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-extrabold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Loading Page {livePage + 1}...</span>
                    </>
                  ) : (
                    <span>Load More Titles (Page {livePage + 1})</span>
                  )}
                </button>
              ) : (
                <div className="text-xs text-neutral-400 tabular-nums">
                  Page <strong className="text-white">{currentPage.toLocaleString()}</strong> of{' '}
                  <strong className="text-white">{currentTotalPages.toLocaleString()}</strong>
                  {activeFeed === 'archive' &&
                    ` (${(serverStats ? serverTotalItems : filteredArchiveItems.length).toLocaleString()} titles · 50/page)`}
                </div>
              )}

              {currentTotalPages > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || isLoading}
                    onClick={() => goToCatalogPage(1)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#27272d] bg-[#141418] hover:bg-[#222229] text-xs font-bold text-neutral-200 disabled:opacity-40 cursor-pointer"
                  >
                    1
                  </button>
                  <button
                    type="button"
                    disabled={currentPage <= 1 || isLoading}
                    onClick={() => goToCatalogPage(currentPage - 1)}
                    className="px-3 py-1.5 rounded-lg border border-[#27272d] bg-[#141418] hover:bg-[#222229] text-xs font-bold text-neutral-200 disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>

                  {pageNumbers.map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isLoading}
                      onClick={() => goToCatalogPage(num)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                        num === currentPage
                          ? 'bg-white border-white text-black'
                          : 'bg-[#141418] border-[#27272d] text-neutral-300 hover:bg-[#222229]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={currentPage >= currentTotalPages || isLoading}
                    onClick={() => goToCatalogPage(currentPage + 1)}
                    className="px-3 py-1.5 rounded-lg border border-[#27272d] bg-[#141418] hover:bg-[#222229] text-xs font-bold text-neutral-200 disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>

                  <form onSubmit={handlePageJumpSubmit} className="inline-flex items-center gap-1 ml-1">
                    <input
                      type="number"
                      min={1}
                      max={currentTotalPages}
                      value={pageJumpInput}
                      onChange={(e) => setPageJumpInput(e.target.value)}
                      placeholder="Page #"
                      className="w-16 px-2 py-1.5 rounded-lg bg-[#09090b] border border-[#27272d] focus:border-white/40 outline-none text-xs text-white placeholder:text-neutral-500"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 rounded-lg border border-[#27272d] bg-[#141418] hover:bg-[#222229] text-xs font-bold text-neutral-200 cursor-pointer"
                    >
                      Go
                    </button>
                  </form>
                </div>
              )}
            </div>
          </>
        )}
      </section>
      )}

      {/* Scroll to Top Floating Circle (like screenshot bottom-right ^) */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
          className="fixed bottom-5 right-5 z-30 w-10 h-10 rounded-full bg-[#18181d]/95 hover:bg-[#27272f] border border-[#32323b] text-white grid place-items-center shadow-2xl transition-colors cursor-pointer"
        >
          <ArrowUp size={16} />
        </button>
      )}
    </div>
  );
};

export default MoviesSection;
