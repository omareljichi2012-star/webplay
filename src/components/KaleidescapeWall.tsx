import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Info,
  Search,
  Settings,
  X,
  Box,
  Bookmark,
  Check,
  Film,
  Tv,
  Flame,
  Smile,
  Gamepad2,
  BookOpen,
  Pause,
  Sparkles,
  ChevronDown,
  MousePointer,
  MousePointerClick,
  Radio,
} from 'lucide-react';
import type { GameItem } from '../types';
import {
  TmdbCatalogItem,
  fetchTmdbFeed,
  fetchTmdbAnimeFeed,
  fetchTmdbCartoonsFeed,
  formatReleaseNote,
  isUpcomingDate,
  searchTmdbByType,
  searchTmdbAnimation,
} from '../services/tmdb';
import { useTheme } from '../context/ThemeContext';
import { handlePosterImageError } from '../utils/posterFallback';
import { SafeGameImage } from './SafeGameImage';
import { ConsoleBoxOverlay } from './ConsoleBoxOverlay';
import { NetflixInfoModal } from './NetflixInfoModal';
import { NostalgiaTvView } from './NostalgiaTvView';
import type { MoviePlayerTarget } from './MoviePlayerView';

export type KaleidescapeSection =
  | 'movies'
  | 'tv'
  | 'anime'
  | 'cartoons'
  | 'nostalgia'
  | 'games'
  | 'comics';

export interface KaleidescapeItem {
  key: string;
  kind: 'media' | 'game';
  title: string;
  overview: string;
  posterUrl: string;
  year: string;
  rating: number;
  metaLine: string;
  media?: TmdbCatalogItem;
  game?: GameItem;
}

interface KaleidescapeWallProps {
  mode: KaleidescapeSection;
  onChangeMode: (next: KaleidescapeSection) => void;
  games: GameItem[];
  gamesLoading: boolean;
  consoleTabs: string[];
  selectedConsole: string;
  onSelectConsole: (consoleName: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectMedia: (target: MoviePlayerTarget) => void;
  onLaunchGame: (game: GameItem) => void;
  onInspect3D: (game: GameItem) => void;
  onOpenSettings: () => void;
  renderComicsFallback?: () => React.ReactNode;
}

const SECTION_NAV: Array<{
  key: KaleidescapeSection;
  label: string;
  icon: React.ReactNode;
}> = [
  { key: 'movies', label: 'Movies', icon: <Film size={14} /> },
  { key: 'tv', label: 'TV Shows', icon: <Tv size={14} /> },
  { key: 'anime', label: 'Anime', icon: <Flame size={14} /> },
  { key: 'cartoons', label: 'Cartoons', icon: <Smile size={14} /> },
  { key: 'nostalgia', label: 'Nostalgia TV', icon: <Radio size={14} /> },
  { key: 'games', label: 'Retro Games', icon: <Gamepad2 size={14} /> },
  { key: 'comics', label: 'Comics', icon: <BookOpen size={14} /> },
];

const INITIAL_ANCHOR_ROW = 1;

function mapTmdbToKaleidescape(item: TmdbCatalogItem): KaleidescapeItem {
  const isUpcoming = isUpcomingDate(item.releaseDate);
  const genreText =
    item.genreNames?.slice(0, 2).join(', ') || (item.mediaType === 'tv' ? 'Series' : 'Film');
  const yearText = item.year && item.year !== 'N/A' ? item.year : '';
  const ratingText = item.voteAverage > 0 ? `★ ${item.voteAverage.toFixed(1)}` : '';
  const metaParts = [
    isUpcoming ? 'Upcoming' : '',
    yearText,
    genreText,
    ratingText,
  ].filter(Boolean);
  return {
    key: `media-${item.id}`,
    kind: 'media',
    title: item.title,
    overview:
      item.overview ||
      `Watch ${item.title} in high definition with instant multi-server streaming.`,
    posterUrl: item.posterUrl,
    year: yearText,
    rating: item.voteAverage || 0,
    metaLine: metaParts.join(' · '),
    media: item,
  };
}

function mapGameToKaleidescape(game: GameItem): KaleidescapeItem {
  const poster =
    game.poster ||
    game.posterUrl ||
    game.coverUrl ||
    game.boxFront ||
    game.boxFrontUrl ||
    '';
  const metaParts = [
    game.consoleType,
    game.year ? String(game.year) : '',
    game.genre || '',
    game.rating ? `★ ${Number(game.rating).toFixed(1)}` : '',
  ].filter(Boolean);

  return {
    key: `game-${game.id || game.slug}`,
    kind: 'game',
    title: game.title,
    overview:
      game.synopsis ||
      `Play ${game.title} (${game.consoleType}) directly in your browser.`,
    posterUrl: poster,
    year: game.year ? String(game.year) : '',
    rating: Number(game.rating || 9.0),
    metaLine: metaParts.join(' · '),
    game,
  };
}

/**
 * Pure bidirectional spiral band index around INITIAL_ANCHOR_ROW:
 * row 1 -> 0, row 2 -> 1, row 0 -> 2, row 3 -> 3, row -1 -> 4, ...
 * Ensures rows near the initial viewport stay 100% locked to activePool[0..N-1]
 * without shifting or re-shuffling when additional TMDB pages arrive.
 */
function getSpiralBand(row: number): number {
  const d = row - INITIAL_ANCHOR_ROW;
  if (d === 0) return 0;
  return d > 0 ? d * 2 - 1 : -d * 2;
}

function getDeterministicCellItem(
  pool: KaleidescapeItem[],
  row: number,
  col: number,
  cols: number
): KaleidescapeItem | null {
  const N = pool.length;
  if (N === 0) return null;

  const band = getSpiralBand(row);
  const directSlot = band * cols + col;
  if (directSlot < N) {
    return pool[directSlot];
  }

  // Deterministic coprime wrap when scrolling beyond current pool size (avoids neighbor repeats)
  const strideRow = N > 11 ? 7 : N > 5 ? 3 : 1;
  const strideCol = N > 7 ? 3 : 1;
  const shift = Math.floor(directSlot / N) * 5;
  const wrappedIndex =
    (((band * strideRow + col * strideCol + shift) % N) + N) % N;
  return pool[wrappedIndex];
}

interface PosterTileProps {
  item: KaleidescapeItem | null;
  rowIdx: number;
  colIdx: number;
  posterWidth: number;
  posterHeight: number;
  isSelected: boolean;
  posterLabelMode: 'labeled' | 'clean' | 'overlay';
  onHoverCell: (row: number, col: number) => void;
  onClickCell: (row: number, col: number, item: KaleidescapeItem | null) => void;
  onDoubleClickCell: (item: KaleidescapeItem | null) => void;
}

const KaleidescapePosterTile: React.FC<PosterTileProps> = React.memo(
  ({
    item,
    rowIdx,
    colIdx,
    posterWidth,
    posterHeight,
    isSelected,
    posterLabelMode,
    onHoverCell,
    onClickCell,
    onDoubleClickCell,
  }) => {
    const [imgLoaded, setImgLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
      if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
        setImgLoaded(true);
      } else {
        setImgLoaded(false);
      }
    }, [item?.key, item?.posterUrl]);

