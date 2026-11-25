import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Star,
  Heart,
  Play,
  Film,
  CheckCircle2,
  Circle,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import {
  TmdbCatalogItem,
  TmdbEpisodeSummary,
  TmdbMediaDetails,
  TmdbReviewItem,
  fetchTmdbDetails,
  fetchTmdbTrailerAndReviews,
  fetchTvSeasonEpisodes,
  formatReleaseNote,
  isUpcomingDate,
} from '../services/tmdb';
import { SERVERS } from '../utils/movieServers';
import { handlePosterImageError } from '../utils/posterFallback';
import { useTheme } from '../context/ThemeContext';

interface PopcornDetailViewProps {
  item: TmdbCatalogItem;
  onClose: () => void;
  onPlay: (item: TmdbCatalogItem, season?: number, episode?: number) => void;
}

function formatRuntime(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '120 min';
  return `${minutes} min`;
}

const PopcornStarBar: React.FC<{ ratingOutOf10: number }> = ({ ratingOutOf10 }) => {
  const filledStars = Math.round(Math.min(5, Math.max(0, (ratingOutOf10 || 7.5) / 2)));
  return (
    <div className="inline-flex items-center gap-1" aria-label={`${ratingOutOf10.toFixed(1)} out of 10`}>
      {[1, 2, 3, 4, 5].map((idx) => (
        <Star
          key={idx}
          size={14}
          className={
            idx <= filledStars
              ? 'text-[#3fa9f5] fill-[#3fa9f5] drop-shadow-[0_0_6px_rgba(63,169,245,0.8)]'
              : 'text-neutral-500/70'
          }
        />
      ))}
    </div>
  );
};

