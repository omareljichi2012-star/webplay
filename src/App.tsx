import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Gamepad2,
  Search,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
  Play,
  AlertCircle,
  ExternalLink,
  Star,
  MessageSquare,
  Send,
  Calendar,
  Monitor,
  Sparkles,
  Box,
  Film,
  Tv,
  BookOpen,
  Smile,
  ShieldCheck,
  Layers,
  Flame,
  CheckCircle2,
  ChevronDown,
  Bookmark,
  Check,
  Heart,
  Info,
  Settings,
  Radio
} from 'lucide-react';
import { GameItem, GameReview, ManifestGameItem } from './types';
import { CONSOLE_SOURCES } from './sources';
import { getGameReviews, saveUserReview } from './reviews';
import { PlayerView, SafeGameImage, GameBox3DModal, StreamPlayer, AdSenseBanner, FeaturedHeroBanner, ComicsComingSoon, MoviesSection, MoviePlayerView, MoviePlayerTarget, WebPlayTimeLogo, PopcornClapperIcon, PopcornRetroTvIcon, ConsoleBoxOverlay, SettingsModal, GamOnlView, KaleidescapeWall, NostalgiaTvView } from './components';
import type { MoviesCatalogState, CinemaSectionMode } from './components/MoviesSection';
import { enrichGameWithLaunchBox3D, enrichManifestWithLaunchBoxApi, enrichGameWithLaunchBoxApi } from './launchboxApi';
import { STREAMING_CATALOG, MediaStreamItem } from './data/streamingData';
import { adShield } from './utils/adBlocker';
import { GTA_V_POSTER_URL, handlePosterImageError } from './utils/posterFallback';
import { fetchServerCatalogStats, fetchTmdbArchiveManifest, findByImdbId } from './services/tmdb';
import { isImdbId } from './utils/movieServers';
import { useTheme, NetflixProfile } from './context/ThemeContext';

const NetflixProfileAvatar: React.FC<{ profile: NetflixProfile; size?: number }> = ({ profile, size = 28 }) => {
  const bg = profile === 'Kids' ? '#0ea5e9' : profile === 'Anime' ? '#eab308' : '#E50914';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="rounded-[4px] shrink-0"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="4" fill={bg} />
      <circle cx="10.5" cy="12" r="2" fill="#ffffff" />
      <circle cx="21.5" cy="12" r="2" fill="#ffffff" />
      <path
        d="M9 19 C12.5 23.5, 19.5 23.5, 23 19"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
};


// Declare Ruffle global
declare global {
  interface Window {
    RufflePlayer?: {
      config?: any;
      newest?: () => {
        createPlayer: () => HTMLElement & {
          load: (options: any) => Promise<void>;
          pause?: () => void;
          play?: () => void;
          isPlaying?: boolean;
        };
      };
      [key: string]: any;
    };
  }
}

const DEFAULT_CONSOLE_TABS = [
  'All',
  'Favorites',
  'WebPort',
  'Flash',
  'NES',
  'SNES',
  'GBA',
  'Game Boy',
  'Game Boy Color',
  'Sega Genesis',
  'Master System',
  'Game Gear',
  'TurboGrafx-16',
  'N64',
  'PS1',
  'PSP',
  'Sega Saturn',
  'Atari 2600',
  'Atari 7800',
  'Sega CD',
  'Sega 32X',
  'MS-DOS',
  'Virtual Boy',
  'Nintendo DS'
];
const ITEMS_PER_PAGE = 50; // Optimized 50 items per view page for massive 1,000+ catalog

