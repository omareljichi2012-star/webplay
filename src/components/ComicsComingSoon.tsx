import React from 'react';
import { BookOpen, Clock, Layers, ShieldCheck, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ComicsComingSoonProps {
  onExploreTab: (tab: 'anime' | 'cartoons' | 'movies') => void;
}

export const ComicsComingSoon: React.FC<ComicsComingSoonProps> = ({ onExploreTab }) => {
  const { isNetflix, isPopcorn } = useTheme();

  return (
    <section
      className={`rounded-2xl border p-6 sm:p-10 md:p-14 transition-colors ${
        isNetflix
          ? 'bg-[#181818] border-[#2a2a2a]'
          : isPopcorn
          ? 'bg-[#121620] border-[#252e42]'
          : 'bg-[#111115] border-[#232329]'
      }`}
    >
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-2.5 text-xs font-bold tracking-widest uppercase">
          <Clock
            size={14}
            className={isNetflix ? 'text-[#E50914]' : isPopcorn ? 'text-[#3fa9f5]' : 'text-[#22c55e]'}
          />
          <span
            className={isNetflix ? 'text-[#E50914]' : isPopcorn ? 'text-[#3fa9f5]' : 'text-[#22c55e]'}
          >
            Coming Soon
          </span>
          <span className="text-neutral-600" aria-hidden="true">·</span>
          <span className="text-neutral-400">Comics Archive &amp; Reader</span>
        </div>

        <h2
          className={`text-3xl sm:text-5xl font-black tracking-tight text-white leading-[1.06] ${
            isNetflix
              ? 'font-netflix-display tracking-wide text-4xl sm:text-6xl'
              : isPopcorn
              ? 'font-popcorn-brand uppercase'
              : ''
          }`}
          style={{ textWrap: 'balance' }}
        >
          Comics Vault is coming soon to {isNetflix ? 'Streamflix' : isPopcorn ? 'WebPlay Time' : 'Stream X'}.
        </h2>

        <p className="text-sm sm:text-base text-neutral-300 leading-relaxed max-w-2xl">
          We are building a distraction-free, high-resolution digital comic reader with synchronized issue tracking across DC, Marvel, indie graphic novels, and manga volumes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div
            className={`rounded-xl border p-4 space-y-1.5 ${
              isNetflix
                ? 'bg-[#141414] border-[#282828]'
                : isPopcorn
                ? 'bg-[#0c0e14] border-[#252e42]'
                : 'bg-[#16161b] border-[#27272e]'
            }`}
          >
            <BookOpen size={18} className={isNetflix ? 'text-[#E50914]' : isPopcorn ? 'text-[#3fa9f5]' : 'text-white'} />
            <h3 className="text-sm font-bold text-white">Panel &amp; Page Reader</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Full-bleed vertical scroll and double-page spread support for CBZ and CBR archives.
            </p>
          </div>

          <div
            className={`rounded-xl border p-4 space-y-1.5 ${
              isNetflix
                ? 'bg-[#141414] border-[#282828]'
                : isPopcorn
                ? 'bg-[#0c0e14] border-[#252e42]'
                : 'bg-[#16161b] border-[#27272e]'
            }`}
          >
            <Layers size={18} className={isNetflix ? 'text-[#E50914]' : isPopcorn ? 'text-[#3fa9f5]' : 'text-white'} />
            <h3 className="text-sm font-bold text-white">Series Continuity</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Browse complete story arcs, reading orders, and issue-by-issue release timelines.
            </p>
          </div>

          <div
            className={`rounded-xl border p-4 space-y-1.5 ${
              isNetflix
                ? 'bg-[#141414] border-[#282828]'
                : isPopcorn
                ? 'bg-[#0c0e14] border-[#252e42]'
                : 'bg-[#16161b] border-[#27272e]'
            }`}
          >
            <ShieldCheck size={18} className={isNetflix ? 'text-[#E50914]' : isPopcorn ? 'text-[#3fa9f5]' : 'text-white'} />
            <h3 className="text-sm font-bold text-white">Saved Reading Progress</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Pick up every issue right where you left off with synced watchlist support.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onExploreTab('anime')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isNetflix
                ? 'bg-[#E50914] hover:bg-[#f40612] text-white'
                : isPopcorn
                ? 'bg-[#3fa9f5] hover:bg-[#5ebaff] text-white'
                : 'bg-white hover:bg-neutral-200 text-black'
            }`}
          >
            <span>Browse Anime</span>
            <ArrowRight size={15} />
          </button>

          <button
            type="button"
            onClick={() => onExploreTab('cartoons')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isNetflix
                ? 'bg-[#262626] hover:bg-[#333333] border-[#3a3a3a] text-white'
                : isPopcorn
                ? 'bg-[#1a2130] hover:bg-[#232d42] border-[#2f3b54] text-neutral-100'
                : 'bg-[#18181d] hover:bg-[#23232a] border-[#2c2c34] text-neutral-100'
            }`}
          >
            <span>Browse Cartoons</span>
          </button>

          <button
            type="button"
            onClick={() => onExploreTab('movies')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isNetflix
                ? 'bg-[#262626] hover:bg-[#333333] border-[#3a3a3a] text-white'
                : isPopcorn
                ? 'bg-[#1a2130] hover:bg-[#232d42] border-[#2f3b54] text-neutral-100'
                : 'bg-[#18181d] hover:bg-[#23232a] border-[#2c2c34] text-neutral-100'
            }`}
          >
            <span>Browse Movies</span>
          </button>
        </div>
      </div>
    </section>
  );
};

export default ComicsComingSoon;
