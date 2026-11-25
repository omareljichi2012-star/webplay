import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play,
  Plus,
  Check,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ArrowUp,
  Search,
  X,
  Loader2,
  AlertCircle,
  Bookmark,
  Info,
  ThumbsUp,
  Heart,
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
  fetchTmdbAnimeFeed,
  fetchTmdbArchiveManifest,
  fetchTmdbCartoonsFeed,
  fetchTmdbCollectionsBatch,
  fetchTmdbFeed,
  fetchTmdbNetworkContent,
  fetchTmdbStudioContent,
  fetchTmdbTrendingSplit,
  findByImdbId,
  formatReleaseNote,
  isKidsCartoonSafe,
  isUpcomingDate,
  queryServerCatalogPage,
  searchTmdbAnimation,
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
import { useTheme } from '../context/ThemeContext';
import { NetflixInfoModal } from './NetflixInfoModal';
import { PopcornDetailView } from './PopcornDetailView';

const ARCHIVE_PAGE_SIZE = 50;

export type CinemaSectionMode = 'movies' | 'tv' | 'anime' | 'cartoons';

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
  mode?: CinemaSectionMode;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSelectMedia: (target: MoviePlayerTarget) => void;
  savedState?: MoviesCatalogState | null;
  onStateChange?: (state: MoviesCatalogState) => void;
  showMyListOnly?: boolean;
  onCloseMyList?: () => void;
}

function computeMatchPercent(voteAverage: number): number {
  if (!voteAverage || voteAverage <= 0) return 94;
  return Math.min(99, Math.max(76, Math.round(voteAverage * 10 + 18)));
}

/**
 * Classic Popcorn Time zero-gap stuck-together poster tile (Screenshots 2 & 4).
 */
const PopcornPosterTile: React.FC<{
  media: TmdbCatalogItem;
  onSelect: (media: TmdbCatalogItem) => void;
}> = ({ media, onSelect }) => {
  const { isInMyList, toggleMyList } = useTheme();
  const saved = isInMyList(media.id);
  const yearLabel = media.year && media.year !== 'N/A' ? media.year : '';
  const isUpcoming = isUpcomingDate(media.releaseDate);
  const starCount = Math.round(Math.min(5, Math.max(1, (media.voteAverage || 7.2) / 2)));

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(media)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(media);
        }
      }}
      className="group relative aspect-[2/3] w-full overflow-hidden bg-[#10131c] cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3fa9f5]"
    >
      <img
        src={media.posterUrl}
        alt={media.title}
        referrerPolicy="no-referrer"
        onError={(e) =>
          handlePosterImageError(e, media.title, media.mediaType === 'tv' ? 'TV Shows' : 'Movies')
        }
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {isUpcoming && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-2 pt-5 pb-1.5 pointer-events-none">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 truncate">
            Upcoming · {formatReleaseNote(media.releaseDate, 'TBA')}
          </div>
        </div>
      )}

      {/* Popcorn Time translucent hover veil (Title, Heart + Year, 5 Blue Stars) */}
      <div className="absolute inset-0 bg-[#0d111a]/62 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-between px-2.5 pt-11 pb-3 text-center backdrop-blur-[1px]">
        <div className="w-full space-y-1.5">
          <h3 className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide text-white line-clamp-2 leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
            {media.title}
          </h3>
          <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-neutral-100 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleMyList(media);
              }}
              aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
              className={`hover:scale-110 transition-transform cursor-pointer ${
                saved ? 'text-[#3fa9f5]' : 'text-white/90 hover:text-white'
              }`}
            >
              <Heart size={12} className={saved ? 'fill-current' : ''} />
            </button>
            {isUpcoming ? (
              <span className="text-amber-400">Upcoming</span>
            ) : (
              yearLabel && <span className="tabular-nums">{yearLabel}</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-0.5 pb-1.5" aria-label={`${media.voteAverage.toFixed(1)} rating`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={11}
              className={
                n <= starCount
                  ? 'text-[#3fa9f5] fill-[#3fa9f5] drop-shadow-[0_0_5px_rgba(63,169,245,0.9)]'
                  : 'text-white/35'
              }
            />
          ))}
        </div>
      </div>
    </article>
  );
};

/**
 * Reusable poster card supporting Obsidian Cinema and Netflix Replica themes.
 */
