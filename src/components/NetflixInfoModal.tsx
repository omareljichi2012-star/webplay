import React, { useEffect, useState } from 'react';
import { X, Play, Plus, Check, ThumbsUp, ChevronRight } from 'lucide-react';
import {
  TmdbCatalogItem,
  TmdbEpisodeSummary,
  TmdbMediaDetails,
  fetchTmdbDetails,
  fetchTvSeasonEpisodes,
  formatReleaseNote,
  isUpcomingDate,
} from '../services/tmdb';
import { handlePosterImageError } from '../utils/posterFallback';
import { useTheme } from '../context/ThemeContext';

interface NetflixInfoModalProps {
  item: TmdbCatalogItem | null;
  onClose: () => void;
  onPlay: (item: TmdbCatalogItem, season?: number, episode?: number) => void;
  onSelectOther: (item: TmdbCatalogItem) => void;
}

function computeMatchPercent(voteAverage: number): number {
  if (!voteAverage || voteAverage <= 0) return 94;
  return Math.min(99, Math.max(76, Math.round(voteAverage * 10 + 18)));
}

function formatRuntime(minutes: number | null): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export const NetflixInfoModal: React.FC<NetflixInfoModalProps> = ({
  item,
  onClose,
  onPlay,
  onSelectOther,
}) => {
  const { isInMyList, toggleMyList, isLiked, toggleLike } = useTheme();
  const [details, setDetails] = useState<TmdbMediaDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [episodes, setEpisodes] = useState<TmdbEpisodeSummary[]>([]);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setLoading(true);
    setSelectedSeason(1);
    setEpisodes([]);
    fetchTmdbDetails(item.mediaType, item.tmdbId)
      .then((res) => {
        if (cancelled) return;
        setDetails(res);
        if (res.seasons.length > 0) {
          setSelectedSeason(res.seasons[0].seasonNumber);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    if (!item || item.mediaType !== 'tv') return;
    let cancelled = false;
    fetchTvSeasonEpisodes(item.tmdbId, selectedSeason).then((eps) => {
      if (!cancelled) setEpisodes(eps);
    });
    return () => {
      cancelled = true;
    };
  }, [item, selectedSeason]);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const active = details || item;
  const backdrop = details?.backdropUrl || details?.backdropGallery?.[0] || item.backdropUrl || item.posterUrl;
  const matchPct = computeMatchPercent(active.voteAverage);
  const saved = isInMyList(item.id);
  const liked = isLiked(item.id);
  const castNames = details?.cast?.slice(0, 4).map((c) => c.name).join(', ');
  const genreNames = (details?.genres?.map((g) => g.name) || item.genreNames || []).slice(0, 4).join(', ');
  const isTitleUpcoming = isUpcomingDate(active.releaseDate, details?.status);
  const selectedSeasonObj = details?.seasons?.find((s) => s.seasonNumber === selectedSeason);
  const isSelectedSeasonUpcoming = isUpcomingDate(selectedSeasonObj?.airDate, details?.status);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm overflow-y-auto px-3 py-6 sm:py-10 flex justify-center items-start"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} details`}
    >
      <div
        className="relative w-full max-w-4xl rounded-xl overflow-hidden bg-[#181818] text-white shadow-2xl border border-[#2d2d2d]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Hero Banner inside Modal */}
        <div className="relative aspect-[16/9] max-h-[430px] w-full bg-[#141414] overflow-hidden">
          {backdrop && (
            <img
              src={backdrop}
              alt={active.title}
              referrerPolicy="no-referrer"
              onError={(e) =>
                handlePosterImageError(
                  e,
                  active.title,
                  active.mediaType === 'tv' ? 'TV Shows' : 'Movies'
                )
              }
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/40 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#181818]/85 via-transparent to-transparent" />

          {/* Circular Close X Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-[#181818]/90 hover:bg-[#2a2a2a] text-white grid place-items-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="absolute bottom-6 left-6 right-6 sm:left-10 sm:right-10 space-y-4">
            <div className="flex items-center gap-2 text-xs font-extrabold tracking-widest uppercase">
              <span className="font-netflix-display text-lg text-[#E50914] leading-none">N</span>
              <span className="text-neutral-200">
                {item.mediaType === 'tv' ? 'Series' : 'Film'}
              </span>
              {isTitleUpcoming && (
                <span className="text-amber-300 font-bold tracking-normal">
                  · Upcoming ({formatReleaseNote(active.releaseDate)})
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight max-w-2xl">
              {active.title}
            </h2>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => onPlay(item, selectedSeason, 1)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[4px] bg-white hover:bg-neutral-200 text-black text-sm font-extrabold transition-colors cursor-pointer"
              >
                <Play size={16} fill="currentColor" />
                <span>Play</span>
              </button>

              <button
                type="button"
                onClick={() => toggleMyList(item)}
                aria-label={saved ? 'Remove from My List' : 'Add to My List'}
                title={saved ? 'Remove from My List' : 'Add to My List'}
                className="w-10 h-10 rounded-full border-2 border-neutral-400/80 hover:border-white bg-[#232323]/80 text-white grid place-items-center transition-colors cursor-pointer"
              >
                {saved ? <Check size={17} /> : <Plus size={17} />}
              </button>

              <button
                type="button"
                onClick={() => toggleLike(item.id)}
                aria-label={liked ? 'Unlike title' : 'Like title'}
                title={liked ? 'Liked' : 'I like this'}
                className={`w-10 h-10 rounded-full border-2 grid place-items-center transition-colors cursor-pointer ${
                  liked
                    ? 'border-white bg-white text-black'
                    : 'border-neutral-400/80 hover:border-white bg-[#232323]/80 text-white'
                }`}
              >
                <ThumbsUp size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Metadata Split Details */}
        <div className="p-6 sm:p-10 space-y-8">
          {isTitleUpcoming && (
            <div className="px-4 py-2.5 rounded-lg bg-amber-950/35 border border-amber-500/35 text-xs text-amber-200 leading-relaxed">
              <strong className="text-amber-300">Upcoming Title:</strong> Not out yet ({formatReleaseNote(active.releaseDate)}). Streams will activate once officially released.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5 text-sm tabular-nums">
                {isTitleUpcoming ? (
                  <span className="font-extrabold text-amber-300">Upcoming</span>
                ) : (
                  <span className="font-extrabold text-[#46d369]">{matchPct}% Match</span>
                )}
                {active.year && active.year !== 'N/A' && (
                  <span className="text-neutral-300 font-semibold">{active.year}</span>
                )}
                {item.mediaType === 'tv' && details?.numberOfSeasons ? (
                  <span className="text-neutral-300">
                    {details.numberOfSeasons} Season{details.numberOfSeasons > 1 ? 's' : ''}
                  </span>
                ) : details?.runtime ? (
                  <span className="text-neutral-300">{formatRuntime(details.runtime)}</span>
                ) : null}
                <span className="border border-neutral-600 px-1.5 py-0.5 text-[10px] font-bold text-neutral-300 rounded-[2px]">
                  {isTitleUpcoming ? 'SOON' : 'HD'}
                </span>
              </div>

              <p className="text-sm text-neutral-200 leading-relaxed">
                {loading && !details ? 'Loading overview and credits...' : active.overview}
              </p>
            </div>

            <div className="md:col-span-4 space-y-2.5 text-xs leading-relaxed">
              {castNames && (
                <div>
                  <span className="text-neutral-500">Cast: </span>
                  <span className="text-neutral-200">{castNames}</span>
                </div>
              )}
              {genreNames && (
                <div>
                  <span className="text-neutral-500">Genres: </span>
                  <span className="text-neutral-200">{genreNames}</span>
                </div>
              )}
              {details?.status && (
                <div>
                  <span className="text-neutral-500">Status: </span>
                  <span className={isTitleUpcoming ? 'text-amber-300 font-semibold' : 'text-neutral-200'}>
                    {details.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Series Episodes Picker inside Modal */}
          {item.mediaType === 'tv' && (
            <div className="space-y-4 pt-2 border-t border-[#2a2a2a]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-extrabold text-white">Episodes</h3>
                  {isSelectedSeasonUpcoming && (
                    <span className="text-xs font-bold text-amber-300">
                      Upcoming · {formatReleaseNote(selectedSeasonObj?.airDate, 'Not out yet')}
                    </span>
                  )}
                </div>
                {details?.seasons && details.seasons.length > 0 && (
                  <select
                    value={selectedSeason}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-[4px] bg-[#242424] border border-[#3d3d3d] text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    {details.seasons.map((s) => {
                      const seasonUpcoming = isUpcomingDate(s.airDate, details?.status);
                      return (
                        <option key={s.id || s.seasonNumber} value={s.seasonNumber}>
                          {s.name} ({s.episodeCount} Episodes){seasonUpcoming ? ' · Upcoming' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div className="divide-y divide-[#2b2b2b] border border-[#2b2b2b] rounded-lg overflow-hidden bg-[#141414]">
                {(episodes.length > 0
                  ? episodes.slice(0, 12)
                  : Array.from({ length: 6 }, (_, i) => ({
                      episodeNumber: i + 1,
                      name: `Episode ${i + 1}`,
                      airDate: undefined,
                    }))
                ).map((ep) => {
                  const epUpcoming =
                    isSelectedSeasonUpcoming || isUpcomingDate(ep.airDate, details?.status);
                  return (
                    <button
                      key={ep.episodeNumber}
                      type="button"
                      onClick={() => onPlay(item, selectedSeason, ep.episodeNumber)}
                      className="w-full px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-[#222222] text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-lg font-bold text-neutral-400 tabular-nums w-6 text-center shrink-0">
                          {ep.episodeNumber}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {ep.name}
                          </div>
                          <div className="text-xs text-neutral-400 flex flex-wrap items-center gap-1.5">
                            <span>Season {selectedSeason} · Episode {ep.episodeNumber}</span>
                            {epUpcoming && (
                              <span className="text-amber-300 font-semibold">
                                · Upcoming{ep.airDate ? ` (${ep.airDate})` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-neutral-200 shrink-0">
                        <Play size={14} fill="currentColor" />
                        <span>{epUpcoming ? 'Preview' : 'Play'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* More Like This Recommendations */}
          {details?.recommendations && details.recommendations.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-[#2a2a2a]">
              <h3 className="text-lg font-extrabold text-white">More Like This</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {details.recommendations.slice(0, 6).map((rec) => (
                  <button
                    key={rec.id}
                    type="button"
                    onClick={() => onSelectOther(rec)}
                    className="group rounded-md overflow-hidden bg-[#222222] hover:bg-[#2b2b2b] border border-white/5 text-left transition-colors cursor-pointer"
                  >
                    <div className="aspect-[16/9] w-full bg-[#141414] overflow-hidden relative">
                      <img
                        src={rec.backdropUrl || rec.posterUrl}
                        alt={rec.title}
                        referrerPolicy="no-referrer"
                        onError={(e) =>
                          handlePosterImageError(
                            e,
                            rec.title,
                            rec.mediaType === 'tv' ? 'TV Shows' : 'Movies'
                          )
                        }
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/75 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight size={15} />
                      </span>
                    </div>
                    <div className="p-3 space-y-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="font-bold text-[#46d369]">
                          {computeMatchPercent(rec.voteAverage)}% Match
                        </span>
                        <span className="text-neutral-400">{rec.year}</span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{rec.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetflixInfoModal;