    return (
      <div
        role="button"
        tabIndex={-1}
        onMouseEnter={() => onHoverCell(rowIdx, colIdx)}
        onClick={() => onClickCell(rowIdx, colIdx, item)}
        onDoubleClick={() => onDoubleClickCell(item)}
        style={{
          width: `${posterWidth}px`,
          height: `${posterHeight}px`,
        }}
        className="relative shrink-0 overflow-hidden rounded-[2px] bg-[#090d14] cursor-pointer group"
      >
        {/* Subtle recessed dark frame placeholder while poster image streams in */}
        {item && !imgLoaded && item.kind === 'media' && (
          <div className="absolute inset-0 flex flex-col justify-end p-2.5 bg-gradient-to-b from-[#0d131f] to-[#06090f]">
            <span className="text-[11px] font-semibold text-neutral-400/90 line-clamp-2 leading-snug">
              {item.title}
            </span>
          </div>
        )}

        {item &&
          (item.kind === 'game' && item.game ? (
            <>
              <SafeGameImage
                primaryUrl={
                  item.game.poster || item.game.posterUrl || item.game.coverUrl
                }
                fallbackUrl={
                  item.game.consoleType === 'PS1'
                    ? item.game.boxFront
                    : item.game.boxFront || item.game.boxFrontUrl
                }
                title={item.game.title}
                consoleType={item.game.consoleType}
                alt={item.game.title}
                eager
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <ConsoleBoxOverlay
                consoleType={item.game.consoleType}
                mode={posterLabelMode}
                compact
              />
            </>
          ) : (
            <img
              ref={imgRef}
              src={item.posterUrl}
              alt={item.title}
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                setImgLoaded(true);
                handlePosterImageError(
                  e,
                  item.title,
                  item.media?.mediaType === 'tv' ? 'TV Shows' : 'Movies'
                );
              }}
              className={`w-full h-full object-cover transition-opacity duration-200 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              } ${isSelected ? '' : 'group-hover:brightness-110'}`}
            />
          ))}
        {item?.media && isUpcomingDate(item.media.releaseDate) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-1.5 pt-4 pb-1">
            <div className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-amber-400 truncate">
              Upcoming
            </div>
          </div>
        )}
      </div>
    );
  }
);

KaleidescapePosterTile.displayName = 'KaleidescapePosterTile';

