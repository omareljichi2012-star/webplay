import React, { useState, useEffect, useMemo } from 'react';
import { Play, ChevronLeft, ChevronRight, RefreshCw, Info, Gamepad2 } from 'lucide-react';
import { GameItem } from '../types';
import { SafeGameImage } from './SafeGameImage';
import { useTheme } from '../context/ThemeContext';

interface FeaturedHeroBannerProps {
  games: GameItem[];
  onLaunchGame: (game: GameItem) => void;
  onInspect3D?: (game: GameItem) => void;
}

export const FeaturedHeroBanner: React.FC<FeaturedHeroBannerProps> = ({
  games,
  onLaunchGame,
  onInspect3D,
}) => {
  const { isNetflix } = useTheme();

  const webPortGames = useMemo(() => {
    if (!games || games.length === 0) return [];
    const filtered = games.filter(
      (g) =>
        g.consoleType === 'WebPort' ||
        g.engine === 'web' ||
        (g.id && g.id.includes('webport'))
    );
    return filtered.length > 0 ? filtered : games;
  }, [games]);

  const [featuredIndex, setFeaturedIndex] = useState<number>(0);

  useEffect(() => {
    if (!webPortGames || webPortGames.length === 0) return;
    const preferredIndex = webPortGames.findIndex(
      (g) =>
        g.title.toLowerCase().includes('grand theft auto v') ||
        g.title.toLowerCase().includes('gta v')
    );
    setFeaturedIndex(preferredIndex !== -1 ? preferredIndex : 0);
  }, [webPortGames]);

  const featuredGame = useMemo(() => {
    if (!webPortGames || webPortGames.length === 0) return null;
    return webPortGames[featuredIndex % webPortGames.length] || webPortGames[0];
  }, [webPortGames, featuredIndex]);

  const handleNext = () => {
    if (!webPortGames || webPortGames.length === 0) return;
    setFeaturedIndex((prev) => (prev + 1) % webPortGames.length);
  };

  const handlePrev = () => {
    if (!webPortGames || webPortGames.length === 0) return;
    setFeaturedIndex((prev) => (prev - 1 + webPortGames.length) % webPortGames.length);
  };

  const handleRandomShuffle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!webPortGames || webPortGames.length === 0) return;
    setFeaturedIndex(Math.floor(Math.random() * webPortGames.length));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [webPortGames]);

  if (!featuredGame) return null;

  return (
    <section
      className={`relative my-4 overflow-hidden border transition-colors ${
        isNetflix
          ? 'rounded-lg bg-[#141414] border-[#262626] min-h-[340px] sm:min-h-[420px] flex items-end shadow-2xl'
          : 'rounded-2xl bg-[#121216] border-[#232329] min-h-[340px] sm:min-h-[400px] flex items-end shadow-2xl'
      }`}
    >
      {/* Full-bleed background game artwork */}
      <div className="absolute inset-0">
        <SafeGameImage
          primaryUrl={featuredGame.poster || featuredGame.coverUrl}
          fallbackUrl={featuredGame.boxFront}
          title={featuredGame.title}
          consoleType={featuredGame.consoleType}
          alt={featuredGame.title}
          className="h-full w-full object-cover object-center opacity-55"
        />
      </div>

      {/* Multi-stop gradient scrims matching Movies & TV Shows */}
      <div
        className={`absolute inset-0 ${
          isNetflix
            ? 'bg-gradient-to-r from-[#141414] via-[#141414]/80 to-transparent'
            : 'bg-gradient-to-r from-[#08080a] via-[#08080a]/75 to-transparent'
        }`}
      />
      <div
        className={`absolute inset-0 ${
          isNetflix
            ? 'bg-gradient-to-t from-[#141414] via-transparent to-black/35'
            : 'bg-gradient-to-t from-[#08080a] via-transparent to-black/30'
        }`}
      />

      {/* Top-right slide switcher */}
      <div className="absolute top-4 right-5 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-white/15 rounded-lg p-1">
        <button
          type="button"
          onClick={handlePrev}
          className="p-1.5 rounded-md text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Previous Featured Game"
          aria-label="Previous Featured Game"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-[11px] font-mono font-bold text-neutral-300 px-1 tabular-nums">
          {featuredIndex + 1} / {webPortGames.length}
        </span>
        <button
          type="button"
          onClick={handleNext}
          className="p-1.5 rounded-md text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Next Featured Game"
          aria-label="Next Featured Game"
        >
          <ChevronRight size={15} />
        </button>
        <div className="h-3.5 w-px bg-white/15 mx-0.5" />
        <button
          type="button"
          onClick={handleRandomShuffle}
          className="p-1.5 rounded-md text-neutral-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Shuffle Featured Game"
          aria-label="Shuffle Featured Game"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Left Foreground Content */}
      <div className="relative z-10 p-6 sm:p-10 max-w-2xl space-y-3.5">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-300 tabular-nums">
          {isNetflix ? (
            <>
              <span className="font-netflix-display text-lg text-[#E50914] leading-none">
                N
              </span>
              <span className="uppercase tracking-widest text-white/90">
                Games Spotlight
              </span>
            </>
          ) : (
            <span className="uppercase tracking-widest text-white/80 inline-flex items-center gap-1.5">
              <Gamepad2 size={14} className="text-[#22c55e]" />
              Featured Arcade
            </span>
          )}
          <span className="text-neutral-500" aria-hidden="true">·</span>
          <span>{featuredGame.consoleType || 'WebPort'}</span>
          {featuredGame.year && (
            <>
              <span className="text-neutral-500" aria-hidden="true">·</span>
              <span>{featuredGame.year}</span>
            </>
          )}
          {featuredGame.rating > 0 && (
            <>
              <span className="text-neutral-500" aria-hidden="true">·</span>
              <span className="text-[#46d369] font-extrabold">
                {isNetflix
                  ? `${Math.min(99, Math.round(featuredGame.rating * 10))}% Match`
                  : `${Number(featuredGame.rating).toFixed(1)} / 10`}
              </span>
            </>
          )}
        </div>

        <h2
          className={`text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.03] drop-shadow-lg ${
            isNetflix ? '' : 'uppercase'
          }`}
          style={{ textWrap: 'balance' }}
        >
          {featuredGame.title}
        </h2>

        <p className="text-xs sm:text-sm text-neutral-200/90 leading-relaxed line-clamp-2 max-w-xl">
          {featuredGame.synopsis ||
            featuredGame.description ||
            `Instant browser WebAssembly playback across ${webPortGames.length} classic and ported games with zero downloads.`}
        </p>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onLaunchGame(featuredGame)}
            className={`inline-flex items-center gap-2 px-6 py-2.5 text-xs sm:text-sm font-extrabold transition-colors shadow-lg cursor-pointer whitespace-nowrap shrink-0 ${
              isNetflix
                ? 'rounded-[4px] bg-white hover:bg-neutral-200 text-black'
                : 'rounded-lg bg-white hover:bg-neutral-200 text-black'
            }`}
          >
            <Play size={15} fill="currentColor" />
            <span>Play</span>
          </button>

          {onInspect3D && (
            <button
              type="button"
              onClick={() => onInspect3D(featuredGame)}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isNetflix
                  ? 'rounded-[4px] bg-[#6d6d6e]/75 hover:bg-[#6d6d6e]/55 text-white'
                  : 'rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white backdrop-blur-sm'
              }`}
            >
              <Info size={15} />
              <span>3D Box Info</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturedHeroBanner;