export default function App() {
  const {
    theme,
    isNetflix,
    isPopcorn,
    isGamOnl,
    isKaleidescape,
    netflixProfile,
    setNetflixProfile,
    myList,
    settings,
  } = useTheme();

  const [showNetflixMyList, setShowNetflixMyList] = useState(false);
  useEffect(() => {
    if (theme !== 'netflix') {
      setShowNetflixMyList(false);
    }
  }, [theme]);
  const [showNetflixSearch, setShowNetflixSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPopcornSearch, setShowPopcornSearch] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [popcornGameDetail, setPopcornGameDetail] = useState<GameItem | null>(null);

  const [games, setGames] = useState<GameItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tmdbCounts, setTmdbCounts] = useState<{ movies: number; tv: number; total: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConsole, setSelectedConsole] = useState<string>('All');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Favorites state with localStorage persistence
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('arcadia_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('arcadia_favorites', JSON.stringify(favorites));
    } catch (e) {}
  }, [favorites]);

  const toggleFavorite = (gameId: string) => {
    setFavorites(prev =>
      prev.includes(gameId) ? prev.filter(id => id !== gameId) : [...prev, gameId]
    );
  };

  // Dynamic console tabs computed from loaded games
  const consoleTabs = useMemo(() => {
    const presentConsoles = new Set(games.map(g => g.consoleType).filter(Boolean));
    const ordered = DEFAULT_CONSOLE_TABS.filter(c => c === 'All' || c === 'Favorites' || presentConsoles.has(c));
    presentConsoles.forEach(c => {
      if (!ordered.includes(c)) ordered.push(c);
    });
    return ordered;
  }, [games]);

  // View state: 'catalog' | 'player' | 'stream_player' | 'movie_player'
  const [currentView, setCurrentView] = useState<'catalog' | 'player' | 'stream_player' | 'movie_player'>('catalog');
  const [activeGame, setActiveGame] = useState<GameItem | null>(null);
  const [activeStreamItem, setActiveStreamItem] = useState<MediaStreamItem | null>(null);
  const [activeMovieTarget, setActiveMovieTarget] = useState<MoviePlayerTarget | null>(null);
  const moviesCatalogMemoryRef = useRef<Partial<Record<CinemaSectionMode, MoviesCatalogState>>>({});
  const [mainTab, setMainTab] = useState<'games' | 'movies' | 'tv' | 'anime' | 'cartoons' | 'nostalgia' | 'comics'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tv')) return 'tv';
      if (params.get('movie') || params.get('id')) return 'movies';
    } catch {}
    return settings.defaultSection || 'games';
  });

  const handleSelectMainTab = (nextTab: 'games' | 'movies' | 'tv' | 'anime' | 'cartoons' | 'nostalgia' | 'comics') => {
    setShowNetflixMyList(false);
    setPopcornGameDetail(null);
    setMainTab(nextTab);
  };

  // Open standalone Movie/TV player page directly when URL contains ?movie=, ?tv=, or ?id=
  useEffect(() => {
    let cancelled = false;
    const openFromUrl = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tvParam = params.get('tv')?.trim();
        const movieParam = (params.get('movie') || params.get('id'))?.trim();

        if (tvParam) {
          if (isImdbId(tvParam)) {
            const resolved = await findByImdbId(tvParam);
            if (!cancelled && resolved) {
              setActiveMovieTarget({
                mediaType: resolved.mediaType,
                tmdbId: resolved.tmdbId,
                customRawId: tvParam,
              });
              setCurrentView('movie_player');
              return;
            }
          }
          if (!cancelled) {
            setActiveMovieTarget({ mediaType: 'tv', tmdbId: tvParam });
            setCurrentView('movie_player');
          }
          return;
        }

        if (movieParam) {
          if (isImdbId(movieParam)) {
            const resolved = await findByImdbId(movieParam);
            if (!cancelled && resolved) {
              setActiveMovieTarget({
                mediaType: resolved.mediaType,
                tmdbId: resolved.tmdbId,
                customRawId: movieParam,
              });
              setCurrentView('movie_player');
              return;
            }
          }
          if (!cancelled) {
            setActiveMovieTarget({ mediaType: 'movie', tmdbId: movieParam });
            setCurrentView('movie_player');
          }
        }
      } catch {}
    };

    openFromUrl();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentView === 'movie_player') return;
    try {
      const url = new URL(window.location.href);
      if (
        url.searchParams.has('movie') ||
        url.searchParams.has('tv') ||
        url.searchParams.has('id') ||
        url.searchParams.has('server') ||
        url.searchParams.has('s') ||
        url.searchParams.has('e')
      ) {
        url.searchParams.delete('movie');
        url.searchParams.delete('tv');
        url.searchParams.delete('id');
        url.searchParams.delete('server');
        url.searchParams.delete('s');
        url.searchParams.delete('e');
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {}
  }, [currentView, mainTab]);
  const [inspecting3DGame, setInspecting3DGame] = useState<GameItem | null>(null);
  const [showWebPortComingSoon, setShowWebPortComingSoon] = useState(false);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const [ruffleError, setRuffleError] = useState<string | null>(null);

  // Keyboard shortcuts for cycling through console filter tabs using Left/Right arrow keys
  useEffect(() => {
    if (currentView !== 'catalog' || mainTab !== 'games') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable) {
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const currentIndex = consoleTabs.indexOf(selectedConsole);
        if (currentIndex === -1) {
          setSelectedConsole('All');
          return;
        }

        let nextIndex = e.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex >= consoleTabs.length) nextIndex = 0;
        if (nextIndex < 0) nextIndex = consoleTabs.length - 1;

        setSelectedConsole(consoleTabs[nextIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentView, mainTab, consoleTabs, selectedConsole]);

  // Initialize Ad-Shield and load full TMDB catalog counts on mount
  useEffect(() => {
    adShield.init();
    fetchServerCatalogStats().then((stats) => {
      if (stats) {
        setTmdbCounts({
          movies: stats.moviesCount,
          tv: stats.tvCount,
          total: stats.totalTitles,
        });
        return;
      }
      fetchTmdbArchiveManifest().then((manifest) => {
        if (manifest) {
          setTmdbCounts({
            movies: manifest.fullMoviesCount || manifest.moviesCount,
            tv: manifest.fullTvCount || manifest.tvCount,
            total: manifest.fullTotalTitles || manifest.totalTitles,
          });
        }
      });
    });
  }, []);


  // Reviews state for active game
  const [activeReviews, setActiveReviews] = useState<GameReview[]>([]);
  const [reviewHandle, setReviewHandle] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const ruffleContainerRef = useRef<HTMLDivElement>(null);
  const activeRufflePlayerRef = useRef<any>(null);

  // Global error handler to catch and suppress harmless cross-origin "Script error." & unhandled rejections
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      if (
        !event.message || 
        event.message === 'Script error.' || 
        event.message === '[object Object]' ||
        event.message?.toLowerCase().includes('null function') ||
        event.filename?.includes('emulatorjs') || 
        event.filename?.includes('fiveplay') || 
        event.filename?.includes('cdn') ||
        event.filename?.startsWith('blob:') ||
        (event.error && event.error.name === 'RuntimeError')
      ) {
        event.preventDefault();
        return true;
      }
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message?.toLowerCase().includes('null function') || event.reason?.name === 'RuntimeError') {
        event.preventDefault();
        return;
      }
      event.preventDefault();
    };
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // Load games database from separate console JSON files with retry resilience
  useEffect(() => {
    let cancelled = false;

    const fetchManifestWithRetry = async (manifestUrl: string, retries = 3): Promise<any[]> => {
      const resolvedUrl = new URL(manifestUrl, window.location.origin).toString();
      let lastErr: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetch(resolvedUrl, attempt > 0 ? { cache: 'no-store' } : undefined);
          if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${manifestUrl}`);
          const json = await res.json();
          return Array.isArray(json) ? json : [];
        } catch (err) {
          lastErr = err;
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt)));
          }
        }
      }
      throw lastErr;
    };

    const loadGames = async () => {
      try {
        setLoading(true);
        const allLoadedGames: GameItem[] = [];
        const batchSize = 4;

        for (let i = 0; i < CONSOLE_SOURCES.length; i += batchSize) {
          if (cancelled) return;
          const batch = CONSOLE_SOURCES.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map(async (source) => {
              try {
                const data = await fetchManifestWithRetry(source.manifestUrl);
                const mapped: GameItem[] = [];
                data.forEach((item: any) => {
                  const slug = item.slug || '';
                  const encodedSlug = slug.split('/').map((p: string) => encodeURIComponent(p)).join('/');
                  const targetUrl =
                    item.embed_url ||
                    item.streamUrl ||
                    item.url ||
                    item.rom_url ||
                    (source.romSourceBaseUrl ? `${source.romSourceBaseUrl}${encodedSlug}` : slug);
                  const baseGame: GameItem = {
                    ...item,
                    id:
                      item.id ||
                      `${source.console.toLowerCase()}-${slug
                        .replace(/\.[^/.]+$/, '')
                        .replace(/[^a-zA-Z0-9_-]/g, '-')
                        .toLowerCase()}`,
                    consoleType: item.consoleType || source.console,
                    engine: item.engine || source.engine,
                    core: item.core || source.core,
                    url: targetUrl,
                    streamUrl: item.embed_url || item.streamUrl || targetUrl,
                    rom_url: targetUrl,
                  };
                  mapped.push(enrichGameWithLaunchBox3D(baseGame));
                });
                return mapped;
              } catch (err) {
                console.warn(`Unable to load source ${source.console} after retries:`, err);
                return [] as GameItem[];
              }
            })
          );

          for (const items of batchResults) {
            allLoadedGames.push(...items);
          }
        }

        if (cancelled) return;
        setGames(allLoadedGames);
        setLoading(false);

        // Progressively fetch real 3D asset URLs (box art and cartridge) from LaunchBox Games Database API
        enrichManifestWithLaunchBoxApi(allLoadedGames, (updatedGame) => {
          if (cancelled) return;
          setGames(prevGames =>
            prevGames.map(g => (g.id === updatedGame.id ? { ...g, ...updatedGame } : g))
          );
          setActiveGame(prev => (prev && prev.id === updatedGame.id ? { ...prev, ...updatedGame } : prev));
          setInspecting3DGame(prev => (prev && prev.id === updatedGame.id ? { ...prev, ...updatedGame } : prev));
        });
      } catch (err) {
        console.warn('Failed to load game data:', err);
        if (!cancelled) setLoading(false);
      }
    };
    loadGames();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute genres
  const genres = useMemo(() => {
    const set = new Set<string>();
    games.forEach(g => {
      if (g.genre) set.add(g.genre);
    });
    return ['All', ...Array.from(set).sort()];
  }, [games]);

  // Filtered games
  const filteredGames = useMemo(() => {
    return games.filter(g => {
      const matchesSearch =
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.publisher.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesConsole =
        selectedConsole === 'All'
          ? true
          : selectedConsole === 'Favorites'
          ? favorites.includes(g.id) || favorites.includes(g.slug) || favorites.includes(g.title)
          : g.consoleType === selectedConsole;
      const matchesGenre = selectedGenre === 'All' || g.genre === selectedGenre;
      return matchesSearch && matchesConsole && matchesGenre;
    });
  }, [games, searchQuery, selectedConsole, selectedGenre, favorites]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedConsole, selectedGenre]);

  // Pagination (50 items per view page)
  const totalPages = Math.ceil(filteredGames.length / ITEMS_PER_PAGE) || 1;
  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredGames.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredGames, currentPage]);

  // Load reviews when active game changes
  useEffect(() => {
    if (activeGame) {
      setActiveReviews(getGameReviews(activeGame.id, activeGame.title, activeGame.rating));
      setReviewComment('');
    }
  }, [activeGame]);

  // Initialize game runner (Ruffle for Flash)
  useEffect(() => {
    if (!activeGame || activeGame.engine !== 'ruffle') return;
    if (!ruffleContainerRef.current) return;

    setRuffleError(null);
    const container = ruffleContainerRef.current;
    container.innerHTML = '';

    const setupRuffle = () => {
      // Ensure Ruffle configuration is globally defined
      window.RufflePlayer = window.RufflePlayer || {};
      window.RufflePlayer.config = window.RufflePlayer.config || {
        publicPath: 'https://cdn.jsdelivr.net/npm/@ruffle-rs/ruffle@0.7.1/',
        polyfillStyle: 'none',
        autoplay: 'on',
        unmuteOverlay: 'hidden',
        letterbox: 'on',
        warnOnUnsupportedContent: false,
      };

      if (!window.RufflePlayer || typeof window.RufflePlayer.newest !== 'function') {
        setRuffleError('Initializing Ruffle Flash WebAssembly emulator...');
        setTimeout(setupRuffle, 300);
        return;
      }

      try {
        const ruffle = window.RufflePlayer.newest();
        const player = ruffle.createPlayer();
        player.style.width = '100%';
        player.style.height = '100%';

        container.appendChild(player);
        activeRufflePlayerRef.current = player;

        player.load({
          url: activeGame.url,
          allowScriptAccess: true,
          parameters: '',
          autoplay: 'on',
        }).catch((err: any) => {
          console.warn('Ruffle load attempt failed, retrying with raw URL string:', err);
          player.load(activeGame.url).catch((err2: any) => {
            console.error('Ruffle load error:', err2);
            setRuffleError(
              `Could not load SWF: ${activeGame.url}. The file might be temporarily blocked by CORS.`
            );
          });
        });
      } catch (e: any) {
        console.error('Failed to create Ruffle player', e);
        setRuffleError(`Ruffle error: ${e.message}`);
      }
    };

    setupRuffle();

    return () => {
      if (container) container.innerHTML = '';
      activeRufflePlayerRef.current = null;
    };
  }, [activeGame]);

  const handleLaunchGame = (game: GameItem) => {
    let resolvedGame = game;
    // If GTA V, ensure streamUrl points directly to https://fiveplay.lol/ (V1)
    if (game.id === 'gta5' || game.id === 'webport-gtav' || game.id === 'gtav-web' || game.title.toLowerCase() === 'gta v' || game.title.toLowerCase().includes('gta 5') || game.title.toLowerCase().includes('grand theft auto v')) {
      resolvedGame = {
        ...game,
        id: 'webport-gtav',
        title: 'GTA V',
        consoleType: 'WebPort',
        engine: 'web',
        url: 'https://fiveplay.lol/',
        streamUrl: 'https://fiveplay.lol/',
        poster: game.poster || GTA_V_POSTER_URL
      };
    }
    // If Need for Speed Underground 2, ensure streamUrl points to V1 (https://nfsunderground2.site/)
    if (game.id === 'webport-nfsu2' || game.title.toLowerCase().includes('underground 2') || game.title.toLowerCase().includes('nfsu2')) {
      resolvedGame = {
        ...game,
        id: 'webport-nfsu2',
        title: 'Need for Speed Underground 2',
        consoleType: 'WebPort',
        engine: 'web',
        url: 'https://nfsunderground2.site/',
        streamUrl: 'https://nfsunderground2.site/'
      };
    }
    setActiveGame(resolvedGame);
    setCurrentView('player');
  };

  useEffect(() => {
    if (activeGame) {
      setTimeout(() => {
        const scrollEl = document.querySelector('.player-scroll-content');
        if (scrollEl) {
          scrollEl.scrollTop = 0;
        }
      }, 30);
    }
  }, [activeGame]);

  const handleClosePlayer = () => {
    // 1. Forcefully detach EmulatorJS event listeners and globals to prevent teardown crashes
    try {
      if ((window as any).EJS_emulator) {
        // Attempt a silent pause if possible
        try { (window as any).EJS_emulator.pause(); } catch (e) {}
        
        // No-op the save function to prevent the "null function" WASM error
        if ((window as any).EJS_GameManager) {
          (window as any).EJS_GameManager.saveSaveFiles = () => Promise.resolve();
        }
        
        if (typeof (window as any).EJS_emulator.stop === 'function') {
          (window as any).EJS_emulator.stop();
        }
      }
    } catch (e) {}

    // 2. Kill the iframe context immediately
    const playerFrame = document.getElementById('player-iframe') as HTMLIFrameElement;
    if (playerFrame) {
      try {
        playerFrame.src = 'about:blank';
        playerFrame.remove();
      } catch (e) {}
    }

    // 3. Clear the DOM container
    const gameEl = document.getElementById('game');
    if (gameEl) gameEl.innerHTML = '';

    setActiveGame(null);
    setCurrentView('catalog');
    setRuffleError(null);
    setIsPlayerFullscreen(false);
  };

  const handleRestartGame = () => {
    if (!activeGame) return;
    const currentGame = activeGame;
    setActiveGame(null);
    setTimeout(() => setActiveGame(currentGame), 80);
  };

  const toggleFullscreen = () => {
    const targetEl = document.getElementById('active-game-canvas') || document.getElementById('game') || document.querySelector('.player-window');
    if (!targetEl) return;

    if (!document.fullscreenElement) {
      targetEl.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsPlayerFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => {
        console.error(`Error attempting to disable full-screen mode: ${err.message}`);
      });
      setIsPlayerFullscreen(false);
    }
  };

  // Submit comment & review
  const handlePostReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGame || !reviewComment.trim()) return;

    const updated = saveUserReview(
      activeGame.id,
      reviewHandle,
      reviewRating,
      reviewComment
    );
    setActiveReviews(updated);
    setReviewComment('');
  };



  // Local SWF or ROM Uploader for testing
  const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const blobUrl = URL.createObjectURL(file);
    const ext = file.name.split('.').pop()?.toLowerCase();

    const isSwf = ext === 'swf';
    let detectedConsole: GameItem['consoleType'] = 'Flash';
    let core = undefined;

    if (ext === 'nes') {
      detectedConsole = 'NES';
      core = 'fceumm';
    } else if (ext === 'sfc' || ext === 'smc') {
      detectedConsole = 'SNES';
      core = 'snes';
    } else if (ext === 'gba') {
      detectedConsole = 'GBA';
      core = 'gba';
    } else if (ext === 'bin' || ext === 'gen' || ext === 'md') {
      detectedConsole = 'Sega Genesis';
      core = 'segaMD';
    } else if (ext === 'nds') {
      detectedConsole = 'Nintendo DS';
      core = 'nds';
    } else if (ext === 'z64' || ext === 'n64') {
      detectedConsole = 'N64';
      core = 'n64';
    } else if (ext === 'pbp' || ext === 'chd' || ext === 'cue') {
      detectedConsole = 'PS1';
      core = 'psx';
    }

    const customGame: GameItem = {
      id: `custom-${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      slug: file.name,
      consoleType: detectedConsole,
      engine: isSwf ? 'ruffle' : 'emulatorjs',
      core: core,
      genre: 'Custom File',
      year: 2026,
      rating: 9.0,
      url: blobUrl,
      poster: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
      synopsis: `Custom game cartridge loaded directly from your device storage (${file.name}).`,
      publisher: 'Local Storage',
      releaseDate: 'Custom Release',
    };

    setActiveGame(customGame);
  };

  // ISOLATE FLASH & PURGE SMW VARIABLE INFECTION (EXCLUSION FILTERS)
  useEffect(() => {
    if (!activeGame) return;

    const isCustomWeb = activeGame.engine === 'web' ||
                        activeGame.engine === 'iframe' ||
                        Boolean(activeGame.embed_url) ||
                        activeGame.consoleType === 'WebPort' ||
                        activeGame.consoleType === 'Web Port' ||
                        activeGame.id === 'webport-gtav' ||
                        activeGame.id === 'gtav-web' ||
                        activeGame.url?.includes('fiveplay.lol') ||
                        activeGame.id === 'gen-sonic-the-hedgehog' ||
                        (activeGame.title.toLowerCase() === 'sonic the hedgehog' && activeGame.consoleType === 'Sega Genesis');

    const isFlash = activeGame.engine === 'ruffle' ||
                    activeGame.consoleType === 'Flash' ||
                    (activeGame.url && activeGame.url.toLowerCase().endsWith('.swf'));

    const isPspGame = activeGame.consoleType === 'PSP' || 
                      activeGame.consoleType === 'PlayStation Portable' ||
                      (activeGame.core && activeGame.core.toLowerCase() === 'ppsspp');

    const isNonEJS = isFlash || isCustomWeb || isPspGame;

    if (isNonEJS) {
      if ((window as any).EJS_player) {
        (window as any).EJS_player = null;
        (window as any).EJS_core = null;
        (window as any).EJS_gameUrl = null;
        (window as any).EJS_biosUrl = null;
        (window as any).EJS_pathtodata = null;
        (window as any).EJS_startOnLoaded = null;
        const staleScripts = document.querySelectorAll('script[src*="emulatorjs"]');
        staleScripts.forEach(script => script.remove());
      }
      return;
    }

    // Complete Reset for Retro Consoles: Forcefully clear out prior configurations
    if ((window as any).EJS_player) {
      (window as any).EJS_player = null;
      (window as any).EJS_core = null;
      (window as any).EJS_gameUrl = null;
      (window as any).EJS_biosUrl = null;
      (window as any).EJS_pathtodata = null;
      (window as any).EJS_startOnLoaded = null;

      // Wipe lingering DOM scripts to prevent the browser from loading the cached SMW file structure
      const staleScripts = document.querySelectorAll('script[src*="emulatorjs"]');
      staleScripts.forEach(script => script.remove());
    }

    // Clear game element container
    const gameContainer = document.getElementById('game');
    if (gameContainer) {
      gameContainer.innerHTML = '';
    }

    const origin = window.location.origin;

    // Bind fresh parameters explicitly matching the NEW non-Flash selected game object
    (window as any).EJS_player = '#game';
    (window as any).EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/'; // Restores core asset mirrors
    (window as any).EJS_startOnLoaded = true;

    // Configure Retro Game Shaders (CRT, Scanlines, Pixel-Perfect)
    const savedShader = localStorage.getItem('retro_shader_preference') || 'none';
    const SHADER_PRESETS_MAP: Record<string, string> = {
      'none': '',
      'crt': 'https://cdn.jsdelivr.net/gh/libretro/glsl-shaders@master/crt/crt-easymode.glslp',
      'scanlines': 'https://cdn.jsdelivr.net/gh/libretro/glsl-shaders@master/misc/scanline.glslp',
      'pixel-perfect': 'https://cdn.jsdelivr.net/gh/libretro/glsl-shaders@master/interpolation/sharp-bilinear.glslp',
      'crt-curved': 'https://cdn.jsdelivr.net/gh/libretro/glsl-shaders@master/crt/crt-lottes.glslp'
    };
    (window as any).EJS_shaders = SHADER_PRESETS_MAP[savedShader] || '';

    // STRICT ZERO-MISTAKE CONSOLE ROUTING MATRIX
    const consoleSystem = (activeGame.console_type || activeGame.consoleType || activeGame.core || '').toLowerCase().trim();
    const isPs1Console = ['ps1', 'psx', 'playstation'].includes(consoleSystem);

    // AUTO-BYPASS CORS BLOCK & ZERO-NETWORK-ERROR STREAMING:
    let rawUrl = activeGame.streamUrl || activeGame.rom_url || activeGame.url || '';

    // Determine accurate filename and extension so EmulatorJS correctly identifies CHD/ROM format
    let fileName = '';
    try {
      const parsed = new URL(rawUrl);
      const parts = parsed.pathname.split('/');
      fileName = decodeURIComponent(parts[parts.length - 1] || '');
    } catch (e) {}

    if (!fileName) {
      const safeTitle = (activeGame.title || 'game').replace(/[^a-zA-Z0-9_\-\. ]/g, '').trim();
      const defaultExt = isPs1Console ? '.chd' : '.nes';
      fileName = `${safeTitle}${defaultExt}`;
    }
    if (!fileName.includes('.')) {
      fileName += isPs1Console ? '.chd' : '.bin';
    }

    if (rawUrl.includes('archive.org') || rawUrl.includes('joeheyming.github.io') || rawUrl.startsWith('http')) {
      // Use proxy path containing fileName so getBaseFileName() extracts the true extension
      (window as any).EJS_gameUrl = `${origin}/api/proxy/${encodeURIComponent(fileName)}?url=${encodeURIComponent(rawUrl)}`;
    } else {
      (window as any).EJS_gameUrl = rawUrl;
    }
    (window as any).EJS_gameName = fileName;

    // If environment lacks SharedArrayBuffer / cross-origin isolation, avoid worker thread fetch failure
    if (!window.crossOriginIsolated) {
      (window as any).EJS_threads = false;
    }

    if (consoleSystem === 'genesis' || consoleSystem === 'megadrive' || consoleSystem === 'sega' || consoleSystem === 'sega genesis') {
      (window as any).EJS_core = 'segaMD';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'nes') {
      (window as any).EJS_core = 'fceumm';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'snes') {
      (window as any).EJS_core = 'snes9x';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'game boy' || consoleSystem === 'gb') {
      (window as any).EJS_core = 'gambatte';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'game boy color' || consoleSystem === 'gbc') {
      (window as any).EJS_core = 'gambatte';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'gba') {
      (window as any).EJS_core = 'mgba';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'master system' || consoleSystem === 'mastersystem') {
      (window as any).EJS_core = 'picodrive';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'game gear' || consoleSystem === 'gamegear') {
      (window as any).EJS_core = 'picodrive';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'turbografx-16' || consoleSystem === 'turbografx16') {
      (window as any).EJS_core = 'mednafen_pce_fast';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'atari 2600' || consoleSystem === 'atari2600') {
      (window as any).EJS_core = 'stella';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'sega cd' || consoleSystem === 'segacd') {
      (window as any).EJS_core = 'picodrive';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'sega 32x' || consoleSystem === 'sega32x') {
      (window as any).EJS_core = 'picodrive';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'virtual boy' || consoleSystem === 'virtualboy') {
      (window as any).EJS_core = 'mednafen_vb';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'nds' || consoleSystem === 'nintendo ds') {
      (window as any).EJS_core = 'desmume';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'n64' || consoleSystem === 'nintendo 64') {
      (window as any).EJS_core = 'n64';
      (window as any).EJS_biosUrl = null;
    } else if (isPs1Console) {
      (window as any).EJS_core = 'psx';
      (window as any).EJS_biosUrl = `${origin}/scph5501.bin`;
      (window as any).EJS_dontExtractBIOS = true; // Prevents decompression error on raw .bin PS1 BIOS
      (window as any).EJS_threads = false; // Disables WebWorker SharedArrayBuffer requirement
      (window as any).EJS_disableDatabases = true; // Prevents browser IndexedDB quota aborts on large CHD ROMs
    } else if (consoleSystem === 'ps2' || consoleSystem === 'playstation 2') {
      (window as any).EJS_core = 'play';
      (window as any).EJS_biosUrl = null;
    } else if (consoleSystem === 'psp' || consoleSystem === 'playstation portable') {
      (window as any).EJS_core = 'ppsspp';
      (window as any).EJS_biosUrl = null;
      (window as any).EJS_threads = false; // Ensures WASM compatibility
      (window as any).EJS_disableDatabases = true; // Prevents IndexedDB issues
      // EmulatorJS loads the official WASM PPSSPP core automatically when 'ppsspp' core is specified.
    } else {
      (window as any).EJS_core = activeGame.core || consoleSystem || 'gba';
      (window as any).EJS_biosUrl = null;
    }

    // Dynamically append the script loader only after old tracking vectors are cleared
    const activeScript = document.createElement('script');
    activeScript.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    activeScript.crossOrigin = 'anonymous';
    activeScript.async = true;
    document.body.appendChild(activeScript);

    return () => {
      const staleScripts = document.querySelectorAll('script[src*="emulatorjs"]');
      staleScripts.forEach(script => script.remove());
      if ((window as any).EJS_player) {
        (window as any).EJS_player = null;
        (window as any).EJS_core = null;
        (window as any).EJS_gameUrl = null;
        (window as any).EJS_biosUrl = null;
        (window as any).EJS_pathtodata = null;
        (window as any).EJS_startOnLoaded = null;
      }
    };
  }, [activeGame]);

  // Computed streaming catalog filtered by active main tab
  const streamingItems = useMemo(() => {
    if (mainTab === 'games' || mainTab === 'comics' || mainTab === 'nostalgia') return [];
    if (mainTab === 'movies') return STREAMING_CATALOG.filter(i => i.category === 'Movies');
    if (mainTab === 'tv') return STREAMING_CATALOG.filter(i => i.category === 'TV Shows');
    if (mainTab === 'anime') return STREAMING_CATALOG.filter(i => i.category === 'Anime');
    if (mainTab === 'cartoons') return STREAMING_CATALOG.filter(i => i.category === 'Cartoons');
    return STREAMING_CATALOG;
  }, [mainTab]);

  const filteredStreamingItems = useMemo(() => {
    if (!searchQuery.trim()) return streamingItems;
    const q = searchQuery.toLowerCase();
    return streamingItems.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.genre.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      (i.tags && i.tags.some(t => t.toLowerCase().includes(q)))
    );
  }, [streamingItems, searchQuery]);

  if (currentView === 'movie_player' && activeMovieTarget) {
    return (
      <MoviePlayerView
        target={activeMovieTarget}
        onClose={() => {
          setActiveMovieTarget(null);
          setCurrentView('catalog');
        }}
      />
    );
  }

  if (currentView === 'stream_player' && activeStreamItem) {
    return (
      <StreamPlayer
        item={activeStreamItem}
        onClose={() => {
          setActiveStreamItem(null);
          setCurrentView('catalog');
        }}
        onSelectOther={(other) => {
          setActiveStreamItem(other);
        }}
      />
    );
  }

  if (currentView === 'player' && activeGame) {
    return (
      <PlayerView
        selectedGame={activeGame}
        item={activeGame}
        onClose={handleClosePlayer}
        onRestart={handleRestartGame}
        favorites={favorites as any}
        toggleFavorite={toggleFavorite as any}
      />
    );
  }

  const isCinemaDiscoverTab =
    mainTab === 'movies' ||
    mainTab === 'tv' ||
    mainTab === 'anime' ||
    mainTab === 'cartoons' ||
    showNetflixMyList;

  const navTabs: Array<{
    key: 'games' | 'movies' | 'tv' | 'anime' | 'cartoons' | 'nostalgia' | 'comics';
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    { key: 'games', label: 'Retro Games', icon: <Gamepad2 size={15} />, badge: String(games.length) },
    {
      key: 'movies',
      label: 'Movies',
      icon: <Film size={15} />,
      badge: tmdbCounts ? tmdbCounts.movies.toLocaleString() : undefined,
    },
    {
      key: 'tv',
      label: 'TV Shows',
      icon: <Tv size={15} />,
      badge: tmdbCounts ? tmdbCounts.tv.toLocaleString() : undefined,
    },
    { key: 'anime', label: 'Anime', icon: <Flame size={15} /> },
    { key: 'cartoons', label: 'Cartoons', icon: <Smile size={15} /> },
    { key: 'nostalgia', label: 'Nostalgia TV', icon: <Radio size={15} /> },
    { key: 'comics', label: 'Comics', icon: <BookOpen size={15} /> },
  ];

  return (
    <div className={`app-shell ${isNetflix ? 'theme-netflix' : isPopcorn ? 'theme-popcorn' : isGamOnl ? 'theme-gamonl' : isKaleidescape ? 'theme-kaleidescape' : 'theme-obsidian'}`}>
      {isKaleidescape ? (
        <>
          <KaleidescapeWall
            mode={mainTab}
            onChangeMode={(next) => handleSelectMainTab(next)}
            games={games}
            gamesLoading={loading}
            consoleTabs={consoleTabs}
            selectedConsole={selectedConsole}
            onSelectConsole={setSelectedConsole}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectMedia={(target) => {
              setActiveMovieTarget(target);
              setCurrentView('movie_player');
            }}
            onLaunchGame={handleLaunchGame}
            onInspect3D={(game) => {
              setInspecting3DGame(game);
              enrichGameWithLaunchBoxApi(game, (updated) => {
                setInspecting3DGame(updated);
                setGames(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
              });
            }}
            onOpenSettings={() => setShowSettingsModal(true)}
            renderComicsFallback={() => (
              <ComicsComingSoon onExploreTab={(tab) => handleSelectMainTab(tab)} />
            )}
          />
          <GameBox3DModal
            game={inspecting3DGame}
            isOpen={Boolean(inspecting3DGame)}
            onClose={() => setInspecting3DGame(null)}
          />
          <SettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            onNavigateSection={(tab) => handleSelectMainTab(tab)}
          />
        </>
      ) : isGamOnl ? (
        <>
          <GamOnlView
            games={games}
            paginatedGames={paginatedGames}
            filteredCount={filteredGames.length}
            loading={loading}
            consoleTabs={consoleTabs}
            selectedConsole={selectedConsole}
            onSelectConsole={setSelectedConsole}
            selectedGenre={selectedGenre}
            onSelectGenre={setSelectedGenre}
            genres={genres}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onLaunchGame={handleLaunchGame}
            onInspect3D={(game) => {
              setInspecting3DGame(game);
              enrichGameWithLaunchBoxApi(game, (updated) => {
                setInspecting3DGame(updated);
                setGames(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
              });
            }}
            onOpenSettings={() => setShowSettingsModal(true)}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
          <GameBox3DModal
            game={inspecting3DGame}
            isOpen={Boolean(inspecting3DGame)}
            onClose={() => setInspecting3DGame(null)}
          />
          <SettingsModal
            isOpen={showSettingsModal}
            onClose={() => setShowSettingsModal(false)}
            onNavigateSection={(tab) => handleSelectMainTab(tab)}
          />
        </>
      ) : (
        <>
      {/* Topbar: Adaptive between Obsidian, Netflix & WebPlay Time (Popcorn Time) */}
      {isPopcorn ? (
        <header className="topbar-popcorn">
          <div className="relative max-w-[1440px] mx-auto px-3 sm:px-5 py-1.5 sm:py-0 sm:h-16 flex flex-wrap sm:flex-nowrap items-center justify-between gap-x-2 gap-y-1">
            {/* Mobile (<sm) Row 1 Left: WEBPLAY time Wordmark */}
            <button
              type="button"
              onClick={() => handleSelectMainTab('movies')}
              className="flex sm:hidden order-1 cursor-pointer shrink-0 py-0.5"
              aria-label="WebPlay Time Home"
            >
              <WebPlayTimeLogo size="sm" />
            </button>

            {/* Icon Category Strip (Row 1 Left on sm+, Row 2 full-width on mobile <sm) */}
            <nav
              aria-label="WebPlay Time sections"
              className="order-3 sm:order-1 w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 sm:gap-4 overflow-x-auto border-t border-white/10 sm:border-t-0 pt-1.5 pb-0.5 sm:py-1"
              style={{ scrollbarWidth: 'none' }}
            >
              {[
                { key: 'games' as const, label: 'Games', renderIcon: (a: boolean) => <Gamepad2 size={20} className={a ? 'popcorn-nav-glow' : 'text-neutral-300'} /> },
                { key: 'movies' as const, label: 'Movies', renderIcon: (a: boolean) => <PopcornClapperIcon active={a} /> },
                { key: 'tv' as const, label: 'TV shows', renderIcon: (a: boolean) => <PopcornRetroTvIcon active={a} /> },
                { key: 'anime' as const, label: 'Anime', renderIcon: (a: boolean) => <Flame size={20} className={a ? 'popcorn-nav-glow' : 'text-neutral-300'} /> },
                { key: 'cartoons' as const, label: 'Cartoons', renderIcon: (a: boolean) => <Smile size={20} className={a ? 'popcorn-nav-glow' : 'text-neutral-300'} /> },
                { key: 'nostalgia' as const, label: 'Nostalgia TV', renderIcon: (a: boolean) => <Radio size={20} className={a ? 'popcorn-nav-glow' : 'text-neutral-300'} /> },
                { key: 'comics' as const, label: 'Comics', renderIcon: (a: boolean) => <BookOpen size={20} className={a ? 'popcorn-nav-glow' : 'text-neutral-300'} /> },
              ].map((item) => {
                const isActive = !showNetflixMyList && mainTab === item.key;
                return (
                  <button
                    key={`pt-nav-${item.key}`}
                    type="button"
                    onClick={() => handleSelectMainTab(item.key)}
                    className={`flex flex-col items-center justify-center gap-0.5 px-1.5 py-0.5 sm:py-1 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive ? 'text-white' : 'text-neutral-400 hover:text-neutral-100'
                    }`}
                  >
                    {item.renderIcon(isActive)}
                    <span className={`text-[10px] leading-none ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Desktop Center Signature Wordmark: WEBPLAY time */}
            <div className="hidden xl:flex xl:absolute xl:left-1/2 xl:-translate-x-1/2 pointer-events-auto">
              <button
                type="button"
                onClick={() => handleSelectMainTab('movies')}
                className="cursor-pointer"
                aria-label="WebPlay Time Home"
              >
                <WebPlayTimeLogo size="md" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleSelectMainTab('movies')}
              className="hidden sm:flex xl:hidden sm:order-2 cursor-pointer shrink-0"
              aria-label="WebPlay Time Home"
            >
              <WebPlayTimeLogo size="sm" />
            </button>

            {/* Right Utility Controls: Search, Favorites Heart, 3-Theme Switcher */}
            <div className="order-2 sm:order-3 flex items-center gap-1 sm:gap-2.5 shrink-0">
              {mainTab !== 'comics' && (
                showPopcornSearch || searchQuery ? (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-[#0b0d14]/95 border border-[#3fa9f5]/70 rounded-[4px] w-24 sm:w-52">
                    <Search size={12} className="text-[#62bfff] shrink-0" />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full bg-transparent text-xs text-white outline-none placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setShowPopcornSearch(false);
                      }}
                      aria-label="Close search"
                      className="text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowPopcornSearch(true)}
                    aria-label="Search catalog"
                    title="Search"
                    className="p-1 text-neutral-300 hover:text-white cursor-pointer"
                  >
                    <Search size={15} />
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => {
                  if (mainTab === 'games') {
                    setSelectedConsole((prev) => (prev === 'Favorites' ? 'All' : 'Favorites'));
                  } else {
                    setShowNetflixMyList((v) => !v);
                  }
                }}
                aria-label="Favorites"
                title="Favorites"
                className={`p-1 cursor-pointer transition-colors ${
                  showNetflixMyList || (mainTab === 'games' && selectedConsole === 'Favorites')
                    ? 'text-[#3fa9f5]'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                <Heart
                  size={15}
                  className={
                    showNetflixMyList || (mainTab === 'games' && selectedConsole === 'Favorites')
                      ? 'fill-current'
                      : ''
                  }
                />
              </button>

              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                aria-label="Open settings"
                title="Settings & Themes"
                data-settings-trigger="true"
                className="p-1.5 text-neutral-300 hover:text-white cursor-pointer transition-colors"
              >
                <Settings size={16} />
              </button>
            </div>
          </div>
        </header>
      ) : isNetflix ? (
        <header className="topbar-sticky-netflix border-b border-[#222222]">
          <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
            {/* Zone 1 & 2: Netflix Brand Wordmark + Concise Single-Line Nav Links */}
            <div className="flex items-center gap-6 lg:gap-8 min-w-0">
              <button
                type="button"
                onClick={() => handleSelectMainTab('movies')}
                className="font-netflix-display text-2xl sm:text-3xl tracking-wider text-[#E50914] whitespace-nowrap shrink-0 cursor-pointer select-none"
              >
                STREAMFLIX
              </button>

              <nav
                aria-label="Primary sections"
                className="hidden lg:flex items-center gap-5 text-xs font-medium text-neutral-300"
              >
                {navTabs.map((t) => {
                  const isActive = !showNetflixMyList && mainTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleSelectMainTab(t.key)}
                      className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        isActive
                          ? 'text-white font-extrabold'
                          : 'text-neutral-300 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowNetflixMyList(true)}
                  className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    showNetflixMyList
                      ? 'text-white font-extrabold'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  My List{myList.length > 0 ? ` (${myList.length})` : ''}
                </button>
              </nav>
            </div>

            {/* Zone 3: Interactive Search, Theme Switcher & Netflix Profile Menu */}
            <div className="flex items-center gap-3 shrink-0">
              {mainTab !== 'comics' && (
                showNetflixSearch || searchQuery ? (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-black/90 border border-white/60 rounded-[4px] w-44 sm:w-60">
                    <Search size={14} className="text-white shrink-0" />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Titles, genres, IDs..."
                      className="w-full bg-transparent text-xs text-white outline-none placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setShowNetflixSearch(false);
                      }}
                      aria-label="Close search"
                      className="text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNetflixSearch(true)}
                    aria-label="Search catalog"
                    className="p-2 text-neutral-200 hover:text-white cursor-pointer"
                  >
                    <Search size={18} />
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                aria-label="Open settings"
                title="Settings & Themes"
                data-settings-trigger="true"
                className="p-2 text-neutral-200 hover:text-white cursor-pointer transition-colors"
              >
                <Settings size={18} />
              </button>

              {/* Netflix Profile Switcher */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileMenu((v) => !v)}
                  aria-label="Switch Netflix profile"
                  className="inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <NetflixProfileAvatar profile={netflixProfile} size={28} />
                  <ChevronDown size={14} className="text-neutral-300" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-44 rounded-md bg-[#181818] border border-[#333333] shadow-2xl py-1.5 z-50">
                    {(['Main', 'Kids', 'Anime'] as NetflixProfile[]).map((prof) => (
                      <button
                        key={prof}
                        type="button"
                        onClick={() => {
                          setNetflixProfile(prof);
                          setShowProfileMenu(false);
                          if (prof === 'Kids') handleSelectMainTab('cartoons');
                          else if (prof === 'Anime') handleSelectMainTab('anime');
                        }}
                        className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#262626] text-left text-xs text-white cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <NetflixProfileAvatar profile={prof} size={22} />
                          <span className="font-semibold">{prof}</span>
                        </span>
                        {netflixProfile === prof && <Check size={13} className="text-[#E50914]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Single-Row Scrollable Nav Fallback */}
          <div className="lg:hidden px-4 pb-2.5 flex items-center gap-3 overflow-x-auto text-xs" style={{ scrollbarWidth: 'none' }}>
            {navTabs.map((t) => {
              const isActive = !showNetflixMyList && mainTab === t.key;
              return (
                <button
                  key={`m-${t.key}`}
                  type="button"
                  onClick={() => handleSelectMainTab(t.key)}
                  className={`whitespace-nowrap shrink-0 px-2.5 py-1 rounded-[4px] cursor-pointer ${
                    isActive ? 'bg-[#E50914] text-white font-bold' : 'text-neutral-300'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowNetflixMyList(true)}
              className={`whitespace-nowrap shrink-0 px-2.5 py-1 rounded-[4px] cursor-pointer ${
                showNetflixMyList ? 'bg-[#E50914] text-white font-bold' : 'text-neutral-300'
              }`}
            >
              My List
            </button>
          </div>
        </header>
      ) : (
        <header className="topbar">
          <div className="brand-lockup">
            <span className="eyebrow">
              <span>STREAM X</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              aria-label="Open settings"
              title="Settings & Themes"
              data-settings-trigger="true"
              className="p-2 rounded-xl bg-[#141418] border border-[#27272e] text-neutral-300 hover:text-white hover:border-[#3e3e4a] cursor-pointer transition-colors"
            >
              <Settings size={16} />
            </button>
          </div>
        </header>
      )}

      {/* Main Container (Full-bleed wall starting at y=0 behind floating header on sm+) */}
      <main className={isPopcorn ? '!max-w-full !px-0 !mx-0' : ''}>
        {/* Obsidian Mode Navigation Pills (Cartoons placed immediately next to Anime) */}
        {!isNetflix && !isPopcorn && !isGamOnl && (
          <div className="streamx-modes pt-4">
            {navTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleSelectMainTab(t.key)}
                className={`mode-btn ${mainTab === t.key ? 'active' : ''}`}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.badge && (
                  <span style={{ opacity: 0.72, fontSize: '10px' }}>({t.badge})</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* HERO SECTION FOR RETRO GAMES (Hidden in Popcorn Time & GAM.ONL modes) */}
        {!isPopcorn && !isGamOnl && mainTab === 'games' && !showNetflixMyList && (
          <FeaturedHeroBanner
            games={games}
            onLaunchGame={handleLaunchGame}
            onInspect3D={(game) => {
              setInspecting3DGame(game);
              enrichGameWithLaunchBoxApi(game, (updated) => {
                setInspecting3DGame(updated);
                setGames(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
              });
            }}
          />
        )}

        {/* Global Console Tabs Filter (Only visible in Games mode, handled inside GamOnlView for GAM.ONL) */}
        {!isGamOnl && mainTab === 'games' && !showNetflixMyList && (
          <div className={isPopcorn ? 'sm:pt-16 px-4 py-2.5 bg-[#0a0c12]/95 border-b border-white/10' : ''}>
            <div className={`filter-tabs ${isPopcorn ? '!mb-0 !pb-0' : ''}`}>
              {consoleTabs.map(tab => {
                const count = tab === 'All' ? games.length : games.filter(g => g.consoleType === tab).length;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setSelectedConsole(tab)}
                    className={`filter-tab ${selectedConsole === tab ? 'active' : ''}`}
                  >
                    <span>{tab}</span>
                    <span style={{ opacity: 0.7, fontSize: '10px' }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Library Toolbar (Hidden in Popcorn Time wall, GAM.ONL Games hub, Nostalgia TV, Comics Coming Soon, or My List) */}
        {!isPopcorn && !(isGamOnl && mainTab === 'games') && mainTab !== 'comics' && mainTab !== 'nostalgia' && !showNetflixMyList && (
          <div className={`library-toolbar ${isNetflix ? 'pt-5' : ''}`}>
            <div className="toolbar-title">
              <span className="status-line"></span>
              <span className="font-bold">
                {mainTab === 'games'
                  ? 'Game Collection'
                  : mainTab === 'movies'
                  ? 'Movies & Cinema Catalog'
                  : mainTab === 'tv'
                  ? 'TV Shows & Series Catalog'
                  : mainTab === 'anime'
                  ? 'Anime Series & Films'
                  : 'Cartoons & Animation'}
              </span>
              <span className="result-count tabular-nums">
                {mainTab === 'games'
                  ? `(${filteredGames.length} titles in ${selectedConsole})`
                  : mainTab === 'movies'
                  ? tmdbCounts
                    ? `(${tmdbCounts.movies.toLocaleString()} movies · Live TMDB v3)`
                    : '(Live TMDB v3 Catalog)'
                  : mainTab === 'tv'
                  ? tmdbCounts
                    ? `(${tmdbCounts.tv.toLocaleString()} TV shows · Live TMDB v3)`
                    : '(Live TMDB v3 Catalog)'
                  : '(Live TMDB Animation Catalog)'}
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto">
              {mainTab === 'games' && (
                <select
                  aria-label="Filter games by genre"
                  value={selectedGenre}
                  onChange={e => setSelectedGenre(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-[#27272e] bg-[#141418] text-xs font-semibold text-neutral-200 outline-none cursor-pointer"
                >
                  {genres.map(g => (
                    <option key={g} value={g}>
                      Genre: {g}
                    </option>
                  ))}
                </select>
              )}

              {/* Search Box */}
              <div className="search-box flex-1 sm:flex-initial">
                <Search size={14} className="shrink-0" />
                <input
                  type="text"
                  placeholder={
                    mainTab === 'games'
                      ? 'Search games or console...'
                      : mainTab === 'movies'
                      ? 'Search movies or TMDB ID...'
                      : mainTab === 'tv'
                      ? 'Search shows or TMDB ID...'
                      : mainTab === 'anime'
                      ? 'Search anime...'
                      : 'Search cartoons...'
                  }
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} title="Clear search">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CONTENT RENDER: NOSTALGIA TV, COMICS COMING SOON, CINEMA DISCOVERY (MOVIES/TV/ANIME/CARTOONS/MY LIST), OR RETRO GAMES */}
        {mainTab === 'nostalgia' && !showNetflixMyList ? (
          <div className={isPopcorn ? 'sm:pt-16 pb-12' : 'pt-2 pb-12'}>
            <NostalgiaTvView externalSearch={searchQuery} />
          </div>
        ) : mainTab === 'comics' && !showNetflixMyList ? (
          <div className={isPopcorn ? 'max-w-[1200px] mx-auto px-4 sm:px-6 sm:pt-24 pt-6 pb-16' : 'pt-4 pb-16'}>
            <ComicsComingSoon onExploreTab={(tab) => handleSelectMainTab(tab)} />
          </div>
        ) : isCinemaDiscoverTab ? (
          <MoviesSection
            key={showNetflixMyList ? 'mylist' : mainTab}
            mode={
              mainTab === 'tv'
                ? 'tv'
                : mainTab === 'anime'
                ? 'anime'
                : mainTab === 'cartoons'
                ? 'cartoons'
                : 'movies'
            }
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            showMyListOnly={showNetflixMyList}
            onCloseMyList={() => setShowNetflixMyList(false)}
            savedState={
              mainTab === 'movies' || mainTab === 'tv'
                ? moviesCatalogMemoryRef.current[mainTab] || null
                : null
            }
            onStateChange={(state) => {
              if (mainTab === 'movies' || mainTab === 'tv') {
                moviesCatalogMemoryRef.current[mainTab] = state;
              }
            }}
            onSelectMedia={(target) => {
              setActiveMovieTarget(target);
              setCurrentView('movie_player');
            }}
          />
        ) : isGamOnl ? (
          <GamOnlView
            games={games}
            paginatedGames={paginatedGames}
            filteredCount={filteredGames.length}
            loading={loading}
            consoleTabs={consoleTabs}
            selectedConsole={selectedConsole}
            onSelectConsole={setSelectedConsole}
            selectedGenre={selectedGenre}
            onSelectGenre={setSelectedGenre}
            genres={genres}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onLaunchGame={handleLaunchGame}
            onInspect3D={(game) => {
              setInspecting3DGame(game);
              enrichGameWithLaunchBoxApi(game, (updated) => {
                setInspecting3DGame(updated);
                setGames(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
              });
            }}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        ) : (
          /* Retro Games Grid: Stuck-together edge-to-edge wall in Popcorn Time mode, or cards in Obsidian/Netflix */
          loading ? (
            <div className="empty-state">
              <div className="loader"></div>
              <p>Loading retro games catalog...</p>
            </div>
          ) : filteredGames.length === 0 ? (
            <div className="empty-state">
              <Gamepad2 size={36} className="text-neutral-400" />
              <h3>No games found</h3>
              <p>Try switching console categories or clearing your search term.</p>
            </div>
          ) : isPopcorn ? (
            <div
              className={`grid gap-0 w-full ${
                settings.posterDensity === 'compact'
                  ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-9 lg:grid-cols-11'
                  : settings.posterDensity === 'large'
                  ? 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7'
                  : 'grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9'
              }`}
            >
              {paginatedGames.map((game, index) => {
                const isFav = favorites.includes(game.id || game.slug);
                const starCount = Math.round(Math.min(5, Math.max(1, (Number(game.rating || 8.6)) / 2)));
                return (
                  <article
                    key={`pt-game-${game.slug}-${index}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPopcornGameDetail(game)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setPopcornGameDetail(game);
                      }
                    }}
                    className="group relative aspect-[2/3] w-full overflow-hidden bg-[#10131c] cursor-pointer select-none"
                  >
                    <SafeGameImage
                      primaryUrl={game.poster || game.posterUrl || game.coverUrl}
                      fallbackUrl={game.consoleType === 'PS1' ? game.boxFront : (game.boxFront || game.boxFrontUrl)}
                      title={game.title}
                      consoleType={game.consoleType}
                      alt={game.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <ConsoleBoxOverlay
                      consoleType={game.consoleType}
                      mode={settings.posterLabelMode}
                      compact={settings.posterDensity === 'compact'}
                    />
                    <div className="absolute inset-0 z-[6] bg-[#0b0e17]/84 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-between p-3 text-center">
                      <div className="w-full space-y-2 pt-2">
                        <h3 className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wide text-white line-clamp-2 leading-snug">
                          {game.title}
                        </h3>
                        {settings.showCardMetadata && (
                          <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-neutral-300">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(game.id || game.slug);
                              }}
                              aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                              className={isFav ? 'text-[#3fa9f5]' : 'text-neutral-200 hover:text-white'}
                            >
                              <Heart size={13} className={isFav ? 'fill-current' : ''} />
                            </button>
                            <span>{game.consoleType} · {game.year}</span>
                          </div>
                        )}
                      </div>
                      {settings.showCardMetadata && (
                        <div className="flex items-center justify-center gap-1 pb-2">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              size={12}
                              className={
                                n <= starCount
                                  ? 'text-[#3fa9f5] fill-[#3fa9f5] drop-shadow-[0_0_6px_rgba(63,169,245,0.8)]'
                                  : 'text-neutral-500'
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div
              className="game-grid"
              style={
                settings.posterDensity === 'compact'
                  ? { gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '16px' }
                  : settings.posterDensity === 'large'
                  ? { gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '24px' }
                  : undefined
              }
            >
              {paginatedGames.map((game, index) => {
                const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index;
                return (
                  <div key={`${game.slug}-${index}`} className="game-card">
                    {/* Poster Art */}
                    <div
                      className="card-art cursor-pointer"
                      onClick={() => handleLaunchGame(game)}
                    >
                      <SafeGameImage
                        primaryUrl={game.poster || game.posterUrl || game.coverUrl}
                        fallbackUrl={game.consoleType === 'PS1' ? game.boxFront : (game.boxFront || game.boxFrontUrl)}
                        title={game.title}
                        consoleType={game.consoleType}
                        alt={game.title}
                        className="card-art-img"
                      />
                      <ConsoleBoxOverlay
                        consoleType={game.consoleType}
                        mode={settings.posterLabelMode}
                      />
                      {settings.showCardMetadata && (
                        <>
                          <span
                            className="genre-badge"
                            style={
                              settings.posterLabelMode === 'overlay'
                                ? { top: 'auto', bottom: '10px', right: '10px', left: 'auto', zIndex: 5 }
                                : undefined
                            }
                          >
                            {game.genre}
                          </span>
                          <span className="card-number">
                            {String(globalIndex + 1).padStart(2, '0')}
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(game.id || game.slug);
                        }}
                        className={`absolute top-2 right-2 z-10 p-2 rounded-lg backdrop-blur-md transition-all cursor-pointer shadow-lg ${
                          favorites.includes(game.id || game.slug)
                            ? 'bg-amber-500 text-black'
                            : 'bg-black/65 text-white hover:bg-black/85'
                        }`}
                        title={favorites.includes(game.id || game.slug) ? 'Remove from Favorites' : 'Add to Favorites'}
                        aria-label={favorites.includes(game.id || game.slug) ? 'Remove from Favorites' : 'Add to Favorites'}
                      >
                        <Star size={15} fill={favorites.includes(game.id || game.slug) ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    {/* Clean Unboxed Metadata Line (No pill sandwiches) */}
                    {settings.showCardMetadata && (
                      <div className="card-meta-line">
                        <span className="text-neutral-200 font-bold">{game.consoleType}</span>
                        <span aria-hidden="true">·</span>
                        <span>{game.year}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 text-white">
                          <Star size={11} className="text-[#22c55e] fill-[#22c55e]" />
                          {Number(game.rating || 9.0).toFixed(1)}
                        </span>
                      </div>
                    )}

                    {/* Card Body */}
                    <div className="card-body">
                      <div className="card-info">
                        <h3 title={game.title}>{game.title}</h3>
                        <p title={game.synopsis}>{game.synopsis}</p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          className="play-btn-card flex-1"
                          onClick={() => handleLaunchGame(game)}
                        >
                          <Play size={13} fill="currentColor" />
                          <span>Play</span>
                        </button>
                        <button
                          type="button"
                          className="secondary-btn-card"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspecting3DGame(game);
                            enrichGameWithLaunchBoxApi(game, (updated) => {
                              setInspecting3DGame(updated);
                              setGames(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
                            });
                          }}
                          title="Inspect 3D Box Engine"
                        >
                          <Box size={13} />
                          <span>3D Box</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Pagination (50 items per view page, handled internally in GamOnlView) */}
        {!isGamOnl && mainTab === 'games' && filteredGames.length > ITEMS_PER_PAGE && (
          <div className="pagination">
            <button
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
                window.scrollTo({ top: 380, behavior: 'smooth' });
              }}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <span>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (50 games/page)
            </span>
            <button
              onClick={() => {
                setCurrentPage(p => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 380, behavior: 'smooth' });
              }}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        )}
      </main>

      {/* Web Ports Coming Soon Modal */}
      {showWebPortComingSoon && (
        <div className="player-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{
            background: '#141622',
            border: '1px solid #3b82f6',
            borderRadius: '16px',
            padding: '36px 40px',
            maxWidth: '480px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)',
            position: 'relative'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              marginBottom: '16px'
            }}>
              <Sparkles size={28} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>Web Ports Coming Soon! ⚡</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px' }}>
              Heavy WebAssembly streaming engines (like GTA V and 3D Web Ports) are under active development. This requires high-performance multithreaded optimization!
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowWebPortComingSoon(false)}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Got It
              </button>
              <button
                onClick={() => {
                  setShowWebPortComingSoon(false);
                  handleLaunchGame({
                    id: 'webport-gtav',
                    title: 'Grand Theft Auto V',
                    slug: 'webport-gtav',
                    consoleType: 'WebPort',
                    engine: 'web',
                    genre: 'Action / Open World',
                    year: 2024,
                    rating: 9.9,
                    url: 'https://fiveplay.lol/',
                    streamUrl: 'https://fiveplay.lol/',
                    poster: GTA_V_POSTER_URL,
                    synopsis: 'High-performance browser web port of GTA V running directly on the web.',
                    publisher: 'Rockstar Games',
                    releaseDate: '2013'
                  });
                }}
                style={{
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Play size={14} fill="currentColor" />
                <span>Launch GTA V</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popcorn Time Retro Game Detail View */}
      {isPopcorn && popcornGameDetail && (
        <div
          className="fixed inset-0 z-50 bg-[#0b0d13] text-white overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={popcornGameDetail.title}
        >
          <div
            className="fixed inset-0 pointer-events-none opacity-25"
            style={{
              background: 'radial-gradient(circle at 25% 30%, rgba(63,169,245,0.22) 0%, rgba(8,10,15,0.96) 70%)',
            }}
          />
          <button
            type="button"
            onClick={() => setPopcornGameDetail(null)}
            aria-label="Back to catalog"
            className="fixed top-4 right-5 z-50 w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white grid place-items-center backdrop-blur-md border border-white/15 cursor-pointer shadow-lg"
          >
            <X size={18} strokeWidth={2.5} />
          </button>

          <div className="relative z-10 min-h-screen max-w-[1200px] mx-auto px-5 sm:px-10 py-16 flex items-center">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-full max-w-[330px] aspect-[2/3] overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.85)] border border-white/10 bg-[#10141f]">
                  <SafeGameImage
                    primaryUrl={popcornGameDetail.poster || popcornGameDetail.posterUrl || popcornGameDetail.coverUrl}
                    fallbackUrl={popcornGameDetail.consoleType === 'PS1' ? popcornGameDetail.boxFront : (popcornGameDetail.boxFront || popcornGameDetail.boxFrontUrl)}
                    title={popcornGameDetail.title}
                    consoleType={popcornGameDetail.consoleType}
                    alt={popcornGameDetail.title}
                    className="w-full h-full object-cover"
                  />
                  <ConsoleBoxOverlay
                    consoleType={popcornGameDetail.consoleType}
                    mode={settings.posterLabelMode}
                  />
                </div>
              </div>

              <div className="lg:col-span-7 space-y-5">
                <h1 className="font-popcorn-brand text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-tight">
                  {popcornGameDetail.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-neutral-200 tabular-nums">
                  <span>{popcornGameDetail.genre || 'Arcade'}</span>
                  <span className="inline-flex items-center gap-1.5 text-neutral-300">
                    <Gamepad2 size={14} className="text-[#3fa9f5]" />
                    <span>{popcornGameDetail.consoleType}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-neutral-300">
                    <Calendar size={14} className="text-[#3fa9f5]" />
                    <span>{popcornGameDetail.year}</span>
                  </span>
                  <div className="inline-flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={14}
                        className={
                          n <= Math.round(Math.min(5, Math.max(1, Number(popcornGameDetail.rating || 8.8) / 2)))
                            ? 'text-[#3fa9f5] fill-[#3fa9f5]'
                            : 'text-neutral-500'
                        }
                      />
                    ))}
                    <span className="ml-1.5">( {Number(popcornGameDetail.rating || 9.0).toFixed(1)} )</span>
                  </div>
                </div>

                <p className="text-sm sm:text-[15px] text-neutral-200/95 leading-relaxed max-w-2xl">
                  {popcornGameDetail.synopsis || 'Play directly in your browser using WebAssembly retro emulation.'}
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      const target = popcornGameDetail;
                      setPopcornGameDetail(null);
                      handleLaunchGame(target);
                    }}
                    className="popcorn-watch-btn inline-flex items-center gap-3.5 px-6 py-3 rounded-[4px] cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-full bg-[#3fa9f5] text-white grid place-items-center shadow-[0_0_16px_rgba(63,169,245,0.9)]">
                      <Play size={15} fill="currentColor" className="ml-0.5" />
                    </span>
                    <span className="font-popcorn-brand text-sm sm:text-base font-extrabold uppercase tracking-wider text-white">
                      PLAY IT NOW
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInspecting3DGame(popcornGameDetail);
                      enrichGameWithLaunchBoxApi(popcornGameDetail, (updated) => {
                        setInspecting3DGame(updated);
                        setGames(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g));
                      });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-[4px] bg-black/50 hover:bg-white/10 border border-white/25 text-xs font-bold text-white cursor-pointer"
                  >
                    <Box size={15} className="text-[#3fa9f5]" />
                    <span>3D Box View</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive 3D Box Engine Modal */}
      <GameBox3DModal
        game={inspecting3DGame}
        isOpen={Boolean(inspecting3DGame)}
        onClose={() => setInspecting3DGame(null)}
      />

      {/* Global Studio Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onNavigateSection={(tab) => handleSelectMainTab(tab)}
      />
        </>
      )}
    </div>
  );
}