export const KaleidescapeWall: React.FC<KaleidescapeWallProps> = ({
  mode,
  onChangeMode,
  games,
  gamesLoading,
  consoleTabs,
  selectedConsole,
  onSelectConsole,
  favorites,
  onToggleFavorite,
  searchQuery,
  onSearchChange,
  onSelectMedia,
  onLaunchGame,
  onInspect3D,
  onOpenSettings,
  renderComicsFallback,
}) => {
  const { settings, isInMyList, toggleMyList, recordContinueWatching } = useTheme();

  // Viewport geometry
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  useEffect(() => {
    const onResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Larger, cleaner cinema poster columns so both poster art and the Kaleidescape info panel never cramp
  const layout = useMemo(() => {
    const w = viewport.width;
    const cols = w >= 1440 ? 8 : w >= 1120 ? 7 : w >= 820 ? 5 : w >= 540 ? 4 : 3;
    const gap = w >= 1120 ? 8 : w >= 640 ? 6 : 5;
    const sidePad = w >= 1120 ? 10 : 6;
    const usableW = Math.max(280, w - sidePad * 2 - gap * (cols - 1));
    const posterWidth = Math.floor(usableW / cols);
    const posterHeight = Math.round(posterWidth * 1.5);
    const stepX = posterWidth + gap;
    const stepY = posterHeight + gap;
    // 2 columns wide gives ~350–400px width at desktop while never covering 3 neighbors
    const panelCols = cols >= 5 ? 2 : 2;
    return { cols, gap, sidePad, posterWidth, posterHeight, stepX, stepY, panelCols };
  }, [viewport.width]);

  // Smart Mouse-Reveal HUD: opens briefly on mount/mode change for instant section access,
  // stays pinned anytime cursor is within top 120px or hovered, and melts into the black void when idle.
  const [hudVisible, setHudVisible] = useState(true);
  const [hudHovered, setHudHovered] = useState(false);
  const [topZoneHovered, setTopZoneHovered] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHudHide = useCallback(() => {
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setHudVisible(false);
    }, 3400);
  }, []);

  const revealHud = useCallback(
    (clientY?: number) => {
      setHudVisible(true);
      const inTopBand = typeof clientY === 'number' && clientY <= 120;
      setTopZoneHovered(inTopBand);
      if (!inTopBand) {
        scheduleHudHide();
      } else if (hudTimerRef.current) {
        clearTimeout(hudTimerRef.current);
      }
    },
    [scheduleHudHide]
  );

  // Brief discovery reveal when entering Kaleidescape or changing sections
  useEffect(() => {
    setHudVisible(true);
    scheduleHudHide();
    return () => {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, [mode, scheduleHudHide]);

  // Cinema catalog pool + incremental bidirectional TMDB pagination
  const [cinemaPool, setCinemaPool] = useState<KaleidescapeItem[]>([]);
  const [cinemaLoading, setCinemaLoading] = useState(false);
  const [infoModalItem, setInfoModalItem] = useState<TmdbCatalogItem | null>(null);

  const cinemaSeenIdsRef = useRef<Set<string>>(new Set());
  const nextPageRef = useRef<number>(1);
  const fetchingPageRef = useRef<boolean>(false);
  const activeModeKeyRef = useRef<string>('');

  const loadMoreCinemaPages = useCallback(
    async (section: KaleidescapeSection, query: string, countPages = 2) => {
      if (section === 'games' || section === 'comics' || section === 'nostalgia') return;
      const runKey = `${section}:${query.trim()}`;
      if (fetchingPageRef.current && activeModeKeyRef.current === runKey) return;
      fetchingPageRef.current = true;

      try {
        const collected: KaleidescapeItem[] = [];
        const trimmed = query.trim();

        for (let p = 0; p < countPages; p++) {
          const pageToFetch = nextPageRef.current;
          if (pageToFetch > 40) break;
          nextPageRef.current += 1;

          let pageItems: TmdbCatalogItem[] = [];
          if (trimmed) {
            if (section === 'anime' || section === 'cartoons') {
              const res = await searchTmdbAnimation(trimmed, pageToFetch, {
                kidsOnly: section === 'cartoons',
              });
              pageItems = res.items;
            } else {
              const res = await searchTmdbByType(
                trimmed,
                section === 'tv' ? 'tv' : 'movie',
                pageToFetch
              );
              pageItems = res.items;
            }
          } else if (section === 'movies') {
            const [pop, top] = await Promise.all([
              fetchTmdbFeed('movie_popular', pageToFetch).catch(() => ({
                items: [] as TmdbCatalogItem[],
              })),
              pageToFetch <= 10
                ? fetchTmdbFeed('movie_top_rated', pageToFetch).catch(() => ({
                    items: [] as TmdbCatalogItem[],
                  }))
                : Promise.resolve({ items: [] as TmdbCatalogItem[] }),
            ]);
            pageItems = [...pop.items, ...top.items];
          } else if (section === 'tv') {
            const [pop, top] = await Promise.all([
              fetchTmdbFeed('tv_popular', pageToFetch).catch(() => ({
                items: [] as TmdbCatalogItem[],
              })),
              pageToFetch <= 10
                ? fetchTmdbFeed('tv_top_rated', pageToFetch).catch(() => ({
                    items: [] as TmdbCatalogItem[],
                  }))
                : Promise.resolve({ items: [] as TmdbCatalogItem[] }),
            ]);
            pageItems = [...pop.items, ...top.items];
          } else if (section === 'anime') {
            const [trend, movies] = await Promise.all([
              fetchTmdbAnimeFeed('trending', pageToFetch).catch(() => ({
                items: [] as TmdbCatalogItem[],
              })),
              pageToFetch <= 8
                ? fetchTmdbAnimeFeed('movies', pageToFetch).catch(() => ({
                    items: [] as TmdbCatalogItem[],
                  }))
                : Promise.resolve({ items: [] as TmdbCatalogItem[] }),
            ]);
            pageItems = [...trend.items, ...movies.items];
          } else if (section === 'cartoons') {
            const [trend, movies] = await Promise.all([
              fetchTmdbCartoonsFeed('trending', pageToFetch).catch(() => ({
                items: [] as TmdbCatalogItem[],
              })),
              pageToFetch <= 8
                ? fetchTmdbCartoonsFeed('movies', pageToFetch).catch(() => ({
                    items: [] as TmdbCatalogItem[],
                  }))
                : Promise.resolve({ items: [] as TmdbCatalogItem[] }),
            ]);
            pageItems = [...trend.items, ...movies.items];
          }

          if (activeModeKeyRef.current !== runKey) return;

          for (const item of pageItems) {
            if (!item.hasPoster || !item.posterUrl) continue;
            if (cinemaSeenIdsRef.current.has(item.id)) continue;
            cinemaSeenIdsRef.current.add(item.id);
            collected.push(mapTmdbToKaleidescape(item));
          }

          if (trimmed) break;
        }

        if (activeModeKeyRef.current === runKey && collected.length > 0) {
          setCinemaPool((prev) => [...prev, ...collected]);
        }
      } finally {
        if (activeModeKeyRef.current === runKey) {
          fetchingPageRef.current = false;
          setCinemaLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (mode === 'games' || mode === 'comics' || mode === 'nostalgia') return;
    const runKey = `${mode}:${searchQuery.trim()}`;
    activeModeKeyRef.current = runKey;
    cinemaSeenIdsRef.current = new Set();
    nextPageRef.current = 1;
    fetchingPageRef.current = false;
    setCinemaPool([]);
    setCinemaLoading(true);

    const delay = searchQuery.trim() ? 240 : 0;
    const t = setTimeout(() => {
      loadMoreCinemaPages(mode, searchQuery, searchQuery.trim() ? 1 : 3);
    }, delay);
    return () => clearTimeout(t);
  }, [mode, searchQuery, loadMoreCinemaPages]);

  // Games pool adapter
  const gamesPool = useMemo<KaleidescapeItem[]>(() => {
    if (mode !== 'games') return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = games.filter((g) => {
      const matchesConsole =
        selectedConsole === 'All'
          ? true
          : selectedConsole === 'Favorites'
          ? favorites.includes(g.id) || favorites.includes(g.slug) || favorites.includes(g.title)
          : g.consoleType === selectedConsole;
      if (!matchesConsole) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.consoleType.toLowerCase().includes(q) ||
        g.publisher.toLowerCase().includes(q)
      );
    });
    return filtered.map(mapGameToKaleidescape);
  }, [mode, games, selectedConsole, favorites, searchQuery]);

  const activePool = mode === 'games' ? gamesPool : cinemaPool;
  const isCatalogLoading =
    mode === 'games'
      ? gamesLoading && gamesPool.length === 0
      : cinemaLoading && cinemaPool.length === 0;

  // Selection & virtual scroll state
  const [selectedCoord, setSelectedCoord] = useState<{ row: number; col: number }>({
    row: INITIAL_ANCHOR_ROW,
    col: 4,
  });
  const worldRef = useRef<HTMLDivElement | null>(null);
  const currentScrollYRef = useRef<number>(0);
  const targetScrollYRef = useRef<number>(0);
  const [rowRange, setRowRange] = useState<{ start: number; end: number }>({
    start: -1,
    end: 5,
  });
  const rowRangeRef = useRef(rowRange);
  rowRangeRef.current = rowRange;

  // Optional gentle float drift toggle (off by default unless reduced-motion is false and toggled)
  const [ambientDrift, setAmbientDrift] = useState(false);
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const resetWallPosition = useCallback(() => {
    const centerRow = INITIAL_ANCHOR_ROW;
    const centerCol = Math.min(Math.max(0, layout.cols - 1), Math.floor(layout.cols / 2));
    const idealScrollY =
      centerRow * layout.stepY - Math.max(36, (viewport.height - layout.posterHeight) * 0.45);
    currentScrollYRef.current = idealScrollY;
    targetScrollYRef.current = idealScrollY;
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(0, ${-idealScrollY}px, 0)`;
    }
    const visibleRows = Math.ceil(viewport.height / layout.stepY);
    const initialRange = {
      start: Math.floor(idealScrollY / layout.stepY) - 1,
      end: Math.floor(idealScrollY / layout.stepY) + visibleRows + 1,
    };
    rowRangeRef.current = initialRange;
    setRowRange(initialRange);
    setSelectedCoord({ row: centerRow, col: centerCol });
  }, [layout.cols, layout.stepY, layout.posterHeight, viewport.height]);

  // Reset scroll/selection only on explicit context switches (mode, console filter, or search)
  useEffect(() => {
    resetWallPosition();
  }, [mode, selectedConsole, searchQuery, resetWallPosition]);

  // Fetch ahead cleanly inside useEffect as user explores up or down infinitely (never inside render!)
  useEffect(() => {
    if (mode === 'games' || mode === 'comics' || mode === 'nostalgia' || searchQuery.trim()) return;
    if (cinemaPool.length === 0 || fetchingPageRef.current) return;

    const maxBandNeeded = Math.max(
      getSpiralBand(rowRange.start),
      getSpiralBand(rowRange.end)
    );
    const slotsNeeded = (maxBandNeeded + 3) * layout.cols;
    if (slotsNeeded >= cinemaPool.length && nextPageRef.current <= 40) {
      loadMoreCinemaPages(mode, searchQuery, 2);
    }
  }, [rowRange.start, rowRange.end, cinemaPool.length, layout.cols, mode, searchQuery, loadMoreCinemaPages]);

  // Smooth compositor-driven rAF virtual scroll loop
  useEffect(() => {
    let rafId = 0;
    if (worldRef.current) {
      worldRef.current.style.transform = `translate3d(0, ${-currentScrollYRef.current}px, 0)`;
    }

    const tick = () => {
      if (ambientDrift && !prefersReducedMotion) {
        targetScrollYRef.current -= 0.45;
      }

      const curr = currentScrollYRef.current;
      const target = targetScrollYRef.current;
      const diff = target - curr;
      const nextY = Math.abs(diff) > 0.25 ? curr + diff * 0.18 : target;

      if (nextY !== curr) {
        currentScrollYRef.current = nextY;
        if (worldRef.current) {
          worldRef.current.style.transform = `translate3d(0, ${-nextY}px, 0)`;
        }
      }

      const startRow = Math.floor(nextY / layout.stepY) - 1;
      const visibleCount = Math.ceil(viewport.height / layout.stepY);
      const endRow = Math.floor(nextY / layout.stepY) + visibleCount + 1;

      if (startRow !== rowRangeRef.current.start || endRow !== rowRangeRef.current.end) {
        const nextRange = { start: startRow, end: endRow };
        rowRangeRef.current = nextRange;
        setRowRange(nextRange);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [layout.stepY, viewport.height, ambientDrift, prefersReducedMotion]);

  // Keep keyboard-selected row comfortably framed inside viewport
  const ensureRowVisible = useCallback(
    (targetRow: number) => {
      const topY = targetRow * layout.stepY;
      const bottomY = topY + layout.posterHeight;
      const margin = Math.max(24, layout.posterHeight * 0.18);
      const currTarget = targetScrollYRef.current;

      if (topY - margin < currTarget) {
        targetScrollYRef.current = topY - margin;
      } else if (bottomY + margin > currTarget + viewport.height) {
        targetScrollYRef.current = bottomY + margin - viewport.height;
      }
    },
    [layout.stepY, layout.posterHeight, viewport.height]
  );

  const handleActivateItem = useCallback(
    (item: KaleidescapeItem | null) => {
      if (!item) return;
      if (item.kind === 'game' && item.game) {
        onLaunchGame(item.game);
        return;
      }
      if (item.kind === 'media' && item.media) {
        const sourceTab =
          mode === 'games' || mode === 'comics' || mode === 'nostalgia' ? 'movies' : mode;
        recordContinueWatching(item.media, { sourceTab });
        onSelectMedia({
          mediaType: item.media.mediaType,
          tmdbId: item.media.tmdbId,
          previewItem: item.media,
          sourceTab,
        });
      }
    },
    [mode, onLaunchGame, onSelectMedia, recordContinueWatching]
  );

  // Keyboard M toggles removing/detaching the mouse cursor from directing posters so it never blocks navigation
  const [mouseDetached, setMouseDetached] = useState(false);
  const [mouseToast, setMouseToast] = useState<string | null>(null);
  const mouseToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardOverrideRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  const toggleMouseDetach = useCallback(() => {
    setMouseDetached((prev) => {
      const next = !prev;
      if (next) {
        keyboardOverrideRef.current = true;
        setMouseToast('Mouse removed from posters · Use Arrow keys (Press M to restore)');
      } else {
        keyboardOverrideRef.current = false;
        setMouseToast('Mouse poster control restored');
      }
      if (mouseToastTimerRef.current) clearTimeout(mouseToastTimerRef.current);
      mouseToastTimerRef.current = setTimeout(() => setMouseToast(null), 2600);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (mouseToastTimerRef.current) clearTimeout(mouseToastTimerRef.current);
    };
  }, []);

  // Tile callbacks (respects mouseDetached & keyboard priority so resting cursors never yank the square selector)
  const handleHoverCell = useCallback(
    (row: number, col: number) => {
      if (mouseDetached || keyboardOverrideRef.current) return;
      setSelectedCoord((prev) =>
        prev.row === row && prev.col === col ? prev : { row, col }
      );
    },
    [mouseDetached]
  );

  const handleClickCell = useCallback(
    (row: number, col: number, item: KaleidescapeItem | null) => {
      if (mouseDetached) return;
      keyboardOverrideRef.current = false;
      setSelectedCoord((prev) => {
        if (prev.row !== row || prev.col !== col) {
          return { row, col };
        }
        handleActivateItem(item);
        return prev;
      });
    },
    [handleActivateItem, mouseDetached]
  );

  const clampedCol = Math.min(Math.max(0, selectedCoord.col), layout.cols - 1);
  const selectedItem = useMemo(
    () => getDeterministicCellItem(activePool, selectedCoord.row, clampedCol, layout.cols),
    [activePool, selectedCoord.row, clampedCol, layout.cols]
  );

  // Keyboard navigation (M removes/restores mouse control; Arrow keys override stationary cursor automatically)
  useEffect(() => {
    if (mode === 'comics' || mode === 'nostalgia' || infoModalItem) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
          setSearchFocused(false);
        }
        return;
      }

      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMouseDetach();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        keyboardOverrideRef.current = true;
        setSelectedCoord((prev) => {
          if (prev.col > 0) return { row: prev.row, col: prev.col - 1 };
          const nextRow = prev.row - 1;
          ensureRowVisible(nextRow);
          return { row: nextRow, col: layout.cols - 1 };
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        keyboardOverrideRef.current = true;
        setSelectedCoord((prev) => {
          if (prev.col < layout.cols - 1) return { row: prev.row, col: prev.col + 1 };
          const nextRow = prev.row + 1;
          ensureRowVisible(nextRow);
          return { row: nextRow, col: 0 };
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        keyboardOverrideRef.current = true;
        setSelectedCoord((prev) => {
          const nextRow = prev.row - 1;
          ensureRowVisible(nextRow);
          return { row: nextRow, col: prev.col };
        });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        keyboardOverrideRef.current = true;
        setSelectedCoord((prev) => {
          const nextRow = prev.row + 1;
          ensureRowVisible(nextRow);
          return { row: nextRow, col: prev.col };
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleActivateItem(selectedItem);
      } else if (e.key === '/' || e.key.toLowerCase() === 'h') {
        revealHud(0);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    mode,
    infoModalItem,
    layout.cols,
    ensureRowVisible,
    handleActivateItem,
    selectedItem,
    revealHud,
    toggleMouseDetach,
  ]);

  // Touch & wheel scrolling
  const lastTouchYRef = useRef<number | null>(null);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    targetScrollYRef.current += e.deltaY;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches[0]) {
      lastTouchYRef.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches[0] && lastTouchYRef.current !== null) {
      const dy = lastTouchYRef.current - e.touches[0].clientY;
      lastTouchYRef.current = e.touches[0].clientY;
      targetScrollYRef.current += dy * 1.35;
    }
  };

  const visibleRows = useMemo(() => {
    const arr: number[] = [];
    for (let r = rowRange.start; r <= rowRange.end; r++) {
      arr.push(r);
    }
    return arr;
  }, [rowRange.start, rowRange.end]);

  // Sliding Golden Selection Frame + Attached Kaleidescape Slate-Blue Info Panel coordinates
  const frameX = layout.sidePad + clampedCol * layout.stepX;
  const frameY = selectedCoord.row * layout.stepY;
  const panelWidth =
    layout.panelCols * layout.posterWidth + (layout.panelCols - 1) * layout.gap;
  const dockRight = clampedCol < layout.panelCols;
  const panelTranslateX = dockRight ? layout.posterWidth : -panelWidth;

  const isSaved = selectedItem
    ? selectedItem.kind === 'media' && selectedItem.media
      ? isInMyList(selectedItem.media.id)
      : selectedItem.kind === 'game' && selectedItem.game
      ? favorites.includes(selectedItem.game.id || selectedItem.game.slug)
      : false
    : false;

  const showFloatingHud =
    hudVisible ||
    hudHovered ||
    topZoneHovered ||
    searchFocused ||
    Boolean(searchQuery.trim());

  const activeSectionMeta = SECTION_NAV.find((s) => s.key === mode) || SECTION_NAV[0];

  const renderFloatingHud = () => (
    <>
      {/* Subtle compact top-center reveal tab visible in Void rest state for instant section/settings access */}
      {!showFloatingHud && (
        <button
          type="button"
          onClick={() => revealHud(0)}
          onMouseEnter={() => revealHud(0)}
          aria-label="Show sections and settings"
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[68] inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/75 hover:bg-black/95 border border-white/15 hover:border-[#f2c94c]/60 text-[11px] font-bold text-neutral-300 hover:text-white backdrop-blur-md transition-all cursor-pointer opacity-75 hover:opacity-100 shadow-lg"
        >
          {activeSectionMeta.icon}
          <span>{activeSectionMeta.label}</span>
          <ChevronDown size={12} className="text-[#f2c94c]" />
        </button>
      )}

      <div
        onMouseEnter={() => {
          setHudHovered(true);
          setHudVisible(true);
        }}
        onMouseLeave={() => {
          setHudHovered(false);
          scheduleHudHide();
        }}
        className={`fixed top-3.5 left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-24px)] max-w-[1160px] transition-all duration-200 ${
          showFloatingHud
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 -translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl bg-[#070b12]/92 backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.92)]">
          {/* Brand + Section Switcher */}
          <div
            className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full"
            style={{ scrollbarWidth: 'none' }}
          >
            <span className="hidden sm:inline-flex items-center pr-2.5 mr-0.5 border-r border-white/15 text-xs font-extrabold tracking-wide text-[#f2c94c] whitespace-nowrap shrink-0">
              Kaleidescape
            </span>
            {SECTION_NAV.map((sec) => {
              const active = mode === sec.key;
              return (
                <button
                  key={`kal-nav-${sec.key}`}
                  type="button"
                  onClick={() => onChangeMode(sec.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#275e91] text-white border border-[#5ba3e0]/60 shadow-[0_0_16px_rgba(39,94,145,0.5)]'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10 border border-transparent'
                  }`}
                >
                  {sec.icon}
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Utilities: Console Filter, Search, Float, Settings Gear */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {mode === 'games' && (
              <select
                aria-label="Filter console system"
                value={selectedConsole}
                onChange={(e) => onSelectConsole(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#0e1726] border border-white/15 text-xs font-bold text-white outline-none cursor-pointer max-w-[130px]"
              >
                {consoleTabs.map((tab) => (
                  <option key={`kal-con-${tab}`} value={tab} className="bg-[#0b111b] text-white">
                    {tab}
                  </option>
                ))}
              </select>
            )}

            {mode !== 'comics' && mode !== 'nostalgia' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/75 border border-white/15 focus-within:border-[#f2c94c]/80 w-36 sm:w-48">
                <Search size={13} className="text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={mode === 'games' ? 'Find game...' : 'Find movie or show...'}
                  className="w-full bg-transparent text-xs text-white placeholder:text-neutral-500 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    aria-label="Clear search"
                    className="text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {mode !== 'comics' && mode !== 'nostalgia' && (
              <>
                <button
                  type="button"
                  onClick={toggleMouseDetach}
                  title={
                    mouseDetached
                      ? 'Mouse removed from posters — press M or click to restore'
                      : 'Remove mouse from posters so cursor cannot block selector (Shortcut: M)'
                  }
                  aria-label={mouseDetached ? 'Restore mouse control' : 'Remove mouse from posters'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    mouseDetached
                      ? 'bg-red-500/90 text-white border-red-400'
                      : 'bg-white/5 text-neutral-300 border-white/15 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {mouseDetached ? <MousePointerClick size={13} /> : <MousePointer size={13} />}
                  <span className="hidden md:inline">
                    {mouseDetached ? 'Mouse Off (M)' : 'Mouse (M)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAmbientDrift((d) => !d)}
                  title={ambientDrift ? 'Pause float drift' : 'Auto-float poster wall'}
                  aria-label={ambientDrift ? 'Pause float drift' : 'Auto-float poster wall'}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    ambientDrift
                      ? 'bg-[#f2c94c] text-black border-[#f2c94c]'
                      : 'bg-white/5 text-neutral-300 border-white/15 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {ambientDrift ? <Pause size={13} /> : <Sparkles size={13} />}
                  <span className="hidden md:inline">{ambientDrift ? 'Floating' : 'Float'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Open settings"
              title="Settings & Themes"
              data-settings-trigger="true"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[#f2c94c] hover:text-black border border-white/15 text-white grid place-items-center transition-colors cursor-pointer shrink-0"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  // Nostalgia TV rendered inside the Void with mouse-reveal HUD
  if (mode === 'nostalgia') {
    return (
      <div
        className="fixed inset-0 bg-black text-white overflow-y-auto"
        onMouseMove={(e) => revealHud(e.clientY)}
      >
        {renderFloatingHud()}
        <div className="pt-16 pb-12">
          <NostalgiaTvView externalSearch={searchQuery} />
        </div>
      </div>
    );
  }

  // Comics mode cleanly framed inside the Void with mouse-reveal HUD
  if (mode === 'comics') {
    return (
      <div
        className="fixed inset-0 bg-black text-white overflow-y-auto"
        onMouseMove={(e) => revealHud(e.clientY)}
      >
        {renderFloatingHud()}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-24 pb-16">
          {renderComicsFallback ? renderComicsFallback() : null}
        </div>
      </div>
    );
  }

  const handleContainerMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mouseDetached) {
      revealHud(e.clientY);
      if (keyboardOverrideRef.current) {
        const prev = lastMousePosRef.current;
        if (!prev) {
          lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        } else {
          const dist = Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
          if (dist > 14) {
            keyboardOverrideRef.current = false;
            lastMousePosRef.current = { x: e.clientX, y: e.clientY };
          }
        }
      } else {
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      }
    } else if (e.clientY <= 120) {
      // Allow top-band HUD reveal even when mouse is detached from posters
      revealHud(e.clientY);
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-black text-white overflow-hidden select-none ${
        mouseDetached ? 'cursor-none' : ''
      }`}
      onMouseMove={handleContainerMouseMove}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* Floating Mouse-Reveal Section Switcher + Gear Settings */}
      {renderFloatingHud()}

      {/* Mouse Detach Status Banner / Keyboard Toast */}
      {(mouseToast || mouseDetached) && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[65] pointer-events-none px-3.5 py-1.5 rounded-lg bg-[#070b12]/90 border border-[#f2c94c]/50 text-xs font-semibold text-white shadow-xl backdrop-blur-md whitespace-nowrap">
          {mouseToast || 'Mouse removed from posters · Arrow keys active · Press M to restore'}
        </div>
      )}

      {/* Loading Skeleton Wall */}
      {isCatalogLoading ? (
        <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-2 p-2.5 bg-black">
          {Array.from({ length: 32 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] w-full rounded-[2px] bg-[#0b1018] animate-pulse"
            />
          ))}
        </div>
      ) : activePool.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black">
          <p className="text-lg font-bold text-white">No matching titles found</p>
          <p className="text-xs text-neutral-400">
            Select another section at the top or clear your search filter.
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="px-4 py-2 rounded-lg bg-[#275e91] hover:bg-[#3173b0] text-xs font-bold text-white cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        /* Infinite Virtualized Poster Wall World (GPU translate3d compositing) */
        <div
          ref={worldRef}
          className={`absolute top-0 left-0 right-0 will-change-transform ${
            mouseDetached ? 'pointer-events-none' : ''
          }`}
          style={{
            transform: `translate3d(0, ${-currentScrollYRef.current}px, 0)`,
          }}
        >
          {/* Visible Virtual Poster Rows */}
          {visibleRows.map((rowIdx) => (
            <div
              key={`krow-${rowIdx}`}
              className="absolute top-0 left-0 right-0 flex"
              style={{
                transform: `translate3d(0, ${rowIdx * layout.stepY}px, 0)`,
                paddingLeft: `${layout.sidePad}px`,
                paddingRight: `${layout.sidePad}px`,
                gap: `${layout.gap}px`,
                height: `${layout.posterHeight}px`,
                contain: 'layout style',
              }}
            >
              {Array.from({ length: layout.cols }).map((_, colIdx) => {
                const cellItem = getDeterministicCellItem(
                  activePool,
                  rowIdx,
                  colIdx,
                  layout.cols
                );
                const isSelected =
                  selectedCoord.row === rowIdx && clampedCol === colIdx;
                return (
                  <KaleidescapePosterTile
                    key={`kcell-${rowIdx}-${colIdx}`}
                    item={cellItem}
                    rowIdx={rowIdx}
                    colIdx={colIdx}
                    posterWidth={layout.posterWidth}
                    posterHeight={layout.posterHeight}
                    isSelected={isSelected}
                    posterLabelMode={settings.posterLabelMode}
                    onHoverCell={handleHoverCell}
                    onClickCell={handleClickCell}
                    onDoubleClickCell={handleActivateItem}
                  />
                );
              })}
            </div>
          ))}

          {/* Smoothly Sliding Kaleidescape Golden Selection Frame + Attached Slate-Blue Info Panel */}
          {selectedItem && (
            <div
              className="absolute top-0 left-0 z-30 pointer-events-none will-change-transform"
              style={{
                width: `${layout.posterWidth}px`,
                height: `${layout.posterHeight}px`,
                transform: `translate3d(${frameX}px, ${frameY}px, 0)`,
                transition: prefersReducedMotion
                  ? 'none'
                  : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {/* Attached Kaleidescape Slate-Blue Info Panel */}
              <div
                style={{
                  width: `${panelWidth}px`,
                  height: `${layout.posterHeight}px`,
                  transform: `translate3d(${panelTranslateX}px, 0, 0)`,
                  transition: prefersReducedMotion
                    ? 'none'
                    : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                  background:
                    'linear-gradient(135deg, #275e91 0%, #1b466f 58%, #133454 100%)',
                }}
                className="absolute top-0 left-0 pointer-events-auto shadow-[0_24px_60px_rgba(0,0,0,0.92)] border border-white/15 rounded-[2px] flex flex-col justify-between p-3 sm:p-4 overflow-hidden"
              >
                <div
                  key={selectedItem.key}
                  className="space-y-1 sm:space-y-1.5 min-w-0 animate-[fadeIn_140ms_ease]"
                >
                  <h2 className="text-sm sm:text-base lg:text-xl font-bold text-white leading-snug line-clamp-2 tracking-tight">
                    {selectedItem.title}
                  </h2>

                  {selectedItem.metaLine && (
                    <div className="text-[10.5px] sm:text-xs font-semibold text-[#b8dbff] truncate tabular-nums">
                      {selectedItem.metaLine}
                    </div>
                  )}

                  {selectedItem.media && isUpcomingDate(selectedItem.media.releaseDate) && (
                    <div className="text-[10.5px] sm:text-xs font-bold text-amber-300 truncate">
                      Upcoming · {formatReleaseNote(selectedItem.media.releaseDate, 'Not released yet')}
                    </div>
                  )}

                  <p className="text-[11px] sm:text-xs lg:text-[13px] text-[#e6f2ff] leading-snug line-clamp-2 sm:line-clamp-3 lg:line-clamp-4">
                    {selectedItem.overview}
                  </p>
                </div>

                {/* Action Controls pinned cleanly at bottom */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1.5 mt-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => handleActivateItem(selectedItem)}
                    className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded bg-[#f2c94c] hover:bg-[#f7d66b] text-[#08101c] text-[11px] sm:text-xs font-extrabold transition-colors cursor-pointer shadow-md whitespace-nowrap"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>{selectedItem.kind === 'game' ? 'Play' : 'Watch'}</span>
                  </button>

                  {selectedItem.kind === 'media' && selectedItem.media && (
                    <button
                      type="button"
                      onClick={() => setInfoModalItem(selectedItem.media!)}
                      className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded bg-black/35 hover:bg-black/55 border border-white/20 text-white text-[11px] sm:text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Info size={12} />
                      <span className="hidden sm:inline">Details</span>
                    </button>
                  )}

                  {selectedItem.kind === 'game' && selectedItem.game && (
                    <button
                      type="button"
                      onClick={() => onInspect3D(selectedItem.game!)}
                      className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded bg-black/35 hover:bg-black/55 border border-white/20 text-white text-[11px] sm:text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Box size={12} />
                      <span className="hidden sm:inline">3D Box</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedItem.kind === 'media' && selectedItem.media) {
                        toggleMyList(selectedItem.media);
                      } else if (selectedItem.kind === 'game' && selectedItem.game) {
                        onToggleFavorite(selectedItem.game.id || selectedItem.game.slug);
                      }
                    }}
                    aria-label={isSaved ? 'Saved in list' : 'Save to list'}
                    title={isSaved ? 'Remove from saved' : 'Save to list'}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded border grid place-items-center transition-colors cursor-pointer shrink-0 ${
                      isSaved
                        ? 'bg-[#f2c94c] border-[#f2c94c] text-black'
                        : 'bg-black/35 hover:bg-black/55 border-white/20 text-white'
                    }`}
                  >
                    {isSaved ? <Check size={13} /> : <Bookmark size={13} />}
                  </button>
                </div>
              </div>

              {/* Golden-Yellow Kaleidescape Square Selection Frame around active poster */}
              <div
                onClick={() => handleActivateItem(selectedItem)}
                className="relative w-full h-full pointer-events-auto cursor-pointer border-[5px] sm:border-[6px] border-[#f2c94c] rounded-[2px] shadow-[0_18px_50px_rgba(0,0,0,0.92),0_0_24px_rgba(242,201,76,0.28)]"
                style={{ boxSizing: 'border-box' }}
                title={`Open ${selectedItem.title}`}
              />
            </div>
          )}
        </div>
      )}

      {/* Cinema Info Modal */}
      <NetflixInfoModal
        item={infoModalItem}
        onClose={() => setInfoModalItem(null)}
        onPlay={(targetItem, s, e) => {
          setInfoModalItem(null);
          const sourceTab = mode === 'games' ? 'movies' : mode;
          recordContinueWatching(targetItem, { season: s, episode: e, sourceTab });
          onSelectMedia({
            mediaType: targetItem.mediaType,
            tmdbId: targetItem.tmdbId,
            initialSeason: s,
            initialEpisode: e,
            previewItem: targetItem,
            sourceTab,
          });
        }}
        onSelectOther={(other) => setInfoModalItem(other)}
      />
    </div>
  );
};

export default KaleidescapeWall;
