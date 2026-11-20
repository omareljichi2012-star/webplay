import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  RotateCcw,
  Copy,
  Check,
  Maximize2,
  ExternalLink,
  Calendar,
  Star,
  Tv,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { ServerSwitcherGrid } from './ServerSwitcherGrid';
import {
  SERVERS,
  DEFAULT_MOVIE_SERVER_KEY,
  buildMediaEmbedUrl,
  isImdbId,
} from '../utils/movieServers';
import {
  TmdbCatalogItem,
  TmdbEpisodeSummary,
  TmdbMediaDetails,
  TmdbMediaType,
  createCastAvatarFallback,
  fetchTmdbDetails,
  fetchTvSeasonEpisodes,
} from '../services/tmdb';
import { handlePosterImageError } from '../utils/posterFallback';

export interface MoviePlayerTarget {
  mediaType: TmdbMediaType;
  tmdbId: string;
  customRawId?: string;
  previewItem?: TmdbCatalogItem;
}

interface MoviePlayerViewProps {
  target: MoviePlayerTarget;
  onClose: () => void;
}

function detectSandboxedParent(): boolean {
  try {
    if (typeof window === 'undefined' || window.self === window.top) return false;
    try {
      document.domain = document.domain;
      return false;
    } catch (err: any) {
      return String(err?.message || err || '')
        .toLowerCase()
        .includes('sandbox');
    }
  } catch {
    return true;
  }
}