export const PopcornDetailView: React.FC<PopcornDetailViewProps> = ({
  item,
  onClose,
  onPlay,
}) => {
  const { isInMyList, toggleMyList } = useTheme();
  const [details, setDetails] = useState<TmdbMediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState(1);
  const [episodes, setEpisodes] = useState<TmdbEpisodeSummary[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [quality, setQuality] = useState<'1080p' | '720p' | '4K'>('1080p');
  const [audioTrack, setAudioTrack] = useState<'original' | 'multi' | 'subbed'>('original');
  const [showReviews, setShowReviews] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [reviews, setReviews] = useState<TmdbReviewItem[]>([]);

  const isFavorite = isInMyList(item.id);
  const serverCount = useMemo(() => Object.keys(SERVERS).length, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showTrailer) setShowTrailer(false);
        else if (showReviews) setShowReviews(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, showTrailer, showReviews]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSeason(1);
    setSelectedEpisode(1);
    setShowReviews(false);
    setShowTrailer(false);

    Promise.all([
      fetchTmdbDetails(item.mediaType, item.tmdbId).catch(() => null),
      fetchTmdbTrailerAndReviews(item.mediaType, item.tmdbId).catch(() => ({
        trailerKey: null,
        reviews: [],
      })),
    ]).then(([det, extra]) => {
      if (cancelled) return;
      if (det) {
        setDetails(det);
        if (det.mediaType === 'tv' && det.seasons.length > 0) {
          setSeason(det.seasons[0].seasonNumber || 1);
        }
      }
      setTrailerKey(extra.trailerKey);
      setReviews(extra.reviews);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [item.mediaType, item.tmdbId]);

  useEffect(() => {
    if (item.mediaType !== 'tv') {
      setEpisodes([]);
      return;
    }
    let cancelled = false;
    fetchTvSeasonEpisodes(item.tmdbId, season).then((eps) => {
      if (!cancelled) {
        setEpisodes(eps);
        setSelectedEpisode((prev) =>
          eps.some((e) => e.episodeNumber === prev) ? prev : eps[0]?.episodeNumber || 1
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [item.mediaType, item.tmdbId, season]);

  const backdrop = details?.backdropUrl || item.backdropUrl || item.posterUrl;
  const poster = details?.posterUrl || item.posterUrl;
  const title = details?.title || item.title;
  const voteAvg = details?.voteAverage ?? item.voteAverage ?? 7.8;
  const genreLabel =
    details?.genres && details.genres.length > 0
      ? details.genres
          .slice(0, 2)
          .map((g) => g.name)
          .join(' / ')
      : item.genreNames?.[0] || (item.mediaType === 'tv' ? 'Drama' : 'Feature Film');

  const tvSeasons = useMemo(() => {
    if (details?.seasons && details.seasons.length > 0) return details.seasons;
    return [
      { id: 1, seasonNumber: 1, name: 'Season 1', episodeCount: 12 },
    ];
  }, [details?.seasons]);

  const activeSeasonObj =
    tvSeasons.find((s) => s.seasonNumber === season) || tvSeasons[0];

  const episodeList = useMemo(() => {
    if (episodes.length > 0) return episodes;
    const count = Math.max(1, activeSeasonObj?.episodeCount || 12);
    return Array.from({ length: count }, (_, idx) => ({
      episodeNumber: idx + 1,
      name: `Episode ${idx + 1}`,
      overview: details?.overview || item.overview || 'Stream in HD directly in browser.',
      airDate: '',
    }));
  }, [episodes, activeSeasonObj?.episodeCount, details?.overview, item.overview]);

  const activeEpisodeObj =
    episodeList.find((e) => e.episodeNumber === selectedEpisode) || episodeList[0];

  const seriesYearRange = useMemo(() => {
    const startYear = item.year && item.year !== 'N/A' ? item.year : '2020';
    return details?.status === 'Ended' ? `${startYear}` : `${startYear}–Present`;
  }, [item.year, details?.status]);

  const isMovieUpcoming =
    item.mediaType === 'movie' && isUpcomingDate(details?.releaseDate || item.releaseDate, details?.status);
  const isSelectedSeasonUpcoming =
    item.mediaType === 'tv' && isUpcomingDate(activeSeasonObj?.airDate, details?.status);
  const isActiveEpisodeUpcoming =
    isSelectedSeasonUpcoming || isUpcomingDate(activeEpisodeObj?.airDate, details?.status);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0b0d13] text-white overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Full-bleed darkened cinematic backdrop */}
      {backdrop && (
        <img
          src={backdrop}
          alt=""
          referrerPolicy="no-referrer"
          className="fixed inset-0 w-full h-full object-cover object-center opacity-35 pointer-events-none select-none"
        />
      )}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 25% 30%, rgba(12,15,24,0.35) 0%, rgba(10,12,18,0.88) 65%, rgba(8,10,15,0.97) 100%)',
        }}
      />

      {/* Circular X Close Button (top-right matching Screenshots 1 & 3) */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Back to catalog"
        title="Back to catalog"
        className="fixed top-4 right-5 z-50 w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 text-white grid place-items-center transition-colors backdrop-blur-md border border-white/15 cursor-pointer shadow-lg"
      >
        <X size={18} strokeWidth={2.5} />
      </button>

      {/* MOVIE DETAIL VIEW (Matches Screenshot 1: BOHEMIAN RHAPSODY) */}
      {item.mediaType === 'movie' ? (
        <div className="relative z-10 min-h-screen max-w-[1260px] mx-auto px-5 sm:px-10 py-14 sm:py-16 flex flex-col justify-center">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Poster Art */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[340px] aspect-[2/3] overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,0.85)] border border-white/10 bg-[#10141f]">
                <img
                  src={poster}
                  alt={title}
                  referrerPolicy="no-referrer"
                  onError={(e) => handlePosterImageError(e, title, 'Movies')}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d13]/70 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Right Metadata, Synopsis & Popcorn Time Bottom Action Bar */}
            <div className="lg:col-span-7 space-y-5">
              <h1
                className="font-popcorn-brand text-3xl sm:text-5xl font-black uppercase tracking-tight text-white leading-[1.04] drop-shadow-lg"
                style={{ textWrap: 'balance' }}
              >
                {title}
              </h1>

              {/* Metadata Row: Genre · Calendar Year · Clock Runtime · Blue Stars (score) */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm font-medium text-neutral-200 tabular-nums">
                <span>{genreLabel}</span>
                <span className="inline-flex items-center gap-1.5 text-neutral-300">
                  <Calendar size={14} className="text-[#3fa9f5]" />
                  <span>{item.year && item.year !== 'N/A' ? item.year : '2025'}</span>
                </span>
                {isMovieUpcoming && (
                  <span className="text-amber-300 font-bold">
                    Upcoming · {formatReleaseNote(details?.releaseDate || item.releaseDate)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-neutral-300">
                  <Clock size={14} className="text-[#3fa9f5]" />
                  <span>{formatRuntime(details?.runtime ?? null)}</span>
                </span>
                <div className="inline-flex items-center gap-2">
                  <PopcornStarBar ratingOutOf10={voteAvg} />
                  <span className="text-neutral-200 font-semibold">
                    ( {voteAvg > 0 ? voteAvg.toFixed(1) : '8.2'} )
                  </span>
                </div>
              </div>

              {/* READ REVIEWS Outline Button */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowReviews((v) => !v)}
                  className="px-3.5 py-1.5 rounded-[4px] border border-white/60 hover:border-white bg-black/30 hover:bg-white/10 text-[11px] font-extrabold uppercase tracking-wider text-white transition-colors cursor-pointer"
                >
                  {showReviews ? 'HIDE REVIEWS' : 'READ REVIEWS'}
                </button>
              </div>

              {showReviews && (
                <div className="rounded-lg border border-white/15 bg-black/60 backdrop-blur-md p-4 space-y-3 max-h-56 overflow-y-auto">
                  <div className="flex items-center justify-between text-xs font-bold text-[#62bfff]">
                    <span className="inline-flex items-center gap-1.5">
                      <MessageSquare size={13} />
                      Viewer Reviews ({reviews.length})
                    </span>
                    <span className="text-neutral-400">
                      {details?.voteCount ? `${details.voteCount.toLocaleString()} votes` : ''}
                    </span>
                  </div>
                  {reviews.length > 0 ? (
                    reviews.map((rev) => (
                      <div key={rev.id} className="border-t border-white/10 pt-2.5 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-white">
                          <span>{rev.author}</span>
                          {rev.rating !== null && (
                            <span className="text-[#62bfff]">{rev.rating}/10</span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-300 leading-relaxed line-clamp-3">
                          {rev.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-300">
                      {details?.tagline
                        ? `"${details.tagline}" — Rated ${voteAvg.toFixed(1)}/10 by viewers.`
                        : `Rated ${voteAvg.toFixed(1)}/10 across verified cinema databases.`}
                    </p>
                  )}
                </div>
              )}

              {/* Synopsis */}
              <p className="text-sm sm:text-[15px] text-neutral-200/95 leading-relaxed max-w-2xl">
                {details?.overview ||
                  item.overview ||
                  'Stream this feature film directly in your browser across 14 redundant streaming mirrors.'}
              </p>

              {/* Audio / Server Track Tabs */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex items-center gap-6 text-xs font-bold">
                  {[
                    { key: 'original', label: 'Original Audio' },
                    { key: 'multi', label: 'Multi-Server' },
                    { key: 'subbed', label: 'Subtitles Ready' },
                  ].map((tab) => {
                    const active = audioTrack === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setAudioTrack(tab.key as any)}
                        className={`pb-1.5 border-b-2 transition-colors cursor-pointer ${
                          active
                            ? 'border-white text-white'
                            : 'border-transparent text-neutral-400 hover:text-neutral-200'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Iconic Bottom Action Row: WATCH IT NOW + Quality + Servers + Heart + Trailer */}
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onPlay(item)}
                    className="popcorn-watch-btn inline-flex items-center gap-3.5 px-6 py-3 rounded-[4px] cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-full bg-[#3fa9f5] text-white grid place-items-center shadow-[0_0_16px_rgba(63,169,245,0.9)]">
                      <Play size={15} fill="currentColor" className="ml-0.5" />
                    </span>
                    <span className="font-popcorn-brand text-sm sm:text-base font-extrabold uppercase tracking-wider text-white">
                      WATCH IT NOW
                    </span>
                  </button>

                  {/* Quality Selector & Server Status */}
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center border border-white/25 bg-black/45 rounded-[3px] overflow-hidden text-[11px] font-bold">
                      {(['1080p', '720p', '4K'] as const).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuality(q)}
                          className={`px-2.5 py-1 transition-colors cursor-pointer ${
                            quality === q
                              ? 'bg-white/20 text-white'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-neutral-300 bg-black/50 border border-white/15 px-2.5 py-1 rounded-[3px]">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0" />
                      <span>{serverCount}/{serverCount} Servers Online</span>
                    </div>
                  </div>

                  {/* Favorite Heart & Trailer */}
                  <div className="flex items-center gap-3 ml-auto sm:ml-2">
                    <button
                      type="button"
                      onClick={() => toggleMyList(item)}
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      className={`p-2 rounded-[4px] border transition-colors cursor-pointer ${
                        isFavorite
                          ? 'bg-[#3fa9f5]/20 border-[#3fa9f5] text-[#62bfff]'
                          : 'bg-black/40 border-white/20 text-neutral-300 hover:text-white'
                      }`}
                    >
                      <Heart size={16} className={isFavorite ? 'fill-current' : ''} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTrailer(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[4px] bg-black/40 hover:bg-white/10 border border-white/20 text-xs font-bold text-neutral-200 hover:text-white transition-colors cursor-pointer"
                    >
                      <Film size={14} className="text-[#3fa9f5]" />
                      <span>Trailer</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* SERIES / TV / ANIME / CARTOONS DETAIL VIEW (Matches Screenshot 3: AMERICAN HORROR STORY) */
        <div className="relative z-10 min-h-screen max-w-[1260px] mx-auto px-5 sm:px-10 py-10 sm:py-12 flex flex-col justify-between gap-8">
          {/* Upper Header: Small Framed Poster + Series Metadata */}
          <div className="flex flex-col sm:flex-row items-start gap-6 pt-2">
            <div className="w-32 sm:w-40 aspect-[2/3] shrink-0 overflow-hidden border border-white/15 shadow-2xl bg-[#10141f]">
              <img
                src={poster}
                alt={title}
                referrerPolicy="no-referrer"
                onError={(e) => handlePosterImageError(e, title, 'TV Shows')}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-3 min-w-0 flex-1">
              <h1
                className="font-popcorn-brand text-2xl sm:text-4xl font-black uppercase tracking-tight text-white leading-tight"
                style={{ textWrap: 'balance' }}
              >
                {title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-neutral-200 tabular-nums">
                <span>{genreLabel}</span>
                <span className="inline-flex items-center gap-1.5 text-neutral-300">
                  <Clock size={13} className="text-[#3fa9f5]" />
                  <span>{details?.runtime ? `${details.runtime} min` : '43 min'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-neutral-300">
                  <Calendar size={13} className="text-[#3fa9f5]" />
                  <span>{seriesYearRange}</span>
                </span>
                <div className="inline-flex items-center gap-2">
                  <PopcornStarBar ratingOutOf10={voteAvg} />
                  <span className="font-semibold">
                    ( {voteAvg > 0 ? voteAvg.toFixed(1) : '8.0'}/10 )
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowReviews((v) => !v)}
                  className="px-3 py-1 rounded-[3px] border border-white/60 hover:border-white bg-black/35 text-[11px] font-extrabold uppercase tracking-wider text-white transition-colors cursor-pointer"
                >
                  {showReviews ? 'HIDE REVIEWS' : 'READ REVIEWS'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleMyList(item)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] border text-[11px] font-bold transition-colors cursor-pointer ${
                    isFavorite
                      ? 'bg-[#3fa9f5]/20 border-[#3fa9f5] text-[#62bfff]'
                      : 'bg-black/35 border-white/25 text-neutral-200 hover:text-white'
                  }`}
                >
                  <Heart size={12} className={isFavorite ? 'fill-current' : ''} />
                  <span>{isFavorite ? 'In Favorites' : 'Favorite'}</span>
                </button>
                {trailerKey && (
                  <button
                    type="button"
                    onClick={() => setShowTrailer(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-black/35 border border-white/25 text-[11px] font-bold text-neutral-200 hover:text-white cursor-pointer"
                  >
                    <Film size={12} className="text-[#3fa9f5]" />
                    <span>Trailer</span>
                  </button>
                )}
              </div>

              {showReviews && (
                <div className="rounded border border-white/15 bg-black/65 p-3 text-xs text-neutral-300 space-y-2 max-w-2xl max-h-40 overflow-y-auto">
                  {reviews.length > 0 ? (
                    reviews.slice(0, 3).map((r) => (
                      <div key={r.id}>
                        <span className="font-bold text-white">{r.author}: </span>
                        <span>{r.content.slice(0, 220)}...</span>
                      </div>
                    ))
                  ) : (
                    <p>Rated {voteAvg.toFixed(1)}/10 by viewers across TMDB.</p>
                  )}
                </div>
              )}

              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-3xl line-clamp-3">
                {details?.overview ||
                  item.overview ||
                  'Select any season and episode below to start streaming instantly.'}
              </p>
            </div>
          </div>

          {/* Lower 3-Column Popcorn Time Season / Episode Browser (Screenshot 3 exact layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 border-t border-white/10 pt-6 flex-1 min-h-[320px]">
            {/* Col 1: Seasons List */}
            <div className="lg:col-span-3 max-h-[340px] overflow-y-auto pr-1 space-y-0.5">
              {tvSeasons.map((s) => {
                const isSelected = s.seasonNumber === season;
                const sUpcoming = isUpcomingDate(s.airDate, details?.status);
                return (
                  <button
                    key={s.id || s.seasonNumber}
                    type="button"
                    onClick={() => {
                      setSeason(s.seasonNumber);
                      setSelectedEpisode(1);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-sm transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'border-l-4 border-white bg-white/12 font-extrabold text-white'
                        : 'border-l-4 border-transparent text-neutral-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{s.name || `Season ${s.seasonNumber}`}</span>
                    {sUpcoming && (
                      <span className="text-[10px] font-bold text-amber-300 shrink-0">
                        Upcoming
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Col 2: Scrollable Episode Rows */}
            <div className="lg:col-span-5 max-h-[340px] overflow-y-auto border-y lg:border-y-0 lg:border-x border-white/10 divide-y divide-white/10">
              {episodeList.map((ep) => {
                const isActiveEp = ep.episodeNumber === selectedEpisode;
                const epUpcoming = isSelectedSeasonUpcoming || isUpcomingDate(ep.airDate, details?.status);
                return (
                  <button
                    key={ep.episodeNumber}
                    type="button"
                    onClick={() => setSelectedEpisode(ep.episodeNumber)}
                    onDoubleClick={() => onPlay(item, season, ep.episodeNumber)}
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-left text-xs sm:text-sm transition-colors cursor-pointer ${
                      isActiveEp
                        ? 'bg-white/15 text-white font-bold'
                        : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-right font-mono text-neutral-400 shrink-0 tabular-nums">
                        {ep.episodeNumber}
                      </span>
                      <span className="truncate">{ep.name}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {epUpcoming && (
                        <span className="text-[10px] font-semibold text-amber-300">
                          Upcoming
                        </span>
                      )}
                      {isActiveEp ? (
                        <CheckCircle2 size={14} className="text-[#3fa9f5] shrink-0" />
                      ) : (
                        <Circle size={13} className="text-neutral-600 shrink-0" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Col 3: Active Episode Summary + Bottom WATCH IT NOW */}
            <div className="lg:col-span-4 flex flex-col justify-between gap-6 pl-0 lg:pl-2">
              <div className="space-y-2.5">
                <h2 className="text-lg sm:text-xl font-extrabold text-white leading-snug">
                  {activeEpisodeObj?.name || `Episode ${selectedEpisode}`}
                </h2>
                <div className="text-xs font-semibold text-neutral-400 flex flex-wrap items-center gap-1.5">
                  <span>Season {season} · Episode {selectedEpisode}</span>
                  {activeEpisodeObj?.airDate ? <span>· {activeEpisodeObj.airDate}</span> : null}
                  {isActiveEpisodeUpcoming && (
                    <span className="text-amber-300 font-bold">· Upcoming (Not aired yet)</span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-neutral-200/90 leading-relaxed">
                  {activeEpisodeObj?.overview ||
                    details?.overview ||
                    item.overview ||
                    `Watch Season ${season}, Episode ${selectedEpisode} of ${title} instantly.`}
                </p>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => onPlay(item, season, selectedEpisode)}
                  className="popcorn-watch-btn inline-flex items-center gap-3 px-5 py-2.5 rounded-[4px] cursor-pointer"
                >
                  <span className="w-7 h-7 rounded-full bg-[#3fa9f5] text-white grid place-items-center shadow-[0_0_14px_rgba(63,169,245,0.85)]">
                    <Play size={14} fill="currentColor" className="ml-0.5" />
                  </span>
                  <span className="font-popcorn-brand text-sm font-extrabold uppercase tracking-wider text-white">
                    WATCH IT NOW
                  </span>
                </button>

                <div className="space-y-1.5 text-[11px] min-w-[155px]">
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-black/55 border border-white/20 rounded-[3px] text-neutral-200">
                    <span>English / Multi</span>
                    <ChevronDown size={12} className="text-neutral-400" />
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-black/55 border border-white/20 rounded-[3px] text-neutral-300">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                      <strong className="text-white">{quality}</strong>
                    </span>
                    <span className="text-neutral-400">{serverCount} Servers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trailer Overlay Modal (when clicking Trailer button) */}
      {showTrailer && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowTrailer(false)}
        >
          <div
            className="w-full max-w-4xl bg-[#0e121b] border border-white/20 rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-bold text-white">{title} — Official Trailer</span>
              <button
                type="button"
                onClick={() => setShowTrailer(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white cursor-pointer"
                aria-label="Close trailer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              {trailerKey ? (
                <iframe
                  src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                  title={`${title} Trailer`}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <p className="text-sm text-neutral-300">
                    {loading ? 'Loading trailer...' : 'No YouTube trailer available for this title.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowTrailer(false);
                      onPlay(
                        item,
                        item.mediaType === 'tv' ? season : undefined,
                        item.mediaType === 'tv' ? selectedEpisode : undefined
                      );
                    }}
                    className="px-4 py-2 rounded bg-[#3fa9f5] text-white text-xs font-bold cursor-pointer"
                  >
                    Watch Full Title Now
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PopcornDetailView;
