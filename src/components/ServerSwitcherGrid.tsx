import React from 'react';
import type { ServerFlagCode } from '../utils/movieServers';
import { useTheme } from '../context/ThemeContext';

export interface ServerGridOption {
  key: string;
  label: string;
  shortLabel: string;
  flag: ServerFlagCode;
  featured?: boolean;
  group?: 'vidsrc' | 'custom' | 'anime' | 'language';
  trackLabel?: 'SUB' | 'DUB';
}

interface ServerSwitcherGridProps {
  servers: ServerGridOption[];
  activeKey: string;
  onSelect: (key: string) => void;
  showAnimeServers?: boolean;
  anilistId?: number | null;
}

const CountryFlagIcon: React.FC<{ code: ServerFlagCode }> = ({ code }) => {
  switch (code) {
    case 'jp':
      return (
        <svg viewBox="0 0 24 16" className="w-[18px] h-[12px] rounded-[2px] shrink-0 shadow-sm border border-black/15" aria-hidden="true">
          <rect width="24" height="16" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="4.5" fill="#BC002D" />
        </svg>
      );
    case 'gb':
      return (
        <svg viewBox="0 0 24 16" className="w-[18px] h-[12px] rounded-[2px] shrink-0 shadow-sm" aria-hidden="true">
          <rect width="24" height="16" fill="#012169" />
          <path d="M0 0 L24 16 M24 0 L0 16" stroke="#FFFFFF" strokeWidth="3" />
          <path d="M0 0 L24 16 M24 0 L0 16" stroke="#C8102E" strokeWidth="1.4" />
          <path d="M12 0 V16 M0 8 H24" stroke="#FFFFFF" strokeWidth="5" />
          <path d="M12 0 V16 M0 8 H24" stroke="#C8102E" strokeWidth="3" />
        </svg>
      );
    case 'fr':
      return (
        <svg viewBox="0 0 24 16" className="w-[18px] h-[12px] rounded-[2px] shrink-0 shadow-sm" aria-hidden="true">
          <rect width="8" height="16" x="0" fill="#0055A4" />
          <rect width="8" height="16" x="8" fill="#FFFFFF" />
          <rect width="8" height="16" x="16" fill="#EF4135" />
        </svg>
      );
    case 'es':
      return (
        <svg viewBox="0 0 24 16" className="w-[18px] h-[12px] rounded-[2px] shrink-0 shadow-sm" aria-hidden="true">
          <rect width="24" height="16" fill="#AA151B" />
          <rect width="24" height="8" y="4" fill="#F1BF00" />
        </svg>
      );
    case 'it':
      return (
        <svg viewBox="0 0 24 16" className="w-[18px] h-[12px] rounded-[2px] shrink-0 shadow-sm" aria-hidden="true">
          <rect width="8" height="16" x="0" fill="#009246" />
          <rect width="8" height="16" x="8" fill="#FFFFFF" />
          <rect width="8" height="16" x="16" fill="#CE2B37" />
        </svg>
      );
    case 'us':
    default:
      return (
        <svg viewBox="0 0 24 16" className="w-[18px] h-[12px] rounded-[2px] shrink-0 shadow-sm" aria-hidden="true">
          <rect width="24" height="16" fill="#FFFFFF" />
          <rect width="24" height="2" y="0" fill="#B22234" />
          <rect width="24" height="2" y="4" fill="#B22234" />
          <rect width="24" height="2" y="8" fill="#B22234" />
          <rect width="24" height="2" y="12" fill="#B22234" />
          <rect width="11" height="9" fill="#3C3B6E" />
          <circle cx="3" cy="2.5" r="0.6" fill="#FFFFFF" />
          <circle cx="6" cy="2.5" r="0.6" fill="#FFFFFF" />
          <circle cx="9" cy="2.5" r="0.6" fill="#FFFFFF" />
          <circle cx="4.5" cy="4.5" r="0.6" fill="#FFFFFF" />
          <circle cx="7.5" cy="4.5" r="0.6" fill="#FFFFFF" />
          <circle cx="3" cy="6.5" r="0.6" fill="#FFFFFF" />
          <circle cx="6" cy="6.5" r="0.6" fill="#FFFFFF" />
          <circle cx="9" cy="6.5" r="0.6" fill="#FFFFFF" />
        </svg>
      );
  }
};

const FeaturedSparklesIcon: React.FC = () => (
  <svg
    viewBox="0 0 16 16"
    className="w-3 h-3 text-[#f87171] absolute top-1.5 left-1.5 pointer-events-none"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M5.5 1 L6.3 3.7 L9 4.5 L6.3 5.3 L5.5 8 L4.7 5.3 L2 4.5 L4.7 3.7 Z" />
    <path d="M11.5 8.5 L12 10 L13.5 10.5 L12 11 L11.5 12.5 L11 11 L9.5 10.5 L11 10 Z" />
  </svg>
);

