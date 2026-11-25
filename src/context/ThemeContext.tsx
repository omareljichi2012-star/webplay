import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { TmdbCatalogItem, TmdbMediaType } from '../services/tmdb';
import { DEFAULT_MOVIE_SERVER_KEY, SERVERS } from '../utils/movieServers';

export type UiTheme = 'obsidian' | 'netflix' | 'popcorn' | 'gamonl' | 'kaleidescape';
export type NetflixProfile = 'Main' | 'Kids' | 'Anime';
export type PosterLabelMode = 'labeled' | 'clean' | 'overlay';
export type PosterDensity = 'compact' | 'standard' | 'large';
export type StartupSection = 'games' | 'movies' | 'tv' | 'anime' | 'cartoons' | 'nostalgia';
export type ShaderPresetId = 'none' | 'crt' | 'scanlines' | 'pixel-perfect' | 'crt-curved';

export interface AppSettings {
  posterLabelMode: PosterLabelMode;
  posterDensity: PosterDensity;
  showCardMetadata: boolean;
  defaultSection: StartupSection;
  shaderPreset: ShaderPresetId;
  defaultVideoServer: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  posterLabelMode: 'labeled',
  posterDensity: 'standard',
  showCardMetadata: true,
  defaultSection: 'games',
  shaderPreset: 'none',
  defaultVideoServer: DEFAULT_MOVIE_SERVER_KEY,
};

export interface ContinueWatchingItem {
  id: string;
  tmdbId: string;
  mediaType: TmdbMediaType;
  title: string;
  posterUrl: string;
  backdropUrl: string | null;
  year: string;
  voteAverage: number;
  season?: number;
  episode?: number;
  progressPercent: number;
  updatedAt: number;
  sourceTab?: 'movies' | 'tv' | 'anime' | 'cartoons';
}