const CinemaPosterCard: React.FC<{
  media: TmdbCatalogItem;
  onSelect: (media: TmdbCatalogItem) => void;
  onOpenInfo?: (media: TmdbCatalogItem) => void;
  className?: string;
}> = ({ media, onSelect, onOpenInfo, className = '' }) => {
  const { isNetflix, isInMyList, toggleMyList, isLiked, toggleLike } = useTheme();
  const yearLabel = media.year && media.year !== 'N/A' ? media.year : '';
  const isUpcoming = isUpcomingDate(media.releaseDate);
  const saved = isInMyList(media.id);
  const liked = isLiked(media.id);
  const matchPct = computeMatchPercent(media.voteAverage);

  return (
    <article
      onClick={() => onSelect(media)}
      className={`group flex flex-col cursor-pointer select-none ${className}`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(media);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(media);
          }
        }}
        aria-label={`Play ${media.title}`}
        className={`relative aspect-[2/3] w-full overflow-hidden border transition-all duration-200 ${
          isNetflix
            ? 'rounded-md bg-[#181818] border-white/5 group-hover:border-white/35 group-hover:scale-[1.03] shadow-xl'
            : 'rounded-xl bg-[#141418] border-white/5 group-hover:border-white/25 group-hover:-translate-y-1 shadow-lg'
        }`}
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

        {isUpcoming && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-2.5 pt-6 pb-2 pointer-events-none">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 truncate">
              Upcoming · {formatReleaseNote(media.releaseDate, 'Not out yet')}
            </div>
          </div>
        )}

        {isNetflix ? (
          <>
            {/* Top-left subtle Netflix N corner mark */}
            <div className="absolute top-1.5 left-2 font-netflix-display text-xl text-[#E50914] leading-none drop-shadow pointer-events-none">
              N
            </div>

            {/* Netflix hover scrim + quick action controls */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2.5 gap-2">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(media);
                    }}
                    aria-label={`Play ${media.title}`}
                    className="w-8 h-8 rounded-full bg-white hover:bg-neutral-200 text-black grid place-items-center transition-colors cursor-pointer"
                  >
                    <Play size={14} fill="currentColor" className="ml-0.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMyList(media);
                    }}
                    aria-label={saved ? 'Remove from My List' : 'Add to My List'}
                    className="w-8 h-8 rounded-full bg-[#202020]/90 hover:bg-[#323232] border border-white/40 text-white grid place-items-center transition-colors cursor-pointer"
                  >
                    {saved ? <Check size={14} /> : <Plus size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(media.id);
                    }}
                    aria-label={liked ? 'Remove Like' : 'Like'}
                    className={`w-8 h-8 rounded-full border grid place-items-center transition-colors cursor-pointer ${
                      liked
                        ? 'bg-white text-black border-white'
                        : 'bg-[#202020]/90 hover:bg-[#323232] border-white/40 text-white'
                    }`}
                  >
                    <ThumbsUp size={13} />
                  </button>
                </div>

                {onOpenInfo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenInfo(media);
                    }}
                    aria-label={`More info for ${media.title}`}
                    className="w-8 h-8 rounded-full bg-[#202020]/90 hover:bg-[#323232] border border-white/40 text-white grid place-items-center transition-colors cursor-pointer"
                  >
                    <ChevronDown size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                {isUpcoming ? (
                  <span className="text-amber-400">Upcoming</span>
                ) : (
                  <span className="text-[#46d369]">{matchPct}% Match</span>
                )}
                <span className="text-neutral-300">{yearLabel}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Top-left rating badge with green star */}
            {media.voteAverage > 0 && !isUpcoming && (
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
          </>
        )}
      </div>

      {/* Clean minimal footer below poster */}
      <div className="pt-2 px-0.5 space-y-0.5 min-w-0">
        <div className="flex items-center justify-between text-[10px] font-semibold tracking-wider text-neutral-400 uppercase tabular-nums">
          <span>{media.mediaType === 'tv' ? 'TV' : 'MOVIE'}</span>
          {isUpcoming ? (
            <span className="text-amber-400 font-bold">Upcoming</span>
          ) : (
            <span>{yearLabel}</span>
          )}
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
  onOpenInfo?: (media: TmdbCatalogItem) => void;
}> = ({ title, items, loading = false, onSelect, onOpenInfo }) => {
  const { isNetflix } = useTheme();
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
            className={`w-8 h-8 rounded-lg border text-neutral-200 grid place-items-center transition-colors cursor-pointer ${
              isNetflix
                ? 'bg-[#181818] hover:bg-[#2a2a2a] border-[#2e2e2e]'
                : 'bg-[#141418] hover:bg-[#23232a] border-[#27272d]'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollTrack('right')}
            aria-label={`Scroll ${title} right`}
            className={`w-8 h-8 rounded-lg border text-neutral-200 grid place-items-center transition-colors cursor-pointer ${
              isNetflix
                ? 'bg-[#181818] hover:bg-[#2a2a2a] border-[#2e2e2e]'
                : 'bg-[#141418] hover:bg-[#23232a] border-[#27272d]'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex gap-3.5 overflow-hidden">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="w-[148px] sm:w-[168px] shrink-0 space-y-2 animate-pulse">
              <div className="aspect-[2/3] rounded-xl bg-[#18181c]" />
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
              onOpenInfo={onOpenInfo}
              className="w-[148px] sm:w-[168px] shrink-0"
            />
          ))}
        </div>
      )}
    </section>
  );
};

/**
 * Netflix Top 10 Ranked Row with oversized hollow SVG numbers (1..10).
 */