export const ServerSwitcherGrid: React.FC<ServerSwitcherGridProps> = ({
  servers,
  activeKey,
  onSelect,
  showAnimeServers = false,
  anilistId = null,
}) => {
  const { isNetflix, isPopcorn, isGamOnl, isKaleidescape } = useTheme();

  const standardServers = servers.filter((s) => s.group !== 'anime');
  const animeServers = servers.filter((s) => s.group === 'anime');

  const renderServerButton = (srv: ServerGridOption) => {
    const isSelected = activeKey === srv.key;
    return (
      <button
        key={srv.key}
        type="button"
        data-server-key={srv.key}
        aria-pressed={isSelected}
        title={srv.label}
        onClick={() => onSelect(srv.key)}
        className={`relative flex items-center justify-center gap-2 px-3 py-3 border transition-all cursor-pointer select-none ${
          isNetflix ? 'rounded-md' : isPopcorn ? 'rounded-md' : 'rounded-xl'
        } ${
          isSelected
            ? isNetflix
              ? 'bg-[#E50914] border-[#ff3d47] text-white shadow-md'
              : isPopcorn
              ? 'bg-[#1a3352] border-[#3fa9f5] text-white shadow-[0_0_16px_rgba(63,169,245,0.3)]'
              : isGamOnl
              ? 'bg-[#22c55e]/20 border-[#22c55e] text-white shadow-[0_0_14px_rgba(34,197,94,0.25)]'
              : isKaleidescape
              ? 'bg-[#275e91] border-[#f2c94c] text-white shadow-[0_0_16px_rgba(242,201,76,0.28)]'
              : 'bg-[#5a5a5f]/90 border-[#a1a1aa]/80 text-white shadow-md ring-1 ring-white/25'
            : isNetflix
            ? 'bg-[#1f1f1f] hover:bg-[#2b2b2b] border-[#2e2e2e] hover:border-[#444] text-neutral-100'
            : isPopcorn
            ? 'bg-[#121620] hover:bg-[#192030] border-[#232c40] hover:border-[#3fa9f5]/50 text-neutral-100'
            : isGamOnl
            ? 'bg-[#13161f] hover:bg-[#1a2030] border-[#252b3b] hover:border-[#22c55e]/50 text-neutral-100'
            : isKaleidescape
            ? 'bg-[#08101c] hover:bg-[#101e33] border-[#19304d] hover:border-[#f2c94c]/60 text-neutral-100'
            : 'bg-[#18181b] hover:bg-[#232329] border-[#27272c] hover:border-[#3f3f46] text-neutral-100'
        }`}
      >
        {srv.featured && <FeaturedSparklesIcon />}
        <CountryFlagIcon code={srv.flag} />
        <span className="text-xs sm:text-[13px] font-bold tracking-tight lowercase leading-none truncate">
          {srv.shortLabel}
        </span>
        {srv.trackLabel && (
          <span
            className={`text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
              srv.trackLabel === 'DUB'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-400/35'
                : 'bg-violet-500/20 text-violet-300 border border-violet-400/35'
            }`}
          >
            {srv.trackLabel}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className={`p-4 sm:p-5 space-y-4 ${
        isNetflix
          ? 'bg-[#141414]'
          : isPopcorn
          ? 'bg-[#0c0e14]'
          : isGamOnl
          ? 'bg-[#0d0f14]'
          : isKaleidescape
          ? 'bg-[#000000]'
          : 'bg-[#09090b]'
      }`}
    >
      <p className="text-xs sm:text-[13px] text-neutral-300/90 leading-relaxed flex items-center gap-1.5 flex-wrap">
        <span>
          Try switching servers if a mirror is busy. Ad blockers or Brave browser are recommended for external streams.
        </span>
      </p>

      {/* Dedicated Anime Only Sub & Dub Servers (Visible on Anime titles) */}
      {showAnimeServers && animeServers.length > 0 && (
        <div className="space-y-2 pb-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-extrabold uppercase tracking-wider text-violet-300">
              Anime Servers (Sub &amp; Dub)
            </span>
            {anilistId && (
              <span className="font-mono text-[11px] text-neutral-400">
                AniList #{anilistId}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {animeServers.map(renderServerButton)}
          </div>
        </div>
      )}

      {/* Standard All-Media Mirrors (Movies, TV, Cartoons & Anime) */}
      <div className="space-y-2">
        {showAnimeServers && animeServers.length > 0 && (
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            Universal Mirrors (Movies, TV, Cartoons &amp; Anime)
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {standardServers.map(renderServerButton)}
        </div>
      </div>
    </div>
  );
};

export default ServerSwitcherGrid;