function formatRuntime(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export const MoviePlayerView: React.FC<MoviePlayerViewProps> = ({ target, onClose }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerStageRef = useRef<HTMLElement | null>(null);

  const [isSandboxedHost] = useState<boolean>(() => detectSandboxedParent());
  const [activeDetails, setActiveDetails] = useState<TmdbMediaDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(true);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [showAllCast, setShowAllCast] = useState<boolean>(false);

  const [season, setSeason] = useState<number>(() => {
    try {
      const s = Number(new URLSearchParams(window.location.search).get('s') || 1);
      return Number.isFinite(s) && s > 0 ? s : 1;
    } catch {
      return 1;
    }
  });
  const [episode, setEpisode] = useState<number>(() => {
    try {
      const e = Number(new URLSearchParams(window.location.search).get('e') || 1);
      return Number.isFinite(e) && e > 0 ? e : 1;
    } catch {
      return 1;
    }
  });
  const [seasonEpisodes, setSeasonEpisodes] = useState<TmdbEpisodeSummary[]>([]);

  const [activeServerKey, setActiveServerKey] = useState<string>(() => {
    try {
      const urlServer = new URLSearchParams(window.location.search).get('server');
      if (urlServer && SERVERS[urlServer]) return urlServer;
    } catch {}
    return DEFAULT_MOVIE_SERVER_KEY;
  });

  const [preferredIdMode, setPreferredIdMode] = useState<'tmdb' | 'imdb'>(() =>
    isImdbId(target.customRawId) ? 'imdb' : 'tmdb'
  );
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Scroll to top when opening the player page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [target.mediaType, target.tmdbId]);

  // Allow pressing Escape to go back to posters catalog
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        const tagName = (e.target as HTMLElement)?.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Fetch full TMDB details & cast credits
  useEffect(() => {
    if (!target.tmdbId) return;
    let cancelled = false;

    const loadDetails = async () => {
      setDetailsLoading(true);
      setDetailsError(null);
      setShowAllCast(false);

      try {
        const details = await fetchTmdbDetails(target.mediaType, target.tmdbId);
        if (cancelled) return;
        setActiveDetails(details);

        if (details.mediaType === 'tv') {
          const validSeasons = details.seasons;
          const defaultSeason =
            validSeasons.find((s) => s.seasonNumber === season) || validSeasons[0];
          const resolvedSeason = defaultSeason ? defaultSeason.seasonNumber : 1;
          const maxEp = defaultSeason?.episodeCount || 1;
          if (resolvedSeason !== season) setSeason(resolvedSeason);
          if (episode > maxEp) setEpisode(1);
        }
      } catch (err: any) {
        if (!cancelled) {
          setDetailsError(err?.message || 'Could not load TMDB metadata for this title.');
        }
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    };

    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [target.mediaType, target.tmdbId]);

  // Fetch episodes list for selected TV season
  useEffect(() => {
    if (target.mediaType !== 'tv' || !target.tmdbId) {
      setSeasonEpisodes([]);
      return;
    }
    let cancelled = false;
    fetchTvSeasonEpisodes(target.tmdbId, season).then((eps) => {
      if (!cancelled) setSeasonEpisodes(eps);
    });
    return () => {
      cancelled = true;
    };
  }, [target.mediaType, target.tmdbId, season]);

  const activeMediaType: TmdbMediaType = target.mediaType || activeDetails?.mediaType || 'movie';
  const activeTmdbId = target.tmdbId || activeDetails?.tmdbId || '';
  const activeImdbId =
    activeDetails?.imdbId || (isImdbId(target.customRawId) ? target.customRawId || null : null);

  const effectiveEmbedId =
    preferredIdMode === 'imdb' && activeImdbId ? activeImdbId : activeTmdbId;

  const activeEmbedUrl = useMemo(() => {
    if (!effectiveEmbedId) return 'about:blank';
    return buildMediaEmbedUrl(activeServerKey, activeMediaType, effectiveEmbedId, {
      imdbId: activeImdbId,
      tmdbId: activeTmdbId,
      season,
      episode,
    });
  }, [activeServerKey, activeMediaType, effectiveEmbedId, activeImdbId, activeTmdbId, season, episode]);

  const syncQueryParams = useCallback(
    (mediaType: TmdbMediaType, idValue: string, serverKey: string, s: number, e: number) => {
      try {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('id');
        if (mediaType === 'tv') {
          nextUrl.searchParams.delete('movie');
          nextUrl.searchParams.set('tv', idValue);
          nextUrl.searchParams.set('s', String(s));
          nextUrl.searchParams.set('e', String(e));
          nextUrl.searchParams.set('server', serverKey);
        } else {
          nextUrl.searchParams.delete('tv');
          nextUrl.searchParams.delete('s');
          nextUrl.searchParams.delete('e');
          nextUrl.searchParams.set('movie', idValue);
          nextUrl.searchParams.set('server', serverKey);
        }
        window.history.replaceState(
          null,
          '',
          `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
        );
      } catch {}
    },
    []
  );

  useEffect(() => {
    iframeRef.current?.removeAttribute('sandbox');
    if (effectiveEmbedId) {
      syncQueryParams(activeMediaType, effectiveEmbedId, activeServerKey, season, episode);
    }
  }, [activeMediaType, effectiveEmbedId, activeServerKey, season, episode, syncQueryParams]);

  const updateIframeSrcInPlace = (
    serverKey: string,
    mediaType: TmdbMediaType,
    idValue: string,
    s = season,
    e = episode
  ) => {
    const url = buildMediaEmbedUrl(serverKey, mediaType, idValue, {
      imdbId: activeImdbId,
      tmdbId: activeTmdbId,
      season: s,
      episode: e,
    });
    if (iframeRef.current) {
      iframeRef.current.removeAttribute('sandbox');
      iframeRef.current.src = url;
    }
  };

  const handleSelectServer = (serverKey: string) => {
    if (!SERVERS[serverKey]) return;
    setActiveServerKey(serverKey);
    if (effectiveEmbedId) {
      updateIframeSrcInPlace(serverKey, activeMediaType, effectiveEmbedId, season, episode);
    }
  };

  const handleSeasonChange = (nextSeason: number) => {
    setSeason(nextSeason);
    setEpisode(1);
    if (effectiveEmbedId) {
      updateIframeSrcInPlace(activeServerKey, 'tv', effectiveEmbedId, nextSeason, 1);
    }
  };

  const handleEpisodeChange = (nextEpisode: number) => {
    setEpisode(nextEpisode);
    if (effectiveEmbedId) {
      updateIframeSrcInPlace(activeServerKey, 'tv', effectiveEmbedId, season, nextEpisode);
    }
  };

  const handleReloadIframe = () => {
    const frame = iframeRef.current;
    if (!frame) return;
    frame.removeAttribute('sandbox');
    frame.src = 'about:blank';
    window.requestAnimationFrame(() => {
      if (iframeRef.current) {
        iframeRef.current.removeAttribute('sandbox');
        iframeRef.current.src = activeEmbedUrl;
      }
    });
  };

  const handleCopyEmbedUrl = async () => {
    try {
      await navigator.clipboard.writeText(activeEmbedUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      setCopiedUrl(false);
    }
  };

  const handleFullscreen = () => {
    const el = iframeRef.current || playerStageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const handleBackClick = () => {
    if (iframeRef.current) {
      iframeRef.current.src = 'about:blank';
    }
    onClose();
  };

  const serverList = useMemo(() => Object.values(SERVERS), []);
  const activeServerConfig = SERVERS[activeServerKey] || SERVERS[DEFAULT_MOVIE_SERVER_KEY];

  const tvSeasons = useMemo(() => {
    if (activeDetails?.seasons && activeDetails.seasons.length > 0) {
      return activeDetails.seasons;
    }
    return [{ id: 1, seasonNumber: 1, name: 'Season 1', episodeCount: 12 }];
  }, [activeDetails?.seasons]);

  const activeSeasonInfo = useMemo(
    () => tvSeasons.find((s) => s.seasonNumber === season) || tvSeasons[0],
    [tvSeasons, season]
  );

  const episodeOptions = useMemo(() => {
    const count = Math.max(1, activeSeasonInfo?.episodeCount || 1);
    return Array.from({ length: count }, (_, idx) => {
      const epNum = idx + 1;
      const matched = seasonEpisodes.find((e) => e.episodeNumber === epNum);
      return {
        number: epNum,
        label: matched ? `E${epNum}: ${matched.name}` : `Episode ${epNum}`,
      };
    });
  }, [activeSeasonInfo?.episodeCount, seasonEpisodes]);

  const displayedCast = useMemo(() => {
    const list = activeDetails?.cast || [];
    return showAllCast ? list : list.slice(0, 12);
  }, [activeDetails?.cast, showAllCast]);

  const playerTitle =
    activeDetails?.title || target.previewItem?.title || `TMDB #${target.tmdbId}`;
  const playerPoster = activeDetails?.posterUrl || target.previewItem?.posterUrl || '';
  const playerBackdrop =
    activeDetails?.backdropUrl || activeDetails?.backdropGallery?.[0] || null;
  const playerOverview =
    activeDetails?.overview || target.previewItem?.overview || '';
  const playerVote = activeDetails?.voteAverage ?? target.previewItem?.voteAverage ?? 0;
  const playerVoteCount = activeDetails?.voteCount ?? target.previewItem?.voteCount ?? 0;
  const playerReleaseDate =
    activeDetails?.releaseDate || target.previewItem?.releaseDate || '';

  return (
    <div className="min-h-screen w-full bg-[#08080a] text-[#f7f7fb] flex flex-col">
      {/* Standalone Top Player Bar */}
      <header className="sticky top-0 z-40 bg-[#0d0d10]/95 backdrop-blur-md border-b border-[#222228] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBackClick}
            aria-label="Back to Catalog"
            title="Back to Catalog"
            className="w-9 h-9 rounded-full bg-[#18181d] hover:bg-[#272730] border border-[#2f2f38] hover:border-white/30 text-neutral-300 hover:text-white grid place-items-center transition-all shrink-0 cursor-pointer shadow-md"
          >
            <X size={17} strokeWidth={2.4} />
          </button>

          <div className="min-w-0">
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider truncate">
              {activeMediaType === 'tv'
                ? `TV Series · Season ${season} · Episode ${episode}`
                : 'Movie Player'}
            </div>
            <h1 className="text-sm sm:text-base font-extrabold text-white truncate">
              {playerTitle}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReloadIframe}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#2c2c34] bg-[#18181d] hover:bg-[#24242b] text-neutral-200 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reload</span>
          </button>
          <button
            type="button"
            onClick={handleFullscreen}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Maximize2 size={13} />
            <span>Fullscreen</span>
          </button>
          <a
            href={activeEmbedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#2c2c34] bg-[#18181d] hover:bg-[#24242b] text-neutral-200 text-xs font-bold transition-colors whitespace-nowrap"
            title="Open direct embed in new tab"
          >
            <ExternalLink size={13} />
            <span className="hidden sm:inline">Direct Tab</span>
          </a>
        </div>
      </header>

      {/* Focused Content: Only the Player + Its Information & Cast */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8 flex-1">
        {/* Video Player Stage with Server Switcher Directly Under the Player */}
        <section
          ref={playerStageRef}
          id="movie-player-stage"
          className="rounded-2xl border border-[#27272c] bg-[#09090b] overflow-hidden shadow-2xl"
        >
          {/* Sandbox-free Video Iframe */}
          <div className="w-full aspect-video bg-black relative">
            <iframe
              ref={iframeRef}
              id="movie-player-iframe"
              src={activeEmbedUrl}
              title={`${playerTitle} (${activeServerConfig.label})`}
              className="w-full h-full border-0 block bg-black"
              allowFullScreen
              credentialless={true}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* TV Season & Episode Picker directly under the player */}
          {activeMediaType === 'tv' && (
            <div className="px-4 sm:px-5 py-3 bg-[#111114] border-t border-[#27272c] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-neutral-200 inline-flex items-center gap-1.5">
                  <Tv size={14} className="text-emerald-400" />
                  <span>Episode Picker:</span>
                </span>

                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400">Season</span>
                  <select
                    value={season}
                    onChange={(e) => handleSeasonChange(Number(e.target.value))}
                    className="px-2.5 py-1.5 rounded-lg bg-[#18181b] border border-[#2e2e36] text-xs font-bold text-white outline-none focus:border-neutral-400 cursor-pointer tabular-nums"
                  >
                    {tvSeasons.map((s) => (
                      <option key={s.id || s.seasonNumber} value={s.seasonNumber}>
                        {s.name} ({s.episodeCount} eps)
                      </option>
                    ))}
                  </select>
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                  <span className="font-semibold text-slate-400">Episode</span>
                  <select
                    value={episode}
                    onChange={(e) => handleEpisodeChange(Number(e.target.value))}
                    className="max-w-[230px] px-2.5 py-1.5 rounded-lg bg-[#18181b] border border-[#2e2e36] text-xs font-bold text-white outline-none focus:border-neutral-400 cursor-pointer tabular-nums"
                  >
                    {episodeOptions.map((ep) => (
                      <option key={ep.number} value={ep.number}>
                        {ep.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={episode <= 1}
                  onClick={() => handleEpisodeChange(Math.max(1, episode - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272d] border border-[#2e2e36] text-xs font-bold text-neutral-200 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft size={13} />
                  <span>Prev Ep</span>
                </button>
                <button
                  type="button"
                  disabled={episode >= episodeOptions.length}
                  onClick={() =>
                    handleEpisodeChange(Math.min(episodeOptions.length, episode + 1))
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#27272c] hover:bg-[#3f3f46] border border-[#3f3f46] text-xs font-bold text-white transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <span>Next Ep</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Multi-Server Grid Switcher UNDER the player */}
          <div className="border-t border-[#222228]">
            <ServerSwitcherGrid
              servers={serverList}
              activeKey={activeServerKey}
              onSelect={handleSelectServer}
            />
          </div>

          {isSandboxedHost && !activeServerConfig.noSandboxBlock && (
            <div className="px-4 sm:px-5 py-2 bg-amber-950/35 border-t border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
              <span>
                <strong>{activeServerConfig.label}</strong> blocks sandboxed preview frames. Switch to a sandbox-safe mirror or open directly:
              </span>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectServer('vidlink')}
                  className="px-2.5 py-1 rounded-md bg-white hover:bg-neutral-200 text-black text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Use VidLink Pro
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectServer('autoembed')}
                  className="px-2.5 py-1 rounded-md bg-[#18181d] hover:bg-[#24242b] border border-[#32323c] text-neutral-200 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  Use AutoEmbed
                </button>
                <a
                  href={activeEmbedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[11px] font-bold transition-colors"
                >
                  <span>Open Direct Tab</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          )}

          {/* Active Embed URL */}
          <div className="px-4 sm:px-5 py-2.5 bg-[#0a0a0c] border-t border-[#222228] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#1c1c22] text-neutral-200 border border-[#2c2c34] shrink-0">
                {activeServerConfig.label}
              </span>
              <code
                className="text-xs font-mono text-neutral-400 truncate block select-all"
                title={activeEmbedUrl}
              >
                {activeEmbedUrl}
              </code>
            </div>

            <button
              type="button"
              onClick={handleCopyEmbedUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2c2c34] bg-[#18181d] hover:bg-[#24242b] text-neutral-200 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedUrl ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Full TMDB Information Showcase (Poster, Backdrop, Synopsis, Details, Genres) */}
        <section className="relative rounded-2xl border border-[#222228] bg-[#111114] overflow-hidden shadow-2xl">
          {playerBackdrop && (
            <img
              src={playerBackdrop}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
              className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none select-none"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111114] via-[#111114]/85 to-[#111114]/50 pointer-events-none" />

          <div className="relative z-10 p-5 sm:p-7 flex flex-col sm:flex-row items-start gap-6">
            {playerPoster && (
              <img
                src={playerPoster}
                alt={playerTitle}
                referrerPolicy="no-referrer"
                onError={(e) =>
                  handlePosterImageError(
                    e,
                    playerTitle,
                    activeMediaType === 'tv' ? 'TV Shows' : 'Movies'
                  )
                }
                className="w-32 sm:w-44 aspect-[2/3] rounded-xl object-cover border border-white/10 shadow-2xl shrink-0"
              />
            )}

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-300 tabular-nums">
                <span className="font-bold uppercase tracking-wider text-white/80">
                  {activeMediaType === 'tv' ? 'TV Series' : 'Feature Film'}
                </span>
                {activeDetails?.status && (
                  <>
                    <span aria-hidden="true" className="text-neutral-600">·</span>
                    <span className="text-neutral-300">{activeDetails.status}</span>
                  </>
                )}
                <span aria-hidden="true" className="text-neutral-600">·</span>
                <span className="font-mono text-emerald-400">TMDB #{activeTmdbId}</span>
                {activeImdbId && (
                  <>
                    <span aria-hidden="true" className="text-neutral-600">·</span>
                    <div className="inline-flex items-center rounded border border-[#2c2c34] bg-[#18181d]/90 overflow-hidden text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          setPreferredIdMode('tmdb');
                          updateIframeSrcInPlace(
                            activeServerKey,
                            activeMediaType,
                            activeTmdbId,
                            season,
                            episode
                          );
                        }}
                        className={`px-2 py-0.5 font-bold transition-colors cursor-pointer ${
                          preferredIdMode === 'tmdb'
                            ? 'bg-white text-black'
                            : 'text-neutral-300 hover:text-white'
                        }`}
                      >
                        TMDB
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPreferredIdMode('imdb');
                          updateIframeSrcInPlace(
                            activeServerKey,
                            activeMediaType,
                            activeImdbId,
                            season,
                            episode
                          );
                        }}
                        className={`px-2 py-0.5 font-bold transition-colors cursor-pointer ${
                          preferredIdMode === 'imdb'
                            ? 'bg-white text-black'
                            : 'text-neutral-300 hover:text-white'
                        }`}
                      >
                        IMDb {activeImdbId}
                      </button>
                    </div>
                  </>
                )}
                {playerReleaseDate && (
                  <>
                    <span aria-hidden="true" className="text-neutral-600">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} className="text-neutral-400" />
                      {playerReleaseDate}
                    </span>
                  </>
                )}
                {activeMediaType === 'movie' && activeDetails?.runtime ? (
                  <>
                    <span aria-hidden="true" className="text-neutral-600">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} className="text-neutral-400" />
                      {formatRuntime(activeDetails.runtime)}
                    </span>
                  </>
                ) : null}
                {activeMediaType === 'tv' && activeDetails?.numberOfSeasons ? (
                  <>
                    <span aria-hidden="true" className="text-neutral-600">·</span>
                    <span>
                      {activeDetails.numberOfSeasons} Season
                      {activeDetails.numberOfSeasons > 1 ? 's' : ''}
                      {activeDetails.numberOfEpisodes
                        ? ` · ${activeDetails.numberOfEpisodes} Episodes`
                        : ''}
                    </span>
                  </>
                ) : null}
                {playerVote > 0 && (
                  <>
                    <span aria-hidden="true" className="text-neutral-600">·</span>
                    <span className="inline-flex items-center gap-1 text-white font-bold">
                      <Star size={12} className="text-[#22c55e] fill-[#22c55e]" />
                      {playerVote.toFixed(1)}/10
                      {playerVoteCount > 0 && (
                        <span className="text-neutral-400 font-normal">
                          ({playerVoteCount.toLocaleString()} votes)
                        </span>
                      )}
                    </span>
                  </>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {playerTitle}
              </h2>

              {activeDetails?.tagline && (
                <p className="text-sm italic text-neutral-300/80">
                  “{activeDetails.tagline}”
                </p>
              )}

              {activeDetails?.genres && activeDetails.genres.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeDetails.genres.map((g) => (
                    <span
                      key={g.id}
                      className="px-2.5 py-1 rounded-md bg-[#1a1a20] border border-[#2c2c34] text-xs font-semibold text-neutral-200"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-sm text-neutral-300 leading-relaxed max-w-3xl">
                {detailsLoading && !activeDetails
                  ? 'Loading full TMDB details and cast...'
                  : playerOverview}
              </p>
            </div>
          </div>
        </section>

        {detailsError && (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-400" />
            <span>{detailsError}</span>
          </div>
        )}

        {/* Cast & Stars Grid */}
        {activeDetails && activeDetails.cast.length > 0 && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e1e24] pb-3">
              <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <Users size={16} className="text-neutral-300" />
                <span>Cast &amp; Stars ({activeDetails.cast.length})</span>
              </h3>
              {activeDetails.cast.length > 12 && (
                <button
                  type="button"
                  onClick={() => setShowAllCast((v) => !v)}
                  className="px-3 py-1 rounded-lg border border-[#2c2c34] bg-[#18181d] hover:bg-[#24242b] text-xs font-bold text-neutral-200 transition-colors cursor-pointer"
                >
                  {showAllCast ? 'Show Top 12' : `Show All ${activeDetails.cast.length} Cast`}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
              {displayedCast.map((actor) => (
                <div
                  key={`${actor.id}-${actor.character}`}
                  className="rounded-xl border border-[#232329] bg-[#111114] overflow-hidden flex flex-col"
                >
                  <div className="aspect-[2/3] w-full bg-[#18181d] overflow-hidden">
                    <img
                      src={actor.profileUrl}
                      alt={actor.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.currentTarget;
                        if (img.dataset.fallbackApplied === 'true') return;
                        img.dataset.fallbackApplied = 'true';
                        img.src = createCastAvatarFallback(actor.name);
                      }}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="p-2.5 space-y-0.5 min-w-0">
                    <div className="text-xs font-bold text-white truncate" title={actor.name}>
                      {actor.name}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate" title={actor.character}>
                      {actor.character}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default MoviePlayerView;