interface ThemeContextValue {
  theme: UiTheme;
  setTheme: (next: UiTheme) => void;
  toggleTheme: () => void;
  isNetflix: boolean;
  isPopcorn: boolean;
  isGamOnl: boolean;
  isKaleidescape: boolean;
  netflixProfile: NetflixProfile;
  setNetflixProfile: (profile: NetflixProfile) => void;
  myList: TmdbCatalogItem[];
  isInMyList: (id: string) => boolean;
  toggleMyList: (item: TmdbCatalogItem) => void;
  likedIds: string[];
  isLiked: (id: string) => boolean;
  toggleLike: (id: string) => void;
  continueWatching: ContinueWatchingItem[];
  recordContinueWatching: (
    item: TmdbCatalogItem,
    extra?: { season?: number; episode?: number; sourceTab?: 'movies' | 'tv' | 'anime' | 'cartoons' }
  ) => void;
  removeContinueWatching: (id: string) => void;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

const THEME_STORAGE_KEY = 'streamx_theme_v1';
const PROFILE_STORAGE_KEY = 'streamx_netflix_profile_v1';
const WATCHLIST_STORAGE_KEY = 'streamx_cinema_watchlist_v1';
const LIKED_STORAGE_KEY = 'streamx_netflix_liked_v1';
const CONTINUE_STORAGE_KEY = 'streamx_continue_watching_v1';
const SETTINGS_STORAGE_KEY = 'streamx_app_settings_v1';
const SHADER_PREF_KEY = 'retro_shader_preference';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function loadInitialSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const shaderRaw = localStorage.getItem(SHADER_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const validDensities: PosterDensity[] = ['compact', 'standard', 'large'];
    const validSections: StartupSection[] = ['games', 'movies', 'tv', 'anime', 'cartoons', 'nostalgia'];
    const validShaders: ShaderPresetId[] = ['none', 'crt', 'scanlines', 'pixel-perfect', 'crt-curved'];

    let mode: PosterLabelMode = DEFAULT_APP_SETTINGS.posterLabelMode;
    if (parsed.posterLabelMode === 'labeled' || parsed.posterLabelMode === 'box') mode = 'labeled';
    else if (parsed.posterLabelMode === 'clean') mode = 'clean';
    else if (parsed.posterLabelMode === 'overlay' || parsed.posterLabelMode === 'corner') mode = 'overlay';

    const shaderCandidate = parsed.shaderPreset || shaderRaw || 'none';
    return {
      posterLabelMode: mode,
      posterDensity: validDensities.includes(parsed.posterDensity) ? parsed.posterDensity : DEFAULT_APP_SETTINGS.posterDensity,
      showCardMetadata: typeof parsed.showCardMetadata === 'boolean' ? parsed.showCardMetadata : DEFAULT_APP_SETTINGS.showCardMetadata,
      defaultSection: validSections.includes(parsed.defaultSection) ? parsed.defaultSection : DEFAULT_APP_SETTINGS.defaultSection,
      shaderPreset: validShaders.includes(shaderCandidate) ? shaderCandidate : DEFAULT_APP_SETTINGS.shaderPreset,
      defaultVideoServer:
        parsed.defaultVideoServer && SERVERS[parsed.defaultVideoServer]
          ? parsed.defaultVideoServer
          : DEFAULT_APP_SETTINGS.defaultVideoServer,
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<UiTheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (
        saved === 'netflix' ||
        saved === 'obsidian' ||
        saved === 'popcorn' ||
        saved === 'gamonl' ||
        saved === 'kaleidescape'
      ) {
        return saved;
      }
    } catch {}
    return 'obsidian';
  });

  const [netflixProfile, setNetflixProfileState] = useState<NetflixProfile>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved === 'Main' || saved === 'Kids' || saved === 'Anime') return saved;
    } catch {}
    return 'Main';
  });

  const [myList, setMyList] = useState<TmdbCatalogItem[]>(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [likedIds, setLikedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LIKED_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>(() => {
    try {
      const raw = localStorage.getItem(CONTINUE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);

  const setTheme = useCallback((next: UiTheme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(
      theme === 'obsidian'
        ? 'netflix'
        : theme === 'netflix'
        ? 'popcorn'
        : theme === 'popcorn'
        ? 'gamonl'
        : theme === 'gamonl'
        ? 'kaleidescape'
        : 'obsidian'
    );
  }, [theme, setTheme]);

  const setNetflixProfile = useCallback((profile: NetflixProfile) => {
    setNetflixProfileState(profile);
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, profile);
    } catch {}
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
        if (patch.shaderPreset !== undefined) {
          localStorage.setItem(SHADER_PREF_KEY, next.shaderPreset);
        }
      } catch {}
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_APP_SETTINGS);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_APP_SETTINGS));
      localStorage.setItem(SHADER_PREF_KEY, DEFAULT_APP_SETTINGS.shaderPreset);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(myList));
    } catch {}
  }, [myList]);

  useEffect(() => {
    try {
      localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(likedIds));
    } catch {}
  }, [likedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(CONTINUE_STORAGE_KEY, JSON.stringify(continueWatching));
    } catch {}
  }, [continueWatching]);

  const isInMyList = useCallback(
    (id: string) => myList.some((item) => item.id === id),
    [myList]
  );

  const toggleMyList = useCallback((item: TmdbCatalogItem) => {
    setMyList((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      return exists ? prev.filter((x) => x.id !== item.id) : [item, ...prev];
    });
  }, []);

  const isLiked = useCallback((id: string) => likedIds.includes(id), [likedIds]);

  const toggleLike = useCallback((id: string) => {
    setLikedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const recordContinueWatching = useCallback(
    (
      item: TmdbCatalogItem,
      extra?: { season?: number; episode?: number; sourceTab?: 'movies' | 'tv' | 'anime' | 'cartoons' }
    ) => {
      setContinueWatching((prev) => {
        const existing = prev.find((x) => x.id === item.id);
        const nextProgress = existing
          ? Math.min(92, (existing.progressPercent || 22) + 14)
          : 28;
        const entry: ContinueWatchingItem = {
          id: item.id,
          tmdbId: item.tmdbId,
          mediaType: item.mediaType,
          title: item.title,
          posterUrl: item.posterUrl,
          backdropUrl: item.backdropUrl,
          year: item.year,
          voteAverage: item.voteAverage,
          season: extra?.season ?? existing?.season ?? (item.mediaType === 'tv' ? 1 : undefined),
          episode: extra?.episode ?? existing?.episode ?? (item.mediaType === 'tv' ? 1 : undefined),
          progressPercent: nextProgress,
          updatedAt: Date.now(),
          sourceTab: extra?.sourceTab ?? existing?.sourceTab,
        };
        return [entry, ...prev.filter((x) => x.id !== item.id)].slice(0, 20);
      });
    },
    []
  );

  const removeContinueWatching = useCallback((id: string) => {
    setContinueWatching((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isNetflix: theme === 'netflix',
        isPopcorn: theme === 'popcorn',
        isGamOnl: theme === 'gamonl',
        isKaleidescape: theme === 'kaleidescape',
        netflixProfile,
        setNetflixProfile,
        myList,
        isInMyList,
        toggleMyList,
        likedIds,
        isLiked,
        toggleLike,
        continueWatching,
        recordContinueWatching,
        removeContinueWatching,
        settings,
        updateSettings,
        resetSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