const NetflixTop10Shelf: React.FC<{
  title: string;
  items: TmdbCatalogItem[];
  onSelect: (media: TmdbCatalogItem) => void;
}> = ({ title, items, onSelect }) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const top10 = items.slice(0, 10);
  if (top10.length === 0) return null;

  const scrollTrack = (direction: 'left' | 'right') => {
    const el = trackRef.current;
    if (!el) return;
    const distance = Math.max(360, el.clientWidth * 0.78);
    el.scrollBy({
      left: direction === 'right' ? distance : -distance,
      behavior: 'smooth',
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded-[3px] bg-[#E50914] text-white text-[10px] font-black uppercase tracking-wider leading-none">
            TOP 10
          </span>
          <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => scrollTrack('left')}
            aria-label={`Scroll ${title} left`}
            className="w-8 h-8 rounded-lg bg-[#181818] hover:bg-[#2a2a2a] border border-[#2e2e2e] text-neutral-200 grid place-items-center transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollTrack('right')}
            aria-label={`Scroll ${title} right`}
            className="w-8 h-8 rounded-lg bg-[#181818] hover:bg-[#2a2a2a] border border-[#2e2e2e] text-neutral-200 grid place-items-center transition-colors cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto pb-2 scroll-smooth"
        style={{ scrollbarWidth: 'none' }}
      >
        {top10.map((media, idx) => (
          <button
            key={`top10-${media.id}`}
            type="button"
            onClick={() => onSelect(media)}
            className="group relative flex items-end shrink-0 w-[188px] sm:w-[214px] pl-[48px] sm:pl-[56px] cursor-pointer text-left"
          >
            <svg
              viewBox="0 0 110 150"
              className="netflix-rank-svg absolute left-0 bottom-0 w-[78px] sm:w-[88px] h-[126px] sm:h-[144px] z-0 transition-transform duration-200 group-hover:scale-105"
              aria-hidden="true"
            >
              <text
                x="50"
                y="138"
                textAnchor="middle"
                fontSize={idx === 9 ? '112' : '142'}
                fontWeight="900"
                fill="#141414"
                stroke="#595959"
                strokeWidth="4"
                letterSpacing="-6"
              >
                {idx + 1}
              </text>
            </svg>

            <div className="relative z-10 w-[132px] sm:w-[148px] aspect-[2/3] rounded-md overflow-hidden bg-[#181818] border border-white/10 group-hover:border-white/40 shadow-2xl transition-transform duration-200 group-hover:-translate-y-1">
              <img
                src={media.posterUrl}
                alt={`#${idx + 1} ${media.title}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) =>
                  handlePosterImageError(
                    e,
                    media.title,
                    media.mediaType === 'tv' ? 'TV Shows' : 'Movies'
                  )
                }
                className="w-full h-full object-cover"
              />
            </div>
          </button>
        ))}
      </div>
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
  showMyListOnly = false,
  onCloseMyList,
}) => {
  const {
    isNetflix,
    isPopcorn,
    myList,
    isInMyList,
    toggleMyList,
    continueWatching,
    recordContinueWatching,
    removeContinueWatching,
  } = useTheme();

  const fullCatalogRef = useRef<HTMLElement | null>(null);
  const collectionsTrackRef = useRef<HTMLDivElement | null>(null);
  const [infoModalItem, setInfoModalItem] = useState<TmdbCatalogItem | null>(null);
  const [popcornDetailItem, setPopcornDetailItem] = useState<TmdbCatalogItem | null>(null);

  const isAnimationMode = mode === 'anime' || mode === 'cartoons';
  const lockedMediaType: 'movie' | 'tv' = mode === 'tv' ? 'tv' : 'movie';

  const modeWatchlist = useMemo(() => {
    if (showMyListOnly) return myList;
    if (isAnimationMode) return myList;
    return myList.filter((w) => w.mediaType === lockedMediaType);
  }, [myList, showMyListOnly, isAnimationMode, lockedMediaType]);

  // Curated TMDB shelves state (strictly separated by section mode)
  const [shelfPrimary, setShelfPrimary] = useState<TmdbCatalogItem[]>([]);
  const [shelfSecondary, setShelfSecondary] = useState<TmdbCatalogItem[]>([]);
  const [shelfTertiary, setShelfTertiary] = useState<TmdbCatalogItem[]>([]);
  const [shelfQuaternary, setShelfQuaternary] = useState<TmdbCatalogItem[]>([]);
  const [shelvesLoading, setShelvesLoading] = useState<boolean>(true);
  const [collections, setCollections] = useState<TmdbCollectionSummary[]>([]);
  const [heroIndex, setHeroIndex] = useState<number>(0);

  // Drilldown state (Network, Studio, Collection, All Collections)
  const [drilldown, setDrilldown] = useState<DrilldownView>(null);
  const [drilldownItems, setDrilldownItems] = useState<TmdbCatalogItem[]>([]);
  const [drilldownPage, setDrilldownPage] = useState<number>(1);
  const [drilldownTotalPages, setDrilldownTotalPages] = useState<number>(1);
  const [drilldownLoading, setDrilldownLoading] = useState<boolean>(false);

  // 1.51M Full TMDB Index Server State (for Movies & TV Shows)
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

  // Archive fallback + search state
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
  const [animationSearchResults, setAnimationSearchResults] = useState<TmdbCatalogItem[]>([]);
  const [animationSearchLoading, setAnimationSearchLoading] = useState<boolean>(false);
  const [livePage, setLivePage] = useState<number>(1);
  const [liveTotalPages, setLiveTotalPages] = useState<number>(1);
  const [liveTotalResults, setLiveTotalResults] = useState<number>(0);
  const [liveLoading, setLiveLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  // Preserve archive filter/page across watch navigation
  useEffect(() => {
    if (isAnimationMode) return;
    onStateChange?.({
      feed: activeFeed,
      mediaFilter: archiveMediaFilter,
      genre: selectedGenreFilter,
      era: selectedEraFilter,
      sortBy,
      page: archivePage,
    });
  }, [activeFeed, archiveMediaFilter, selectedGenreFilter, selectedEraFilter, sortBy, archivePage, onStateChange, isAnimationMode]);

  const prevModeRef = useRef<CinemaSectionMode>(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    setHeroIndex(0);
    setDrilldown(null);
    setPopcornDetailItem(null);
    setActiveFeed('archive');
    setArchivePage(1);
    setSelectedGenreFilter('All');
    setSelectedEraFilter('All');
  }, [mode]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 480);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Load curated TMDB rows strictly matching the active section (Movies, TV Shows, Anime, Cartoons)
  useEffect(() => {
    let cancelled = false;
    setShelvesLoading(true);

    if (mode === 'tv') {
      Promise.all([
        fetchTmdbTrendingSplit('tv', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('tv_popular', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('tv_top_rated', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('tv_on_the_air', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
      ]).then(([a, b, c, d]) => {
        if (cancelled) return;
        setShelfPrimary(a.items.filter((i) => i.mediaType === 'tv'));
        setShelfSecondary(b.items.filter((i) => i.mediaType === 'tv'));
        setShelfTertiary(c.items.filter((i) => i.mediaType === 'tv'));
        setShelfQuaternary(d.items.filter((i) => i.mediaType === 'tv'));
        setCollections([]);
        setShelvesLoading(false);
      });
    } else if (mode === 'anime') {
      Promise.all([
        fetchTmdbAnimeFeed('trending', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbAnimeFeed('retro_classics', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbAnimeFeed('top_rated', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbAnimeFeed('movies', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
      ]).then(([a, b, c, d]) => {
        if (cancelled) return;
        setShelfPrimary(a.items);
        setShelfSecondary(b.items);
        setShelfTertiary(c.items);
        setShelfQuaternary(d.items);
        setCollections([]);
        setShelvesLoading(false);
      });
    } else if (mode === 'cartoons') {
      Promise.all([
        fetchTmdbCartoonsFeed('trending', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbCartoonsFeed('retro_classics', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbCartoonsFeed('top_rated', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbCartoonsFeed('movies', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
      ]).then(([a, b, c, d]) => {
        if (cancelled) return;
        setShelfPrimary(a.items);
        setShelfSecondary(b.items);
        setShelfTertiary(c.items);
        setShelfQuaternary(d.items);
        setCollections([]);
        setShelvesLoading(false);
      });
    } else {
      Promise.all([
        fetchTmdbTrendingSplit('movie', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('movie_popular', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('movie_top_rated', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
        fetchTmdbFeed('movie_now_playing', 1).catch(() => ({ items: [] as TmdbCatalogItem[] })),
      ]).then(([a, b, c, d]) => {
        if (cancelled) return;
        setShelfPrimary(a.items.filter((i) => i.mediaType === 'movie'));
        setShelfSecondary(b.items.filter((i) => i.mediaType === 'movie'));
        setShelfTertiary(c.items.filter((i) => i.mediaType === 'movie'));
        setShelfQuaternary(d.items.filter((i) => i.mediaType === 'movie'));
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

  const shelfTitles = useMemo(() => {
    if (mode === 'tv') {
      return ['Trending Shows', 'Popular Shows', 'Top Rated Shows', 'On The Air'] as const;
    }
    if (mode === 'anime') {
      return ['Trending Anime', 'Classic Retro Anime', 'Top Rated Anime', 'Anime Feature Films'] as const;
    }
    if (mode === 'cartoons') {
      return ['Trending Cartoons', 'Retro 90s & 2000s Cartoons', 'Top Rated Cartoons', 'Animated Movies'] as const;
    }
    return ['Trending Movies', 'Popular Movies', 'Top Rated Movies', 'Now Playing'] as const;
  }, [mode]);

  // Hero slides strictly derived from the active section
  const heroSlides = useMemo(() => {
    const pool = [...shelfPrimary, ...shelfSecondary, ...shelfTertiary];
    const seen = new Set<string>();
    const unique: TmdbCatalogItem[] = [];
    for (const item of pool) {
      if (!isAnimationMode && item.mediaType !== lockedMediaType) continue;
      if (item.backdropUrl && !seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
        if (unique.length >= 10) break;
      }
    }
    return unique;
  }, [isAnimationMode, lockedMediaType, shelfPrimary, shelfSecondary, shelfTertiary]);

  useEffect(() => {
    if (heroSlides.length <= 1 || drilldown || searchQuery.trim() || showMyListOnly) return;
    const id = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroSlides.length);
    }, 9000);
    return () => window.clearInterval(id);
  }, [heroSlides.length, drilldown, searchQuery, showMyListOnly]);

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

  // Animation live search for Anime & Cartoons
  useEffect(() => {
    if (!isAnimationMode || !debouncedQuery) {
      setAnimationSearchResults([]);
      setAnimationSearchLoading(false);
      return;
    }
    let cancelled = false;
    setAnimationSearchLoading(true);
    searchTmdbAnimation(debouncedQuery, 1, { kidsOnly: mode === 'cartoons' })
      .then((res) => {
        if (!cancelled) {
          setAnimationSearchResults(res.items);
          setAnimationSearchLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnimationSearchResults([]);
          setAnimationSearchLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isAnimationMode, mode, debouncedQuery]);

  // Query 1.51M Backend Index OR fallback to static 92,000 TMDB chunks (when searching Movies / TV Shows)
  useEffect(() => {
    if (isAnimationMode || activeFeed !== 'archive' || !serverCheckDone || !debouncedQuery) return;
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
    isAnimationMode,
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

  useEffect(() => {
    if (isAnimationMode || !debouncedQuery) {
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
  }, [isAnimationMode, debouncedQuery, lockedMediaType]);

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

  const openNetworkDrilldown = async (network: NetworkBrandItem, page = 1, append = false) => {
    setDrilldown({ kind: 'network', network });
    setDrilldownLoading(true);
    if (!append) window.scrollTo({ top: 0, behavior: 'smooth' });
    const preferredMode = isAnimationMode ? 'all' : lockedMediaType;
    const res = await fetchTmdbNetworkContent(
      network.tvNetworkId,
      network.watchProviderId,
      preferredMode,
      page
    );
    const scoped = isAnimationMode
      ? res.items.filter(
          (i) =>
            (!i.genreIds?.length || i.genreIds.includes(16)) &&
            (mode !== 'cartoons' || isKidsCartoonSafe(i))
        )
      : res.items.filter((i) => i.mediaType === lockedMediaType);
    const fallbackList = mode === 'cartoons' ? res.items.filter(isKidsCartoonSafe) : res.items;
    const finalNetworkItems = scoped.length > 0 ? scoped : fallbackList;
    setDrilldownPage(res.page);
    setDrilldownTotalPages(res.totalPages);
    setDrilldownItems((prev) => {
      if (!append) return finalNetworkItems;
      const seen = new Set(prev.map((i) => i.id));
      return [...prev, ...finalNetworkItems.filter((i) => !seen.has(i.id))];
    });
    setDrilldownLoading(false);
  };

  const openStudioDrilldown = async (studio: StudioBrandItem, page = 1, append = false) => {
    setDrilldown({ kind: 'studio', studio });
    setDrilldownLoading(true);
    if (!append) window.scrollTo({ top: 0, behavior: 'smooth' });
    const preferredMode = isAnimationMode ? 'all' : lockedMediaType;
    const res = await fetchTmdbStudioContent(
      studio.companyId,
      preferredMode,
      page,
      studio.tvCompanyId
    );
    const scoped = isAnimationMode
      ? mode === 'cartoons'
        ? res.items.filter(isKidsCartoonSafe)
        : res.items
      : res.items.filter((i) => i.mediaType === lockedMediaType);
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

  const handleOpenPoster = (media: TmdbCatalogItem, initialSeason?: number, initialEpisode?: number) => {
    recordContinueWatching(media, {
      season: initialSeason,
      episode: initialEpisode,
      sourceTab: mode,
    });
    onSelectMedia({
      mediaType: media.mediaType,
      tmdbId: media.tmdbId,
      previewItem: media,
      initialSeason,
      initialEpisode,
      sourceTab: mode,
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
          sourceTab: mode,
        });
        return;
      }
    }

    onSelectMedia({
      mediaType: mode === 'tv' ? 'tv' : 'movie',
      tmdbId: cleaned,
      sourceTab: mode,
    });
  };

  const availableGenres = useMemo(() => {
    const genreSource = serverStats?.genres || archiveManifest?.genres;
    if (!genreSource) return ['All'];
    const names = Array.from(new Set(Object.values(genreSource))).sort();
    return ['All', ...names];
  }, [serverStats, archiveManifest]);

  const filteredArchiveItems = useMemo(() => {
    if (isAnimationMode || activeFeed !== 'archive' || serverStats) return [];
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
    isAnimationMode,
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
    if (isAnimationMode) return animationSearchResults;
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
    isAnimationMode,
    animationSearchResults,
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
  const isLoading = isAnimationMode
    ? animationSearchLoading
    : activeFeed === 'archive'
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
  const isHeroSaved = activeHero ? isInMyList(activeHero.id) : false;

  const scrollCollections = (dir: 'left' | 'right') => {
    const el = collectionsTrackRef.current;
    if (!el) return;
    const delta = Math.max(360, el.clientWidth * 0.75);
    el.scrollBy({ left: dir === 'right' ? delta : -delta, behavior: 'smooth' });
  };

  const visibleContinueWatching = useMemo(() => {
    if (isAnimationMode) {
      return continueWatching.filter((c) => c.sourceTab === mode || c.sourceTab === 'anime' || c.sourceTab === 'cartoons');
    }
    return continueWatching.filter((c) => c.mediaType === lockedMediaType);
  }, [continueWatching, isAnimationMode, mode, lockedMediaType]);

  // Deduplicated stuck-together Popcorn Time catalog feed
  const popcornWallItems = useMemo(() => {
    const combined = [...shelfPrimary, ...shelfSecondary, ...shelfTertiary, ...shelfQuaternary];
    const seen = new Set<string>();
    const out: TmdbCatalogItem[] = [];
    for (const item of combined) {
      if (!item.posterUrl) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }, [shelfPrimary, shelfSecondary, shelfTertiary, shelfQuaternary]);

  // ============================================================================
  // POPCORN TIME ("WEBPLAY time") FULL-BLEED ZERO-GAP POSTER WALL + DETAIL VIEW
  // ============================================================================
  if (isPopcorn) {
    const activeSearchTrimmed = searchQuery.trim();
    const showingSearch = Boolean(activeSearchTrimmed);
    const wallItems = showingSearch
      ? displayedItems
      : showMyListOnly
      ? myList
      : popcornWallItems;
    const wallLoading = showingSearch
      ? isLoading
      : showMyListOnly
      ? false
      : shelvesLoading && wallItems.length === 0;

    return (
      <div className="w-full min-h-screen bg-[#0c0e14]">
        {showMyListOnly && !showingSearch && (
          <div className="pt-[96px] sm:pt-16 px-4 py-3 flex items-center justify-between border-b border-white/10 bg-[#0d1018]">
            <div className="text-xs font-bold text-neutral-200">
              Favorites ({myList.length})
            </div>
            {onCloseMyList && (
              <button
                type="button"
                onClick={onCloseMyList}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
              >
                <ArrowLeft size={13} />
                <span>Back to Wall</span>
              </button>
            )}
          </div>
        )}

        {showingSearch && (
          <div className="pt-[96px] sm:pt-16 px-4 py-2.5 flex items-center justify-between border-b border-white/10 bg-[#0d1018] text-xs text-neutral-300">
            <span>
              Search results for <strong className="text-white">&ldquo;{activeSearchTrimmed}&rdquo;</strong> ({wallItems.length.toLocaleString()})
            </span>
            {onClearSearch && (
              <button
                type="button"
                onClick={onClearSearch}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#3fa9f5] hover:bg-[#5ebaff] text-white font-bold cursor-pointer"
              >
                <X size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>
        )}

        {wallLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-0 w-full">
            {Array.from({ length: 36 }).map((_, idx) => (
              <div
                key={idx}
                className="aspect-[2/3] w-full bg-[#131723] animate-pulse border border-white/[0.02]"
              />
            ))}
          </div>
        ) : wallItems.length === 0 ? (
          <div className="empty-state pt-28 p-12">
            <Heart size={32} className="text-[#3fa9f5]" />
            <h3>
              {showMyListOnly ? 'No Favorites Yet' : 'No Titles Found'}
            </h3>
            <p>
              {showMyListOnly
                ? 'Hover any poster and click the heart icon to save favorites here.'
                : 'Try another search query or switch sections above.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-0 w-full">
            {wallItems.map((media) => (
              <PopcornPosterTile
                key={`pt-${media.id}`}
                media={media}
                onSelect={(m) => setPopcornDetailItem(m)}
              />
            ))}
          </div>
        )}

        {showingSearch && !isAnimationMode && activeFeed !== 'archive' && livePage < liveTotalPages && (
          <div className="flex justify-center pt-6">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => loadLiveFeedPage(livePage + 1, true)}
              className="px-5 py-2.5 rounded bg-[#3fa9f5] hover:bg-[#5ebaff] text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
            >
              {loadingMore ? 'Loading More...' : 'Load More Posters'}
            </button>
          </div>
        )}

        {popcornDetailItem && (
          <PopcornDetailView
            item={popcornDetailItem}
            onClose={() => setPopcornDetailItem(null)}
            onPlay={(targetItem, s, e) => {
              setPopcornDetailItem(null);
              handleOpenPoster(targetItem, s, e);
            }}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // MY LIST VIEW (Netflix Header "My List" Tab)
  // ============================================================================
  if (showMyListOnly && !searchQuery.trim()) {
    return (
      <section className="space-y-6 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#262626] pb-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-white">My List</h2>
            <p className="text-xs text-neutral-400">
              {myList.length} saved title{myList.length === 1 ? '' : 's'} across Movies, TV Shows, Anime &amp; Cartoons
            </p>
          </div>
          {onCloseMyList && (
            <button
              type="button"
              onClick={onCloseMyList}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#242424] hover:bg-[#323232] border border-[#383838] text-white text-xs font-bold cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to Browse</span>
            </button>
          )}
        </div>

        {myList.length === 0 ? (
          <div className="empty-state border border-[#282828] rounded-xl p-10 bg-[#181818]">
            <Bookmark size={34} className="text-neutral-500" />
            <h3>Your list is empty</h3>
            <p>Click the + button on any movie, series, anime, or cartoon to add it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
            {myList.map((media) => (
              <CinemaPosterCard
                key={`mylist-${media.id}`}
                media={media}
                onSelect={(m) => handleOpenPoster(m)}
                onOpenInfo={(m) => setInfoModalItem(m)}
              />
            ))}
          </div>
        )}

        <NetflixInfoModal
          item={infoModalItem}
          onClose={() => setInfoModalItem(null)}
          onPlay={(targetItem, s, e) => {
            setInfoModalItem(null);
            handleOpenPoster(targetItem, s, e);
          }}
          onSelectOther={(other) => setInfoModalItem(other)}
        />
      </section>
    );
  }

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
              className={`inline-flex items-center gap-2 px-3.5 py-2 border text-white text-xs font-bold transition-colors cursor-pointer ${
                isNetflix
                  ? 'rounded-md bg-[#1f1f1f] hover:bg-[#2c2c2c] border-[#333333]'
                  : 'rounded-xl bg-[#141418] hover:bg-[#222228] border-[#27272e]'
              }`}
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
                  : 'Click any poster to watch'}
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
                  onSelect={(m) => handleOpenPoster(m)}
                  onOpenInfo={(m) => setInfoModalItem(m)}
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
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer disabled:opacity-50 ${
                    isNetflix
                      ? 'bg-[#E50914] hover:bg-[#f40612] text-white'
                      : 'bg-white text-black hover:bg-neutral-200'
                  }`}
                >
                  {drilldownLoading ? 'Loading...' : `Load More Titles (Page ${drilldownPage + 1})`}
                </button>
              </div>
            )}
          </>
        )}

        <NetflixInfoModal
          item={infoModalItem}
          onClose={() => setInfoModalItem(null)}
          onPlay={(targetItem, s, e) => {
            setInfoModalItem(null);
            handleOpenPoster(targetItem, s, e);
          }}
          onSelectOther={(other) => setInfoModalItem(other)}
        />
      </section>
    );
  }

  const hasSearchQuery = Boolean(searchQuery.trim());
  const top10Label =
    mode === 'tv'
      ? 'TV Shows Today'
      : mode === 'anime'
      ? 'Anime Today'
      : mode === 'cartoons'
      ? 'Cartoons Today'
      : 'Movies Today';

  const heroKickerText =
    mode === 'tv'
      ? 'Series'
      : mode === 'anime'
      ? 'Anime Series'
      : mode === 'cartoons'
      ? 'Animation'
      : 'Film';

  return (
    <div className="space-y-10 pb-16">
      {!hasSearchQuery && (
        <>
          {/* 1. HERO BILLBOARD (Obsidian Spotlight OR Netflix 100% Billboard) */}
          {activeHero && (
            <section
              className={`relative overflow-hidden border min-h-[340px] sm:min-h-[430px] lg:min-h-[480px] flex items-end shadow-2xl ${
                isNetflix
                  ? 'rounded-lg bg-[#141414] border-[#262626]'
                  : 'rounded-2xl bg-[#121216] border-[#232329]'
              }`}
            >
              {activeHero.backdropUrl && (
                <img
                  key={activeHero.id}
                  src={activeHero.backdropUrl}
                  alt={activeHero.title}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500"
                />
              )}
              <div
                className={`absolute inset-0 ${
                  isNetflix
                    ? 'bg-gradient-to-r from-[#141414] via-[#141414]/75 to-transparent'
                    : 'bg-gradient-to-r from-[#08080a] via-[#08080a]/70 to-transparent'
                }`}
              />
              <div
                className={`absolute inset-0 ${
                  isNetflix
                    ? 'bg-gradient-to-t from-[#141414] via-transparent to-black/35'
                    : 'bg-gradient-to-t from-[#08080a] via-transparent to-black/30'
                }`}
              />

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
                          ? isNetflix
                            ? 'w-7 bg-[#E50914]'
                            : 'w-7 bg-white'
                          : 'w-4 bg-white/30 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Hero Title, Synopsis & Action Buttons */}
              <div className="relative z-10 p-6 sm:p-10 max-w-2xl space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 tabular-nums">
                  {isNetflix ? (
                    <>
                      <span className="font-netflix-display text-xl text-[#E50914] leading-none">
                        N
                      </span>
                      <span className="uppercase tracking-[0.2em] text-neutral-200 font-extrabold">
                        {heroKickerText}
                      </span>
                      <span className="text-neutral-500" aria-hidden="true">·</span>
                      <span className="text-[#46d369] font-extrabold">
                        {computeMatchPercent(activeHero.voteAverage)}% Match
                      </span>
                    </>
                  ) : (
                    <span className="uppercase tracking-widest text-white/80">
                      Featured {heroKickerText}
                    </span>
                  )}

                  {activeHero.year && activeHero.year !== 'N/A' && (
                    <>
                      <span className="text-neutral-500" aria-hidden="true">·</span>
                      <span>{activeHero.year}</span>
                    </>
                  )}
                  {isUpcomingDate(activeHero.releaseDate) && (
                    <>
                      <span className="text-neutral-500" aria-hidden="true">·</span>
                      <span className="text-amber-400 font-bold">
                        Upcoming ({formatReleaseNote(activeHero.releaseDate, 'Not released yet')})
                      </span>
                    </>
                  )}
                  {!isNetflix && activeHero.voteAverage > 0 && (
                    <>
                      <span className="text-neutral-500" aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-white">
                        <Star size={12} className="text-[#22c55e] fill-[#22c55e]" />
                        {activeHero.voteAverage.toFixed(1)}
                      </span>
                    </>
                  )}
                </div>

                <h2
                  className={`text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.02] drop-shadow-lg ${
                    isNetflix ? '' : 'uppercase'
                  }`}
                  style={{ textWrap: 'balance' }}
                >
                  {activeHero.title}
                </h2>

                <p className="text-xs sm:text-sm text-neutral-200/90 leading-relaxed line-clamp-2">
                  {activeHero.overview}
                </p>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenPoster(activeHero)}
                    className={`inline-flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-neutral-200 text-black text-xs sm:text-sm font-extrabold transition-colors shadow-lg cursor-pointer whitespace-nowrap shrink-0 ${
                      isNetflix ? 'rounded-[4px]' : 'rounded-lg'
                    }`}
                  >
                    <Play size={15} fill="currentColor" />
                    <span>Play</span>
                  </button>

                  {isNetflix && (
                    <button
                      type="button"
                      onClick={() => setInfoModalItem(activeHero)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[4px] bg-[#6d6d6e]/75 hover:bg-[#6d6d6e]/55 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Info size={16} />
                      <span>More Info</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleMyList(activeHero)}
                    title={isHeroSaved ? 'Remove from My List' : 'Add to My List'}
                    aria-label={isHeroSaved ? 'Remove from My List' : 'Add to My List'}
                    className={`w-10 h-10 bg-white/15 hover:bg-white/25 border border-white/25 text-white grid place-items-center transition-colors backdrop-blur-sm cursor-pointer ${
                      isNetflix ? 'rounded-full' : 'rounded-lg'
                    }`}
                  >
                    {isHeroSaved ? <Check size={17} /> : <Plus size={17} />}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* NETFLIX CONTINUE WATCHING ROW */}
          {isNetflix && visibleContinueWatching.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Continue Watching
              </h2>
              <div
                className="flex gap-3.5 overflow-x-auto pb-2 scroll-smooth"
                style={{ scrollbarWidth: 'none' }}
              >
                {visibleContinueWatching.map((cw) => (
                  <div
                    key={`cw-${cw.id}`}
                    className="group relative w-[220px] sm:w-[250px] shrink-0 rounded-md overflow-hidden bg-[#181818] border border-white/10 hover:border-white/35 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onSelectMedia({
                          mediaType: cw.mediaType,
                          tmdbId: cw.tmdbId,
                          initialSeason: cw.season,
                          initialEpisode: cw.episode,
                          sourceTab: cw.sourceTab || mode,
                          previewItem: {
                            id: cw.id,
                            tmdbId: cw.tmdbId,
                            mediaType: cw.mediaType,
                            title: cw.title,
                            overview: '',
                            posterUrl: cw.posterUrl,
                            backdropUrl: cw.backdropUrl,
                            hasPoster: true,
                            releaseDate: cw.year,
                            year: cw.year,
                            voteAverage: cw.voteAverage,
                            voteCount: 0,
                            genreNames: [],
                          },
                        })
                      }
                      className="w-full text-left block cursor-pointer"
                    >
                      <div className="relative aspect-[16/9] w-full bg-[#111] overflow-hidden">
                        <img
                          src={cw.backdropUrl || cw.posterUrl}
                          alt={cw.title}
                          referrerPolicy="no-referrer"
                          onError={(e) =>
                            handlePosterImageError(
                              e,
                              cw.title,
                              cw.mediaType === 'tv' ? 'TV Shows' : 'Movies'
                            )
                          }
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                          <span className="w-10 h-10 rounded-full bg-white text-black grid place-items-center shadow-lg">
                            <Play size={16} fill="currentColor" className="ml-0.5" />
                          </span>
                        </div>
                        {/* Iconic Netflix Red Progress Track */}
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/25">
                          <div
                            className="h-full bg-[#E50914]"
                            style={{ width: `${cw.progressPercent || 35}%` }}
                          />
                        </div>
                      </div>
                      <div className="p-2.5 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">{cw.title}</span>
                        {cw.mediaType === 'tv' && cw.season && cw.episode && (
                          <span className="text-[10px] font-mono text-neutral-400 shrink-0 tabular-nums">
                            S{cw.season}:E{cw.episode}
                          </span>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => removeContinueWatching(cw.id)}
                      aria-label={`Remove ${cw.title} from Continue Watching`}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/75 text-neutral-300 hover:text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. TOP 10 TODAY (Netflix Mode) */}
          {isNetflix && shelfPrimary.length > 0 && (
            <NetflixTop10Shelf
              title={top10Label}
              items={shelfPrimary}
              onSelect={(m) => handleOpenPoster(m)}
            />
          )}

          {/* 3-6. HORIZONTAL CURATED TMDB SHELVES */}
          <HorizontalPosterShelf
            title={shelfTitles[0]}
            items={shelfPrimary}
            loading={shelvesLoading}
            onSelect={(m) => handleOpenPoster(m)}
            onOpenInfo={(m) => setInfoModalItem(m)}
          />
          <HorizontalPosterShelf
            title={shelfTitles[1]}
            items={shelfSecondary}
            loading={shelvesLoading}
            onSelect={(m) => handleOpenPoster(m)}
            onOpenInfo={(m) => setInfoModalItem(m)}
          />
          <HorizontalPosterShelf
            title={shelfTitles[2]}
            items={shelfTertiary}
            loading={shelvesLoading}
            onSelect={(m) => handleOpenPoster(m)}
            onOpenInfo={(m) => setInfoModalItem(m)}
          />
          <HorizontalPosterShelf
            title={shelfTitles[3]}
            items={shelfQuaternary}
            loading={shelvesLoading}
            onSelect={(m) => handleOpenPoster(m)}
            onOpenInfo={(m) => setInfoModalItem(m)}
          />

          {/* 7. POPULAR NETWORKS */}
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
                  className={`group aspect-square border flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-lg overflow-hidden ${net.cardBg} ${
                    isNetflix
                      ? 'rounded-lg hover:border-white/50'
                      : 'rounded-2xl hover:border-white/40'
                  }`}
                >
                  <img
                    src={net.logoUrl}
                    alt={net.name}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full ${
                      net.imageFit === 'contain' ? 'object-contain p-3.5' : 'object-cover'
                    } group-hover:scale-105 transition-transform duration-200`}
                  />
                </button>
              ))}
            </div>
          </section>

          {/* 8. STUDIOS (Only on Movies & TV Shows) */}
          {!isAnimationMode && (
            <section className="space-y-3">
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                Studios
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {FEATURED_STUDIOS.map((studio) => (
                  <button
                    key={studio.id}
                    type="button"
                    onClick={() => openStudioDrilldown(studio, 1, false)}
                    aria-label={studio.name}
                    className={`group h-[86px] sm:h-[96px] border flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-md overflow-hidden p-4 ${
                      isNetflix
                        ? 'rounded-lg border-[#2b2b2b] hover:border-white/40 bg-[#f4f4f5]'
                        : 'rounded-xl border-white/10 hover:border-white/40 bg-[#f4f4f5]'
                    }`}
                  >
                    <img
                      src={studio.logoUrl}
                      alt={studio.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 9. COLLECTIONS (Strictly Movies-only sagas, hidden on TV Shows, Anime & Cartoons) */}
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
                    className="text-xs font-bold text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Explore All
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => scrollCollections('left')}
                    aria-label="Scroll Collections left"
                    className={`w-8 h-8 rounded-lg border text-neutral-200 grid place-items-center transition-colors cursor-pointer ${
                      isNetflix
                        ? 'bg-[#181818] hover:bg-[#2a2a2a] border-[#2e2e2e]'
                        : 'bg-[#141418] hover:bg-[#23232a] border-[#27272d]'
                    }`}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCollections('right')}
                    aria-label="Scroll Collections right"
                    className={`w-8 h-8 rounded-lg border text-neutral-200 grid place-items-center transition-colors cursor-pointer ${
                      isNetflix
                        ? 'bg-[#181818] hover:bg-[#2a2a2a] border-[#2e2e2e]'
                        : 'bg-[#141418] hover:bg-[#23232a] border-[#27272d]'
                    }`}
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
                      className={`group relative w-[270px] sm:w-[310px] aspect-[16/9] shrink-0 overflow-hidden bg-[#141418] border border-[#27272d] hover:border-white/30 text-left cursor-pointer shadow-lg ${
                        isNetflix ? 'rounded-lg' : 'rounded-xl'
                      }`}
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

          {/* 10. MY WATCHLIST / MY LIST PREVIEW */}
          {modeWatchlist.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Bookmark
                  size={16}
                  className={isNetflix ? 'text-[#E50914]' : 'text-[#22c55e]'}
                />
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  {isNetflix ? `My List (${modeWatchlist.length})` : `My Watchlist (${modeWatchlist.length})`}
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {modeWatchlist.map((media) => (
                  <CinemaPosterCard
                    key={`wl-${media.id}`}
                    media={media}
                    onSelect={(m) => handleOpenPoster(m)}
                    onOpenInfo={(m) => setInfoModalItem(m)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ACTIVE SEARCH RESULTS VIEW */}
      {hasSearchQuery && (
        <section ref={fullCatalogRef} className="space-y-5 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                <Search size={17} className="text-neutral-300" />
                <span>Results for &ldquo;{searchQuery.trim()}&rdquo;</span>
              </h2>
              <p className="text-xs text-neutral-400 tabular-nums">
                {isAnimationMode
                  ? animationSearchLoading
                    ? 'Searching animation catalog...'
                    : `${displayedItems.length.toLocaleString()} animated titles matching your search`
                  : activeFeed === 'archive'
                  ? serverStats
                    ? serverLoading
                      ? 'Loading TMDB catalog page...'
                      : `${serverTotalItems.toLocaleString()} titles (${(archiveMediaFilter === 'movie'
                          ? serverStats.moviesCount
                          : serverStats.tvCount
                        ).toLocaleString()} indexed) · Page ${clampedArchivePage.toLocaleString()} of ${archiveTotalPages.toLocaleString()}`
                    : archiveLoading
                    ? 'Loading TMDB catalog...'
                    : `${filteredArchiveItems.length.toLocaleString()} titles (${archiveLoadedCount.toLocaleString()} / ${(archiveTotalCount || archiveManifest?.totalTitles || 92000).toLocaleString()} indexed${archiveStreamingDone ? '' : ' · loading shards...'}) · Page ${clampedArchivePage.toLocaleString()} of ${archiveTotalPages.toLocaleString()}`
                  : liveLoading
                  ? 'Loading TMDB...'
                  : `Showing ${liveItems.length} · Page ${livePage} of ${liveTotalPages.toLocaleString()} (${liveTotalResults.toLocaleString()} titles)`}
              </p>
              {!isAnimationMode && activeFeed === 'archive' && serverScopeNote && (
                <p className="text-[11px] text-neutral-500">{serverScopeNote}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {onClearSearch && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    isNetflix
                      ? 'bg-[#E50914] border-[#E50914] text-white hover:bg-[#f40612]'
                      : 'border-white/20 bg-white text-black hover:bg-neutral-200'
                  }`}
                >
                  <X size={13} />
                  <span>Clear Search</span>
                </button>
              )}

              {!isAnimationMode &&
                modeFeeds.map((feed) => {
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
                          ? isNetflix
                            ? 'bg-[#E50914] text-white border-[#E50914]'
                            : 'bg-white text-black border-white'
                          : 'bg-[#141418] text-neutral-300 border-[#27272d] hover:bg-[#1e1e24] hover:text-white'
                      }`}
                    >
                      {displayLabel}
                    </button>
                  );
                })}
            </div>
          </div>

          {!isAnimationMode && activeFeed === 'archive' && (
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
              <p>Try clearing your search or adjusting filters.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {displayedItems.map((media) => (
                  <CinemaPosterCard
                    key={media.id}
                    media={media}
                    onSelect={(m) => handleOpenPoster(m)}
                    onOpenInfo={(m) => setInfoModalItem(m)}
                  />
                ))}
              </div>

              {!isAnimationMode && (
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
                              ? isNetflix
                                ? 'bg-[#E50914] border-[#E50914] text-white'
                                : 'bg-white border-white text-black'
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
              )}
            </>
          )}
        </section>
      )}

      {/* Netflix Preview / Episodes / More Info Modal */}
      <NetflixInfoModal
        item={infoModalItem}
        onClose={() => setInfoModalItem(null)}
        onPlay={(targetItem, s, e) => {
          setInfoModalItem(null);
          handleOpenPoster(targetItem, s, e);
        }}
        onSelectOther={(other) => setInfoModalItem(other)}
      />

      {/* Scroll to Top Floating Circle */}
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
