import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  ChevronLeft,
  Save,
  Search,
  X,
  Star,
  Box,
  Play,
  SlidersHorizontal,
} from 'lucide-react';
import type { GameItem } from '../types';
import { useTheme } from '../context/ThemeContext';
import { SafeGameImage } from './SafeGameImage';
import {
  resolveSteamGridHeroAndLogo,
  resolveSteamGridWheelIcon,
  type SteamGridMediaBundle,
  type SteamGridWheelIconData,
} from '../steamgridApi';
import {
  resolveRawgGameMedia,
  type RawgGameMediaBundle,
} from '../rawgApi';

interface GamOnlViewProps {
  games: GameItem[];
  paginatedGames: GameItem[];
  filteredCount: number;
  loading: boolean;
  consoleTabs: string[];
  selectedConsole: string;
  onSelectConsole: (consoleName: string) => void;
  selectedGenre: string;
  onSelectGenre: (genre: string) => void;
  genres: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  onLaunchGame: (game: GameItem) => void;
  onInspect3D: (game: GameItem) => void;
  onOpenSettings?: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface WheelSystemEntry {
  id: string;
  consoleKey: string;
  label: string;
  slugPath: string;
  count: number;
}

const ORDERED_SYSTEM_KEYS = [
  'TurboGrafx-16',
  'Sega Saturn',
  'Atari 7800',
  'PS1',
  'ARCADE',
  'Sega Genesis',
  'NES',
  'SNES',
  'N64',
  'GBA',
  'Game Boy',
  'Game Boy Color',
  'Nintendo DS',
  'PSP',
  'Master System',
  'Game Gear',
  'Sega CD',
  'Sega 32X',
  'Atari 2600',
  'Virtual Boy',
  'MS-DOS',
  'WebPort',
  'Flash',
  'Favorites',
];

function isArcadeHighlightGame(g: GameItem): boolean {
  const c = (g.consoleType || '').toLowerCase();
  return (
    Boolean(g.embed_url) ||
    g.engine === 'iframe' ||
    g.engine === 'web' ||
    c === 'webport' ||
    c === 'flash' ||
    (g.url || '').includes('retrogames.cc')
  );
}

/**
 * Crisp custom vector emblems matching the authentic gam.onl hardware wheel.
 */
const SystemWheelLogo: React.FC<{ systemKey: string; isCenter: boolean }> = ({
  systemKey,
  isCenter,
}) => {
  switch (systemKey) {
    case 'ARCADE':
      return (
        <div className="flex items-center gap-3 select-none">
          <svg
            width={isCenter ? 54 : 44}
            height={isCenter ? 56 : 46}
            viewBox="0 0 64 68"
            fill="none"
            className="shrink-0 drop-shadow-[0_0_12px_rgba(249,115,22,0.55)]"
            aria-hidden="true"
          >
            <path
              d="M16 6 L50 10 L46 24 L52 38 L52 62 L14 62 L14 38 L20 24 Z"
              stroke="#ef4444"
              strokeWidth="2.8"
              fill="#1c0604"
            />
            <polygon points="18,9 48,12 45,19 20,17" fill="#f97316" />
            <polygon points="22,22 44,23 43,35 20,35" stroke="#fb923c" strokeWidth="1.8" fill="#090404" />
            <line x1="15" y1="39" x2="50" y2="39" stroke="#ef4444" strokeWidth="2.5" />
            <circle cx="24" cy="36" r="2.2" fill="#facc15" />
            <line x1="24" y1="36" x2="24" y2="41" stroke="#f8fafc" strokeWidth="1.8" />
            <circle cx="32" cy="40" r="1.4" fill="#facc15" />
            <circle cx="37" cy="40" r="1.4" fill="#38bdf8" />
            <rect x="27" y="47" width="10" height="10" rx="1" stroke="#ef4444" strokeWidth="1.6" />
          </svg>
          <span
            className="font-mono font-black tracking-[0.08em] uppercase leading-none"
            style={{
              fontSize: isCenter ? '42px' : '30px',
              color: '#fb923c',
              textShadow:
                '0 3px 0 #b91c1c, 0 -1px 0 #fde047, 0 0 18px rgba(249,115,22,0.55)',
            }}
          >
            ARCADE
          </span>
        </div>
      );

    case 'PS1':
      return (
        <div className="flex items-center justify-end select-none">
          <img
            src="/assets/aistudio/psx__1__3f897b1d.png"
            alt="PlayStation"
            draggable={false}
            className={`${
              isCenter ? 'h-11 sm:h-12' : 'h-8 sm:h-9'
            } w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]`}
          />
        </div>
      );

    case 'TurboGrafx-16':
      return (
        <div className="flex items-center gap-1.5 select-none">
          <span
            className="text-[24px] font-black tracking-tight uppercase"
            style={{
              background: 'linear-gradient(180deg, #fde047 0%, #f59e0b 65%, #b45309 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))',
            }}
          >
            TURBOGRAFX
          </span>
          <span className="w-7 h-7 rounded-full bg-gradient-to-b from-amber-400 to-orange-600 text-black font-black text-xs grid place-items-center shadow">
            16
          </span>
        </div>
      );

    case 'Sega Saturn':
      return (
        <div className="flex items-center gap-2.5 select-none">
          <svg width="46" height="34" viewBox="0 0 64 46" aria-hidden="true" className="shrink-0">
            <circle cx="32" cy="23" r="14" fill="url(#saturnPlanet)" />
            <ellipse
              cx="32"
              cy="24"
              rx="26"
              ry="7"
              transform="rotate(-16 32 24)"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="4"
            />
            <defs>
              <linearGradient id="saturnPlanet" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#1e40af" />
              </linearGradient>
            </defs>
          </svg>
          <div className="leading-[0.92] text-left">
            <div className="text-[14px] font-black tracking-[0.22em] text-slate-200">SEGA</div>
            <div className="text-[19px] font-extrabold tracking-[0.08em] text-slate-100">SATURN</div>
          </div>
        </div>
      );

    case 'Sega Genesis':
      return (
        <div className="flex flex-col items-center leading-none select-none px-3 py-1">
          <span className="text-[10px] font-black tracking-[0.35em] text-slate-300">SEGA</span>
          <span
            className="text-[25px] font-black italic tracking-wider"
            style={{
              background: 'linear-gradient(180deg, #f8fafc 0%, #94a3b8 55%, #e2e8f0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.95))',
            }}
          >
            GENESIS
          </span>
        </div>
      );

    case 'NES':
      return (
        <div className="px-4 py-1.5 rounded-full border-[2.5px] border-[#e11d48] bg-white/95 shadow-[0_4px_16px_rgba(0,0,0,0.85)] select-none leading-none text-center">
          <div className="text-[17px] font-black tracking-tight text-[#dc2626]">Nintendo</div>
          <div className="text-[7px] font-extrabold tracking-[0.16em] text-[#dc2626] uppercase">
            ENTERTAINMENT SYSTEM
          </div>
        </div>
      );

    case 'SNES':
      return (
        <div className="flex items-center gap-2.5 select-none">
          <svg width="34" height="28" viewBox="0 0 40 32" aria-hidden="true" className="shrink-0">
            <circle cx="14" cy="10" r="5" fill="#22c55e" />
            <circle cx="24" cy="10" r="5" fill="#3b82f6" />
            <circle cx="12" cy="20" r="5" fill="#eab308" />
            <circle cx="22" cy="20" r="5" fill="#ef4444" />
          </svg>
          <div className="leading-[0.95] italic">
            <div className="text-[18px] font-black tracking-tight text-[#ef4444] uppercase">
              SUPER NINTENDO
            </div>
            <div className="text-[7.5px] font-bold tracking-[0.14em] text-[#e11d48] uppercase">
              ENTERTAINMENT SYSTEM
            </div>
          </div>
        </div>
      );

    case 'N64':
      return (
        <div className="flex items-center gap-2.5 select-none">
          <svg width="36" height="36" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
            <polygon points="8,10 16,6 16,38 8,42" fill="#22c55e" />
            <polygon points="16,6 32,34 32,42 16,14" fill="#ef4444" />
            <polygon points="32,10 40,6 40,38 32,42" fill="#2563eb" />
            <polygon points="8,10 16,6 24,10 16,14" fill="#facc15" />
            <polygon points="32,10 40,6 32,2 24,6" fill="#facc15" />
          </svg>
          <div className="flex items-baseline gap-1 font-black tracking-tight leading-none">
            <span className="text-[20px] text-[#3b82f6]">NINTENDO</span>
            <span className="text-[21px] text-[#ef4444]">64</span>
          </div>
        </div>
      );

    case 'GBA':
      return (
        <div className="leading-none select-none text-left">
          <div className="text-[15px] font-black italic tracking-tight text-indigo-300">GAME BOY</div>
          <div className="text-[17px] font-black tracking-[0.12em] text-white uppercase">ADVANCE</div>
        </div>
      );

    case 'Game Boy Color':
      return (
        <div className="flex items-baseline gap-1.5 select-none">
          <span className="text-[18px] font-black italic text-slate-100">GAME BOY</span>
          <span className="text-[18px] font-black">
            <span className="text-rose-500">C</span>
            <span className="text-violet-400">O</span>
            <span className="text-emerald-400">L</span>
            <span className="text-amber-400">O</span>
            <span className="text-sky-400">R</span>
          </span>
        </div>
      );

    case 'Game Boy':
      return (
        <div className="leading-none select-none">
          <span className="text-[21px] font-black italic tracking-tight text-slate-200">
            GAME BOY
          </span>
        </div>
      );

    case 'PSP':
      return (
        <div className="text-[26px] font-black tracking-[0.28em] text-slate-100 select-none">
          PSP
        </div>
      );

    case 'Favorites':
      return (
        <div className="flex items-center gap-2 select-none">
          <Star size={24} className="text-amber-400 fill-amber-400" />
          <span className="text-[22px] font-black tracking-wider text-amber-300 uppercase">
            FAVORITES
          </span>
        </div>
      );

    default:
      return (
        <div className="text-[21px] font-black tracking-wider uppercase text-slate-100 select-none">
          {systemKey}
        </div>
      );
  }
};

export const GamOnlView: React.FC<GamOnlViewProps> = ({
  games,
  loading,
  favorites,
  onToggleFavorite,
  onLaunchGame,
  onInspect3D,
  onOpenSettings,
}) => {
  const { settings } = useTheme();

  // Wheel hierarchy: 'systems' (Level 1 Hardware Wheel) | 'games' (Level 2 Games Wheel)
  const [wheelMode, setWheelMode] = useState<'systems' | 'games'>('systems');
  const [systemIndex, setSystemIndex] = useState<number>(0);
  const [gameIndex, setGameIndex] = useState<number>(0);
  const [activeSystemKey, setActiveSystemKey] = useState<string>('ARCADE');
  const [favoritesOnlyMode, setFavoritesOnlyMode] = useState(false);

  // Search overlay modal
  const [searchOpen, setSearchOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Active cabinet CRT preview media (SteamGridDB + RAWG gameplay)
  const [heroBundle, setHeroBundle] = useState<SteamGridMediaBundle | null>(null);
  const [rawgMedia, setRawgMedia] = useState<RawgGameMediaBundle | null>(null);
  const [shotIdx, setShotIdx] = useState(0);

  // Wheel SteamGridDB /icons + /logos cache keyed by game.id
  const [wheelIconMap, setWheelIconMap] = useState<
    Record<string, SteamGridWheelIconData | null>
  >({});

  // Build ordered list of hardware systems present in the catalog (+ ARCADE + Favorites)
  const systemList = useMemo<WheelSystemEntry[]>(() => {
    const counts = new Map<string, number>();
    let arcadeCount = 0;
    for (const g of games) {
      if (g.consoleType) {
        counts.set(g.consoleType, (counts.get(g.consoleType) || 0) + 1);
      }
      if (isArcadeHighlightGame(g)) arcadeCount++;
    }
    const entries: WheelSystemEntry[] = [];
    for (const key of ORDERED_SYSTEM_KEYS) {
      if (key === 'ARCADE') {
        entries.push({
          id: 'arcade',
          consoleKey: 'ARCADE',
          label: 'ARCADE',
          slugPath: 'arcade',
          count: arcadeCount > 0 ? arcadeCount : games.length,
        });
      } else if (key === 'Favorites') {
        entries.push({
          id: 'favorites',
          consoleKey: 'Favorites',
          label: 'Favorites',
          slugPath: 'favorites',
          count: favorites.length,
        });
      } else if ((counts.get(key) || 0) > 0) {
        entries.push({
          id: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          consoleKey: key,
          label: key,
          slugPath: key.toLowerCase().replace(/[^a-z0-9]+/g, ''),
          count: counts.get(key) || 0,
        });
      }
    }
    // Any extra consoles not in ordered list
    counts.forEach((count, key) => {
      if (!ORDERED_SYSTEM_KEYS.includes(key)) {
        entries.push({
          id: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          consoleKey: key,
          label: key,
          slugPath: key.toLowerCase().replace(/[^a-z0-9]+/g, ''),
          count,
        });
      }
    });
    return entries;
  }, [games, favorites.length]);

  // Default focus on ARCADE when systems load so screenshot layout matches immediately
  const didInitCenterRef = useRef(false);
  useEffect(() => {
    if (didInitCenterRef.current || systemList.length === 0) return;
    const idx = systemList.findIndex((s) => s.consoleKey === 'ARCADE');
    if (idx >= 0) {
      setSystemIndex(idx);
      setActiveSystemKey('ARCADE');
      didInitCenterRef.current = true;
    }
  }, [systemList]);

  const focusedSystem =
    systemList[((systemIndex % Math.max(1, systemList.length)) + systemList.length) % Math.max(1, systemList.length)] ||
    null;

  // Games filtered for active system / Favorites / Search
  const filteredGamesList = useMemo<GameItem[]>(() => {
    const q = localSearch.trim().toLowerCase();
    let pool = games;

    if (q) {
      pool = games.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.consoleType.toLowerCase().includes(q) ||
          (g.genre || '').toLowerCase().includes(q)
      );
      return pool;
    }

    if (favoritesOnlyMode || activeSystemKey === 'Favorites') {
      return games.filter(
        (g) =>
          favorites.includes(g.id) ||
          favorites.includes(g.slug) ||
          favorites.includes(g.title)
      );
    }

    if (activeSystemKey === 'ARCADE') {
      const highlights = games.filter(isArcadeHighlightGame);
      return highlights.length > 0 ? highlights : games;
    }

    return games.filter((g) => g.consoleType === activeSystemKey);
  }, [games, localSearch, favoritesOnlyMode, activeSystemKey, favorites]);

  // Clamp gameIndex when list changes
  useEffect(() => {
    if (filteredGamesList.length === 0) {
      setGameIndex(0);
    } else if (gameIndex >= filteredGamesList.length) {
      setGameIndex(0);
    }
  }, [filteredGamesList.length, gameIndex]);

  // Choose which game is currently previewed on the left Arcade CRT Monitor
  const previewGame = useMemo<GameItem | null>(() => {
    if (wheelMode === 'games' && filteredGamesList.length > 0) {
      const safeIdx =
        ((gameIndex % filteredGamesList.length) + filteredGamesList.length) %
        filteredGamesList.length;
      return filteredGamesList[safeIdx] || null;
    }

    // In Systems Wheel mode, preview a signature hit from whichever system is centered!
    const targetSys = focusedSystem?.consoleKey || 'ARCADE';
    if (targetSys === 'Favorites') {
      const favHit = games.find(
        (g) =>
          favorites.includes(g.id) ||
          favorites.includes(g.slug) ||
          favorites.includes(g.title)
      );
      return favHit || games[0] || null;
    }
    if (targetSys === 'ARCADE') {
      const sfHit =
        games.find((g) => /street fighter/i.test(g.title)) ||
        games.find(isArcadeHighlightGame) ||
        games[0];
      return sfHit || null;
    }
    const sysGames = games.filter((g) => g.consoleType === targetSys);
    return sysGames[0] || games[0] || null;
  }, [wheelMode, filteredGamesList, gameIndex, focusedSystem, games, favorites]);

  // Fetch SteamGridDB Hero + Logo + Icon for active CRT preview game
  useEffect(() => {
    if (!previewGame) {
      setHeroBundle(null);
      return;
    }
    let cancelled = false;
    resolveSteamGridHeroAndLogo(previewGame.title, previewGame.consoleType)
      .then((bundle) => {
        if (!cancelled) setHeroBundle(bundle);
      })
      .catch(() => {
        if (!cancelled) setHeroBundle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [previewGame?.id, previewGame?.title, previewGame?.consoleType]);

  // Fetch RAWG gameplay video clip & screenshots for active CRT preview game
  useEffect(() => {
    if (!previewGame) {
      setRawgMedia(null);
      return;
    }
    let cancelled = false;
    setShotIdx(0);
    resolveRawgGameMedia(previewGame.title, previewGame.consoleType)
      .then((bundle) => {
        if (!cancelled) setRawgMedia(bundle);
      })
      .catch(() => {
        if (!cancelled) setRawgMedia(null);
      });
    return () => {
      cancelled = true;
    };
  }, [previewGame?.id, previewGame?.title, previewGame?.consoleType]);

  // Auto-cycle RAWG screenshots inside the CRT monitor if no video clip exists
  useEffect(() => {
    const count = rawgMedia?.screenshots?.length || 0;
    if (count <= 1 || rawgMedia?.videoUrl || previewGame?.gameplayVideoUrl) return;
    const id = window.setInterval(() => {
      setShotIdx((prev) => (prev + 1) % count);
    }, 3600);
    return () => window.clearInterval(id);
  }, [rawgMedia, previewGame?.gameplayVideoUrl]);

  // Prefetch SteamGridDB /icons & /logos for visible +/-4 window items in Games Wheel
  useEffect(() => {
    if (wheelMode !== 'games' || filteredGamesList.length === 0) return;
    let cancelled = false;

    const len = filteredGamesList.length;
    const offsets = len >= 9 ? [-4, -3, -2, -1, 0, 1, 2, 3, 4] : Array.from({ length: len }, (_, i) => i - gameIndex);

    offsets.forEach((off) => {
      const idx = len >= 9 ? (((gameIndex + off) % len) + len) % len : gameIndex + off;
      if (idx < 0 || idx >= len) return;
      const g = filteredGamesList[idx];
      if (!g || g.id in wheelIconMap) return;

      resolveSteamGridWheelIcon(g.title, g.consoleType)
        .then((res) => {
          if (!cancelled) {
            setWheelIconMap((prev) => (g.id in prev ? prev : { ...prev, [g.id]: res }));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setWheelIconMap((prev) => (g.id in prev ? prev : { ...prev, [g.id]: null }));
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [wheelMode, filteredGamesList, gameIndex, wheelIconMap]);

  const enterSystemGames = useCallback((consoleKey: string) => {
    setFavoritesOnlyMode(consoleKey === 'Favorites');
    setActiveSystemKey(consoleKey);
    setGameIndex(0);
    setWheelMode('games');
  }, []);

  const returnToSystems = useCallback(() => {
    setSearchOpen(false);
    setLocalSearch('');
    setFavoritesOnlyMode(false);
    setWheelMode('systems');
  }, []);

  // Scroll wheel navigation (throttled lightly so trackpad ticks smoothly step 1 slot at a time)
  const lastWheelTickRef = useRef(0);
  const handleWheelScroll = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (searchOpen) return;
      const now = performance.now();
      if (now - lastWheelTickRef.current < 75) return;
      if (Math.abs(e.deltaY) < 6) return;
      lastWheelTickRef.current = now;

      const delta = e.deltaY > 0 ? 1 : -1;
      if (wheelMode === 'systems') {
        if (systemList.length === 0) return;
        setSystemIndex((prev) => (prev + delta + systemList.length) % systemList.length);
      } else {
        if (filteredGamesList.length === 0) return;
        setGameIndex(
          (prev) => (prev + delta + filteredGamesList.length) % filteredGamesList.length
        );
      }
    },
    [searchOpen, wheelMode, systemList.length, filteredGamesList.length]
  );

  // Fullscreen handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Keyboard navigation (ArrowUp / ArrowDown / Enter / Escape / ArrowLeft)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          setSearchOpen(false);
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (wheelMode === 'systems' && systemList.length > 0) {
          setSystemIndex((p) => (p - 1 + systemList.length) % systemList.length);
        } else if (wheelMode === 'games' && filteredGamesList.length > 0) {
          setGameIndex((p) => (p - 1 + filteredGamesList.length) % filteredGamesList.length);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (wheelMode === 'systems' && systemList.length > 0) {
          setSystemIndex((p) => (p + 1) % systemList.length);
        } else if (wheelMode === 'games' && filteredGamesList.length > 0) {
          setGameIndex((p) => (p + 1) % filteredGamesList.length);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (wheelMode === 'systems' && focusedSystem) {
          enterSystemGames(focusedSystem.consoleKey);
        } else if (wheelMode === 'games' && previewGame) {
          onLaunchGame(previewGame);
        }
      } else if (e.key === 'Escape' || e.key === 'ArrowLeft') {
        if (searchOpen) {
          setSearchOpen(false);
        } else if (wheelMode === 'games') {
          returnToSystems();
        }
      } else if (e.key === 'ArrowRight') {
        if (wheelMode === 'systems' && focusedSystem) {
          e.preventDefault();
          enterSystemGames(focusedSystem.consoleKey);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    wheelMode,
    systemList.length,
    filteredGamesList.length,
    focusedSystem,
    previewGame,
    searchOpen,
    enterSystemGames,
    onLaunchGame,
    returnToSystems,
  ]);

  // Visible curved wheel slots (-4 to +4)
  const visibleWheelSlots = useMemo(() => {
    const offsets = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    if (wheelMode === 'systems') {
      const len = systemList.length;
      if (len === 0) return [];
      if (len < 9) {
        return systemList.map((sys, idx) => ({
          offset: idx - systemIndex,
          key: `sys-${sys.id}`,
          system: sys,
          game: null as GameItem | null,
        }));
      }
      return offsets.map((offset) => {
        const idx = (((systemIndex + offset) % len) + len) % len;
        const sys = systemList[idx];
        return {
          offset,
          key: `sys-${offset}-${sys.id}`,
          system: sys,
          game: null as GameItem | null,
        };
      });
    }

    const len = filteredGamesList.length;
    if (len === 0) return [];
    if (len < 9) {
      return filteredGamesList.map((game, idx) => ({
        offset: idx - gameIndex,
        key: `game-${game.id}-${idx}`,
        system: null as WheelSystemEntry | null,
        game,
      }));
    }
    return offsets.map((offset) => {
      const idx = (((gameIndex + offset) % len) + len) % len;
      const game = filteredGamesList[idx];
      return {
        offset,
        key: `game-${offset}-${game.id}-${idx}`,
        system: null as WheelSystemEntry | null,
        game,
      };
    });
  }, [wheelMode, systemList, systemIndex, filteredGamesList, gameIndex]);

  const crtVideoUrl = previewGame?.gameplayVideoUrl || rawgMedia?.videoUrl || null;
  const crtScreenshots = rawgMedia?.screenshots || [];
  const crtBackdrop =
    crtScreenshots.length > 0
      ? crtScreenshots[shotIdx % crtScreenshots.length]
      : heroBundle?.hero ||
        rawgMedia?.backgroundImage ||
        (settings.posterLabelMode === 'labeled'
          ? heroBundle?.labeledPoster || previewGame?.boxFront || previewGame?.poster
          : heroBundle?.cleanPoster || previewGame?.poster || previewGame?.boxFront) ||
        '';

  const isPreviewFav = previewGame
    ? favorites.includes(previewGame.id) ||
      favorites.includes(previewGame.slug) ||
      favorites.includes(previewGame.title)
    : false;

  const statusLinkText =
    wheelMode === 'games' && previewGame
      ? `https://gam.onl/${(previewGame.consoleType || 'arcade').toLowerCase().replace(/[^a-z0-9]+/g, '')}/${previewGame.slug || previewGame.id}`
      : `https://gam.onl/${focusedSystem?.slugPath || 'arcade'}`;

  return (
    <div
      onWheel={handleWheelScroll}
      className="relative w-full h-screen min-h-[600px] overflow-hidden bg-[#020307] text-white select-none"
    >
      {/* 1. LEFT PAINTED BRICK WALL + RIGHT STUDIO BLACK FADE + CURVED ORBITAL WHEEL GLOW */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60' viewBox='0 0 120 60'>
              <rect width='120' height='60' fill='#151820'/>
              <rect x='1' y='1' width='57' height='27' rx='1' fill='#1b1f29' stroke='#090b10' stroke-width='2'/>
              <rect x='61' y='1' width='57' height='27' rx='1' fill='#181c26' stroke='#090b10' stroke-width='2'/>
              <rect x='-29' y='31' width='57' height='27' rx='1' fill='#171b24' stroke='#090b10' stroke-width='2'/>
              <rect x='31' y='31' width='57' height='27' rx='1' fill='#1c202a' stroke='#090b10' stroke-width='2'/>
              <rect x='91' y='31' width='57' height='27' rx='1' fill='#181b23' stroke='#090b10' stroke-width='2'/>
            </svg>`
          )}")`,
          backgroundSize: '96px 48px',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(6,8,13,0.45) 0%, rgba(4,6,11,0.55) 40%, rgba(2,4,9,0.97) 58%, #020307 100%)',
        }}
      />
      {/* Faint curved orbital ring glow behind the right-side selection wheel */}
      <div
        aria-hidden="true"
        className="hidden lg:block absolute top-1/2 -translate-y-1/2 right-[-38%] w-[92%] aspect-square rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at center, transparent 54%, rgba(23,44,82,0.18) 63%, rgba(30,64,115,0.22) 66%, transparent 72%)',
        }}
      />

      {/* 2. TOP-LEFT GLOSSY CIRCULAR UTILITY DOCK (Matches Reference Screenshot Exactly) */}
      <nav
        aria-label="Arcade Utility Controls"
        className="fixed top-3 left-2.5 sm:left-3.5 z-40 flex flex-col items-center gap-2.5"
      >
        {/* 1. Orange Fullscreen Toggle */}
        <button
          type="button"
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Arcade'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          className="w-10 h-10 rounded-full border-2 border-[#f6ad42] bg-gradient-to-b from-[#f4a22c] to-[#d97706] text-white grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.75)] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          {isFullscreen ? <Minimize2 size={18} strokeWidth={2.5} /> : <Maximize2 size={18} strokeWidth={2.5} />}
        </button>

        {/* 2. Deep Blue Circle + Red-Orange < Back Arrow */}
        <button
          type="button"
          onClick={() => {
            if (searchOpen) {
              setSearchOpen(false);
              setLocalSearch('');
            } else if (wheelMode === 'games') {
              returnToSystems();
            } else {
              const arcIdx = systemList.findIndex((s) => s.consoleKey === 'ARCADE');
              if (arcIdx >= 0) setSystemIndex(arcIdx);
            }
          }}
          title={wheelMode === 'games' ? 'Back to Hardware Systems (Esc)' : 'Center Arcade System'}
          aria-label="Back"
          className="w-10 h-10 rounded-full border-2 border-[#3b71a8] bg-gradient-to-b from-[#1e4d82] to-[#123359] grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.75)] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          <ChevronLeft size={23} strokeWidth={3.4} className="text-[#ef4444] -ml-0.5" />
        </button>

        {/* 3. Mint-Green Save / Favorites Wheel Button */}
        <button
          type="button"
          onClick={() => {
            if (wheelMode === 'games' && favoritesOnlyMode) {
              returnToSystems();
            } else {
              enterSystemGames('Favorites');
            }
          }}
          title="Saved Favorites Wheel"
          aria-label="Open Favorites Games Wheel"
          className={`w-10 h-10 rounded-full border-2 text-white grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.75)] hover:scale-105 active:scale-95 transition-transform cursor-pointer ${
            favoritesOnlyMode
              ? 'border-[#86efac] bg-gradient-to-b from-[#22c55e] to-[#15803d]'
              : 'border-[#8ad0b3] bg-gradient-to-b from-[#66be99] to-[#469674]'
          }`}
        >
          <Save size={18} strokeWidth={2.2} />
        </button>

        {/* 4. Coral-Red Magnifying Glass Search Button */}
        <button
          type="button"
          onClick={() => {
            setSearchOpen((v) => !v);
            setTimeout(() => searchInputRef.current?.focus(), 40);
          }}
          title="Search Retro Games"
          aria-label="Search Games"
          className="w-10 h-10 rounded-full border-2 border-[#f89e8b] bg-gradient-to-b from-[#f47b63] to-[#d9533c] text-white grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.75)] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        >
          <Search size={18} strokeWidth={2.5} />
        </button>

        {/* 5. Spaced Cobalt-Blue Settings / Themes Button (Matches Lower Dock Position) */}
        <button
          type="button"
          onClick={onOpenSettings}
          data-settings-trigger="true"
          title="Settings & Switch Theme"
          aria-label="Open Settings and Themes"
          className="mt-7 w-10 h-10 rounded-full border-2 border-[#4682c4] bg-gradient-to-b from-[#235d9f] to-[#153e6e] text-white grid place-items-center shadow-[0_4px_12px_rgba(0,0,0,0.75)] hover:scale-105 active:scale-95 transition-transform cursor-pointer group"
        >
          <X size={20} strokeWidth={2.2} className="group-hover:hidden" />
          <SlidersHorizontal size={17} className="hidden group-hover:block" />
        </button>
      </nav>

      {/* 3. MAIN SPLIT: LEFT ARCADE CABINET + RIGHT PARABOLIC WHEEL */}
      <div className="relative z-10 w-full h-full flex flex-col lg:flex-row items-center lg:items-stretch justify-between pl-14 sm:pl-16 pr-3 sm:pr-8 lg:pr-12">
        {/* LEFT-CENTER DOMINANT ANCHOR: LEGENDS ULTIMATE STANDUP ARCADE CABINET */}
        <section
          aria-label="Arcade Monitor Cabinet"
          className="relative h-[54vh] lg:h-full w-full max-w-[660px] lg:w-[49%] flex flex-col items-center justify-between pt-0 pb-0 shrink-0"
        >
          {/* Upper Cabinet Body with Metallic Chrome Side T-Molding */}
          <div className="relative w-[92%] sm:w-[86%] flex-1 min-h-0 flex flex-col bg-[#080a0e] shadow-[0_0_70px_rgba(0,0,0,0.95)] border-x-[6px] border-[#94a3b8]">
            {/* Metallic Side Rail Highlight overlays */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-[6px] w-[6px]"
              style={{
                background: 'linear-gradient(90deg, #334155 0%, #f8fafc 48%, #475569 100%)',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -right-[6px] w-[6px]"
              style={{
                background: 'linear-gradient(90deg, #475569 0%, #f8fafc 52%, #1e293b 100%)',
              }}
            />

            {/* A. TOP LIT MARQUEE PANEL ("PLAY RETRO GAMES ONLINE" + "GAM.ONL") */}
            <div className="flex-none px-3 pt-2 pb-2.5 bg-[#020306] border-b-[4px] border-[#64748b] shadow-[inset_0_-6px_14px_rgba(0,0,0,0.9)] text-center flex flex-col items-center justify-center">
              <div
                className="font-mono font-black uppercase tracking-[0.08em] leading-none text-[15px] sm:text-[21px] md:text-[24px] whitespace-nowrap"
                style={{
                  color: '#f59e0b',
                  textShadow:
                    '-1px -1px 0 #38bdf8, 1px -1px 0 #38bdf8, -1px 1px 0 #38bdf8, 1px 1px 0 #38bdf8, 0 0 12px rgba(56,189,248,0.45)',
                }}
              >
                PLAY RETRO GAMES ONLINE
              </div>

              {/* Split Horizon Chrome "GAM.ONL" SVG Marquee Emblem */}
              <svg
                viewBox="0 0 420 66"
                className="w-[210px] sm:w-[270px] md:w-[300px] h-auto mt-1 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]"
                aria-label="GAM.ONL"
              >
                <defs>
                  <linearGradient id="gamonlMarqueeSplit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" />
                    <stop offset="46%" stopColor="#38bdf8" />
                    <stop offset="50%" stopColor="#ffffff" />
                    <stop offset="54%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#f87171" />
                  </linearGradient>
                </defs>
                <text
                  x="210"
                  y="52"
                  textAnchor="middle"
                  fontFamily="'Arial Black', Impact, system-ui, sans-serif"
                  fontWeight="900"
                  fontSize="54"
                  letterSpacing="3"
                  fill="url(#gamonlMarqueeSplit)"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                >
                  GAM.ONL
                </text>
              </svg>
            </div>

            {/* B. RECESSED 4:3 CRT ARCADE MONITOR */}
            <div className="flex-1 min-h-0 px-3 sm:px-4 pt-2 pb-2 bg-[#0f131a] flex items-center justify-center">
              <div
                role="button"
                tabIndex={0}
                onClick={() => previewGame && onLaunchGame(previewGame)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && previewGame) {
                    e.preventDefault();
                    onLaunchGame(previewGame);
                  }
                }}
                title={previewGame ? `Launch ${previewGame.title}` : 'Arcade Monitor'}
                className="group relative w-full h-full max-h-full aspect-[4/3] rounded-[16px] border-[7px] border-[#2d333f] bg-black overflow-hidden cursor-pointer shadow-[inset_0_0_32px_rgba(0,0,0,0.95),0_4px_18px_rgba(0,0,0,0.9)]"
              >
                {/* Live RAWG Gameplay Video OR Screenshot/SteamGridDB Attract Mode */}
                {crtVideoUrl ? (
                  <video
                    key={crtVideoUrl}
                    src={crtVideoUrl}
                    poster={crtBackdrop || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : crtBackdrop ? (
                  <img
                    src={crtBackdrop}
                    alt={previewGame?.title || 'Arcade Attract Mode'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : previewGame ? (
                  <SafeGameImage
                    primaryUrl={previewGame.poster || previewGame.boxFront}
                    fallbackUrl={previewGame.boxFront}
                    title={previewGame.title}
                    consoleType={previewGame.consoleType}
                    alt={previewGame.title}
                    className="w-full h-full object-cover"
                  />
                ) : null}

                {/* Subtle CRT Scanline + Curved Glass Reflection */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 3px)',
                  }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.75)]"
                />

                {/* Authentic Arcade CRT Top Attract HUD ("1P 69400 HI 69400 FREE PLAY") */}
                <div className="pointer-events-none absolute top-1.5 inset-x-3 flex items-center justify-between font-mono text-[10px] sm:text-[12px] font-black tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">
                  <span className="text-[#93c5fd]">
                    1P <span className="text-white ml-1">69400</span>
                  </span>
                  <span className="text-[#fbbf24]">
                    HI <span className="text-white ml-1">69400</span>
                  </span>
                  <span className="text-[#fbbf24]">FREE PLAY</span>
                </div>

                {/* Bottom Active Game Caption + Quick Actions inside CRT Scrim */}
                {previewGame && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pt-6 pb-2 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] sm:text-xs font-extrabold text-white truncate drop-shadow">
                        {previewGame.title}
                      </div>
                      <div className="text-[10px] text-amber-300 font-semibold truncate">
                        {previewGame.consoleType}
                        {previewGame.year ? ` · ${previewGame.year}` : ''}
                        {crtVideoUrl ? ' · Gameplay Video' : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(previewGame.id || previewGame.slug);
                        }}
                        aria-label={isPreviewFav ? 'Remove Favorite' : 'Add Favorite'}
                        title={isPreviewFav ? 'Remove from Favorites' : 'Save to Favorites'}
                        className={`w-7 h-7 rounded grid place-items-center transition-colors cursor-pointer ${
                          isPreviewFav
                            ? 'bg-amber-400 text-black'
                            : 'bg-black/65 text-white hover:bg-black/90'
                        }`}
                      >
                        <Star size={13} fill={isPreviewFav ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspect3D(previewGame);
                        }}
                        aria-label="Inspect 3D Box"
                        title="3D Box Art"
                        className="w-7 h-7 rounded bg-black/65 hover:bg-black/90 text-white grid place-items-center transition-colors cursor-pointer"
                      >
                        <Box size={13} />
                      </button>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#22c55e] text-[#051209] text-[10px] font-black uppercase">
                        <Play size={10} fill="currentColor" />
                        Play
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* C. PERSPECTIVE-TILTED 2-PLAYER "LEGENDS ULTIMATE" CONTROL DECK */}
          <div className="flex-none w-full relative pb-2">
            <svg
              viewBox="0 0 640 165"
              className="w-full h-auto max-h-[155px] drop-shadow-[0_-4px_24px_rgba(0,0,0,0.9)]"
              aria-label="Legends Ultimate 2-Player Arcade Deck"
            >
              <defs>
                <linearGradient id="deckChrome" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#475569" />
                  <stop offset="50%" stopColor="#f8fafc" />
                  <stop offset="100%" stopColor="#334155" />
                </linearGradient>
                <radialGradient id="ballTopRed" cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#fca5a5" />
                  <stop offset="35%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#7f1d1d" />
                </radialGradient>
                <radialGradient id="galaxyGlow" cx="50%" cy="55%" r="55%">
                  <stop offset="0%" stopColor="#3b0764" stopOpacity="0.65" />
                  <stop offset="45%" stopColor="#1e1b4b" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#05070e" />
                </radialGradient>
              </defs>

              {/* Outer Flared Deck Housing + Chrome T-Molding */}
              <polygon
                points="58,6 582,6 636,128 4,128"
                fill="url(#galaxyGlow)"
                stroke="url(#deckChrome)"
                strokeWidth="4.5"
              />
              {/* Bottom Front Lip */}
              <polygon points="4,128 636,128 626,158 14,158" fill="#090c14" stroke="#334155" strokeWidth="2" />

              {/* Neon Pink & Cyan Arcade Halos */}
              <ellipse cx="320" cy="84" rx="82" ry="38" fill="none" stroke="#db2777" strokeWidth="2.5" opacity="0.65" />
              <ellipse cx="320" cy="84" rx="64" ry="29" fill="none" stroke="#06b6d4" strokeWidth="2" opacity="0.7" />
              <ellipse cx="145" cy="72" rx="66" ry="28" fill="none" stroke="#db2777" strokeWidth="2" opacity="0.45" />
              <ellipse cx="495" cy="72" rx="66" ry="28" fill="none" stroke="#06b6d4" strokeWidth="2" opacity="0.45" />

              {/* Player 1 Red Ball-Top Joystick */}
              <ellipse cx="88" cy="88" rx="18" ry="10" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
              <rect x="85" y="54" width="6" height="34" fill="#cbd5e1" />
              <circle cx="88" cy="40" r="18" fill="url(#ballTopRed)" />

              {/* P1 Brown Spinner Dial */}
              <ellipse cx="122" cy="106" rx="16" ry="10" fill="#78533b" stroke="#a87958" strokeWidth="1.5" />
              <ellipse cx="122" cy="102" rx="14" ry="8" fill="#8b6248" />

              {/* P1 6-Button Layout */}
              {[
                [172, 62], [198, 56], [224, 60],
                [168, 84], [195, 78], [222, 82],
              ].map(([cx, cy], idx) => (
                <g key={`p1b-${idx}`}>
                  <ellipse cx={cx} cy={cy} rx="11" ry="7" fill="#0f172a" stroke="#64748b" strokeWidth="1.4" />
                  <ellipse cx={cx} cy={cy - 1.5} rx="8" ry="4.8" fill="#1e293b" />
                </g>
              ))}

              {/* Center P1 / Home / Launch / P2 Console Buttons */}
              <ellipse cx="228" cy="28" rx="12" ry="7" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.2" />
              <ellipse cx="272" cy="28" rx="11" ry="6.5" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.2" />
              {/* Center White START button (Interactive!) */}
              <g
                className="cursor-pointer"
                onClick={() => previewGame && onLaunchGame(previewGame)}
              >
                <ellipse cx="320" cy="28" rx="15" ry="8" fill="#e2e8f0" stroke="#ffffff" strokeWidth="1.5" />
                <title>Press Start to Play</title>
              </g>
              <ellipse cx="368" cy="28" rx="11" ry="6.5" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.2" />
              <ellipse cx="412" cy="28" rx="12" ry="7" fill="#dc2626" stroke="#fca5a5" strokeWidth="1.2" />

              {/* Center Glossy Trackball */}
              <circle cx="320" cy="84" r="24" fill="#0f172a" stroke="#475569" strokeWidth="2.5" />
              <circle cx="320" cy="84" r="19" fill="#020617" />
              <ellipse cx="313" cy="76" rx="6" ry="3.5" transform="rotate(-25 313 76)" fill="#ffffff" opacity="0.28" />

              {/* Player 2 Red Ball-Top Joystick */}
              <ellipse cx="395" cy="88" rx="18" ry="10" fill="#1e293b" stroke="#475569" strokeWidth="1.5" />
              <rect x="392" y="54" width="6" height="34" fill="#cbd5e1" />
              <circle cx="395" cy="40" r="18" fill="url(#ballTopRed)" />

              {/* P2 Brown Spinner Dial */}
              <ellipse cx="445" cy="106" rx="16" ry="10" fill="#78533b" stroke="#a87958" strokeWidth="1.5" />
              <ellipse cx="445" cy="102" rx="14" ry="8" fill="#8b6248" />

              {/* P2 6-Button Layout */}
              {[
                [488, 62], [514, 56], [540, 60],
                [484, 84], [511, 78], [538, 82],
              ].map(([cx, cy], idx) => (
                <g key={`p2b-${idx}`}>
                  <ellipse cx={cx} cy={cy} rx="11" ry="7" fill="#0f172a" stroke="#64748b" strokeWidth="1.4" />
                  <ellipse cx={cx} cy={cy - 1.5} rx="8" ry="4.8" fill="#1e293b" />
                </g>
              ))}

              {/* Yellow Nameplate: LEGENDS ULTIMATE */}
              <rect x="234" y="131" width="172" height="22" rx="2" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
              <text
                x="320"
                y="147"
                textAnchor="middle"
                fontFamily="'Arial Black', Impact, sans-serif"
                fontStyle="italic"
                fontWeight="900"
                fontSize="14"
                fill="#090d16"
                letterSpacing="0.5"
              >
                LEGENDS ULTIMATE
              </text>
            </svg>
          </div>
        </section>

        {/* RIGHT PARABOLIC CURVED SELECTION WHEEL (Systems Level 1 -> SteamGridDB Icons Games Level 2) */}
        <section
          aria-label={wheelMode === 'systems' ? 'Hardware System Wheel' : `${activeSystemKey} Games Wheel`}
          className="relative flex-1 h-[44vh] lg:h-full flex items-center justify-end pr-2 sm:pr-6 lg:pr-10 overflow-hidden"
        >
          {/* Quiet Header Hint when inside a specific Console Games Wheel */}
          {wheelMode === 'games' && (
            <div className="absolute top-3.5 right-4 z-30 flex items-center gap-3 text-xs font-bold text-neutral-300">
              <span className="uppercase tracking-wider text-amber-400">
                {localSearch.trim() ? `Search: ${localSearch}` : activeSystemKey}
              </span>
              <span className="text-neutral-500" aria-hidden="true">·</span>
              <span className="tabular-nums text-neutral-400">
                {filteredGamesList.length.toLocaleString()} titles
              </span>
              <button
                type="button"
                onClick={returnToSystems}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <ChevronLeft size={13} />
                <span>Systems</span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-end justify-center gap-2 pr-8 text-neutral-400">
              <div className="loader" />
              <span className="text-xs font-semibold">Loading arcade wheel...</span>
            </div>
          ) : visibleWheelSlots.length === 0 ? (
            <div className="text-right space-y-2 pr-6">
              <p className="text-base font-extrabold text-white">No games in this category</p>
              <p className="text-xs text-neutral-400">
                {favoritesOnlyMode
                  ? 'Star any game on the CRT monitor to save it to Favorites.'
                  : 'Try another system or clear your search filter.'}
              </p>
              <button
                type="button"
                onClick={returnToSystems}
                className="px-4 py-2 rounded bg-[#ea8c15] text-black text-xs font-black cursor-pointer"
              >
                Back to Systems
              </button>
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-end">
              {visibleWheelSlots.map((slot) => {
                const absOff = Math.abs(slot.offset);
                const isCenter = slot.offset === 0;
                // Parabolic right curve: center (offset 0) protrudes furthest LEFT (-34px), edges swing RIGHT (+120px)
                const arcX = Math.pow(absOff, 1.55) * 16 - (isCenter ? 28 : 0);
                const arcY = slot.offset * 76;
                const scale = isCenter ? 1.08 : Math.max(0.7, 0.96 - absOff * 0.065);
                const opacity = isCenter ? 1 : Math.max(0.5, 0.94 - absOff * 0.11);

                if (slot.system) {
                  const sys = slot.system;
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() => {
                        if (isCenter) {
                          enterSystemGames(sys.consoleKey);
                        } else {
                          const targetIdx = systemList.findIndex((s) => s.id === sys.id);
                          if (targetIdx >= 0) setSystemIndex(targetIdx);
                        }
                      }}
                      onDoubleClick={() => enterSystemGames(sys.consoleKey)}
                      style={{
                        transform: `translate3d(${arcX}px, ${arcY}px, 0) scale(${scale})`,
                        opacity,
                        zIndex: 20 - absOff,
                        transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease',
                      }}
                      className="absolute right-4 sm:right-8 lg:right-10 flex items-center justify-end gap-3 cursor-pointer origin-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]"
                    >
                      <SystemWheelLogo systemKey={sys.consoleKey} isCenter={isCenter} />
                    </button>
                  );
                }

                if (slot.game) {
                  const g = slot.game;
                  const steamGrid = wheelIconMap[g.id];
                  const iconSrc =
                    steamGrid?.icon || g.boxFront || g.poster || g.coverUrl || '';
                  const logoSrc = steamGrid?.logo || null;

                  return (
                    <button
                      key={slot.key}
                      type="button"
                      onClick={() => {
                        if (isCenter) {
                          onLaunchGame(g);
                        } else {
                          const targetIdx = filteredGamesList.findIndex((x) => x.id === g.id);
                          if (targetIdx >= 0) setGameIndex(targetIdx);
                        }
                      }}
                      onDoubleClick={() => onLaunchGame(g)}
                      style={{
                        transform: `translate3d(${arcX}px, ${arcY}px, 0) scale(${scale})`,
                        opacity,
                        zIndex: 20 - absOff,
                        transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease',
                      }}
                      className="absolute right-4 sm:right-8 lg:right-10 max-w-[340px] sm:max-w-[400px] flex items-center justify-end gap-3.5 cursor-pointer origin-right focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]"
                    >
                      {/* SteamGridDB Game Icon (/icons/:gameId) */}
                      <div
                        className={`shrink-0 rounded-lg overflow-hidden bg-[#0c111b] border transition-colors ${
                          isCenter
                            ? 'w-12 h-12 sm:w-14 sm:h-14 border-amber-400/80 shadow-[0_0_20px_rgba(245,158,11,0.4)]'
                            : 'w-10 h-10 sm:w-11 sm:h-11 border-white/15'
                        }`}
                      >
                        {iconSrc ? (
                          <img
                            src={iconSrc}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain p-0.5"
                          />
                        ) : (
                          <SafeGameImage
                            primaryUrl={g.poster || g.boxFront}
                            title={g.title}
                            consoleType={g.consoleType}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      {/* SteamGridDB Transparent Logo OR Crisp Arcade Title */}
                      <div className="min-w-0 text-right">
                        {logoSrc ? (
                          <img
                            src={logoSrc}
                            alt={g.title}
                            referrerPolicy="no-referrer"
                            className={`max-w-[220px] sm:max-w-[270px] object-contain ml-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] ${
                              isCenter ? 'max-h-14' : 'max-h-10 opacity-90'
                            }`}
                          />
                        ) : (
                          <div className="text-right">
                            <div
                              className={`font-black tracking-tight leading-tight line-clamp-1 ${
                                isCenter
                                  ? 'text-lg sm:text-2xl text-amber-400 drop-shadow-[0_2px_10px_rgba(245,158,11,0.45)]'
                                  : 'text-sm sm:text-base text-slate-200'
                              }`}
                            >
                              {g.title}
                            </div>
                            <div className="text-[10px] font-semibold text-neutral-400 tabular-nums">
                              {g.consoleType}
                              {g.year ? ` · ${g.year}` : ''}
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                }

                return null;
              })}
            </div>
          )}
        </section>
      </div>

      {/* 4. SLEEK SEARCH OVERLAY MODAL (Coral-Red Search Dock Button) */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-[#0d121c] border border-[#2f3c56] shadow-2xl p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-black/60 border border-white/15 focus-within:border-[#f59e0b]">
              <Search size={16} className="text-amber-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  setWheelMode('games');
                  setGameIndex(0);
                }}
                placeholder="Search any game across all systems..."
                className="w-full bg-transparent text-sm text-white placeholder:text-neutral-500 outline-none"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => setLocalSearch('')}
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {localSearch.trim() && (
              <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                {filteredGamesList.slice(0, 20).map((g, idx) => (
                  <button
                    key={`srch-${g.id}-${idx}`}
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      onLaunchGame(g);
                    }}
                    className="w-full px-2.5 py-2 flex items-center justify-between gap-3 hover:bg-white/10 text-left rounded cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{g.title}</div>
                      <div className="text-[11px] text-neutral-400">
                        {g.consoleType} {g.year ? `· ${g.year}` : ''}
                      </div>
                    </div>
                    <Play size={13} className="text-amber-400 shrink-0" />
                  </button>
                ))}
                {filteredGamesList.length === 0 && (
                  <p className="text-xs text-neutral-400 py-4 text-center">
                    No matching games found.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. BOTTOM-LEFT SIGNATURE RED GAM.ONL LINK STRIP */}
      <button
        type="button"
        onClick={() => {
          if (wheelMode === 'systems' && focusedSystem) {
            enterSystemGames(focusedSystem.consoleKey);
          } else if (previewGame) {
            onLaunchGame(previewGame);
          }
        }}
        className="fixed bottom-0 left-0 z-40 bg-[#c81010] hover:bg-[#dc2626] text-white text-[11px] font-medium px-2.5 py-0.5 tracking-tight transition-colors cursor-pointer"
      >
        {statusLinkText}
      </button>
    </div>
  );
};

export default GamOnlView;
