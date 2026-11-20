import React from 'react';
import type { ServerFlagCode } from '../utils/movieServers';

export interface ServerGridOption {
  key: string;
  label: string;
  shortLabel: string;
  flag: ServerFlagCode;
  featured?: boolean;
}

interface ServerSwitcherGridProps {
  servers: ServerGridOption[];
  activeKey: string;
  onSelect: (key: string) => void;
}

const CountryFlagIcon: React.FC<{ code: ServerFlagCode }> = ({ code }) => {
  switch (code) {
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
}) => {
  return (
    <div className="p-4 sm:p-5 bg-[#09090b] space-y-3.5">
      <p className="text-xs sm:text-[13px] text-neutral-300/90 leading-relaxed flex items-center gap-1.5 flex-wrap">
        <span aria-hidden="true">🚀</span>
        <span>
          Please try different servers if one isn&apos;t working, and consider using ad blockers or the Brave browser
        </span>
        <span aria-hidden="true">😊</span>
        <span>.</span>
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {servers.map((srv) => {
          const isSelected = activeKey === srv.key;
          return (
            <button
              key={srv.key}
              type="button"
              data-server-key={srv.key}
              aria-pressed={isSelected}
              title={srv.label}
              onClick={() => onSelect(srv.key)}
              className={`relative flex items-center justify-center gap-2 px-3 py-3 rounded-xl border transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-[#5a5a5f]/90 border-[#a1a1aa]/80 text-white shadow-md ring-1 ring-white/25'
                  : 'bg-[#18181b] hover:bg-[#232329] border-[#27272c] hover:border-[#3f3f46] text-neutral-100'
              }`}
            >
              {srv.featured && <FeaturedSparklesIcon />}
              <CountryFlagIcon code={srv.flag} />
              <span className="text-xs sm:text-[13px] font-bold tracking-tight lowercase leading-none truncate">
                {srv.shortLabel}
              </span>
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full bg-[#22c55e] shrink-0 shadow-[0_0_6px_rgba(34,197,94,0.7)]"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ServerSwitcherGrid;
