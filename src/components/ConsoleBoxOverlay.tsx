import React from 'react';
import type { PosterLabelMode } from '../context/ThemeContext';

interface ConsoleBoxOverlayProps {
  consoleType?: string | null;
  mode: PosterLabelMode;
  compact?: boolean;
}

const PsPrismMark: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    {/* Authentic 4-color PlayStation geometric P + S prism */}
    <path d="M13 4v23.5l4.2 1.4V9.8c0-1.3.5-1.9 1.4-1.6 1 .3 1.3 1.1 1.3 2.4v7.1c2.9 1.4 5.1 0 5.1-3.9 0-4-1.4-5.7-5.6-7.2L13 4z" fill="#DF0024" />
    <path d="M13 19.6l-7.8 2.8c-2 .7-2.4 2-.9 2.7 1.5.7 3.7.4 5.7-.3l3-1.1v-4.1z" fill="#00AB9F" />
    <path d="M17.2 21.8l6.8-2.4c2.1-.7 3.8-.3 4.3 1 .5 1.3-.8 2.4-3.1 3.2l-8 2.8v-4.6z" fill="#2E6DB4" />
    <path d="M9.8 22.8l3.2-1.1v3.1l-3.2 1.1c-1.7.6-3.2.5-3.9-.2-.6-.6-.2-1.9 3.9-2.9z" fill="#F3C300" />
  </svg>
);

const DsDualScreenMark: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <rect x="4" y="3" width="10" height="8" rx="1.2" />
    <rect x="10" y="13" width="10" height="8" rx="1.2" />
  </svg>
);

interface ConsoleVisualSpec {
  id: string;
  shortLabel: string;
  fullLabel: string;
  layout: 'spine-left' | 'header-top';
  bgClass: string;
  accentHex: string;
  textHex: string;
  isPs1?: boolean;
  isNds?: boolean;
  isN64?: boolean;
  isSnes?: boolean;
}

function getConsoleVisualSpec(rawType?: string | null): ConsoleVisualSpec {
  const c = (rawType || 'RETRO').toUpperCase().trim();

  if (c === 'PS1' || c === 'PSX' || c === 'PLAYSTATION') {
    return {
      id: 'ps1',
      shortLabel: 'PS1',
      fullLabel: 'PlayStation',
      layout: 'spine-left',
      bgClass: 'bg-[#060609]',
      accentHex: '#2E6DB4',
      textHex: '#FFFFFF',
      isPs1: true,
    };
  }
  if (c === 'PSP' || c === 'PLAYSTATION PORTABLE') {
    return {
      id: 'psp',
      shortLabel: 'PSP',
      fullLabel: 'PlayStation Portable',
      layout: 'header-top',
      bgClass: 'bg-gradient-to-r from-[#09090d] via-[#13141c] to-[#09090d]',
      accentHex: '#E5E7EB',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'NDS' || c === 'NINTENDO DS') {
    return {
      id: 'nds',
      shortLabel: 'NDS',
      fullLabel: 'NINTENDO DS',
      layout: 'spine-left',
      bgClass: 'bg-[#f4f4f7]',
      accentHex: '#18181b',
      textHex: '#111115',
      isNds: true,
    };
  }
  if (c === 'GBA') {
    return {
      id: 'gba',
      shortLabel: 'GBA',
      fullLabel: 'GAME BOY ADVANCE',
      layout: 'spine-left',
      bgClass: 'bg-gradient-to-b from-[#312e81] via-[#3730a3] to-[#1e1b4b]',
      accentHex: '#a5b4fc',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'GAME BOY COLOR' || c === 'GBC') {
    return {
      id: 'gbc',
      shortLabel: 'GBC',
      fullLabel: 'GAME BOY COLOR',
      layout: 'header-top',
      bgClass: 'bg-gradient-to-r from-[#581c87] via-[#0f766e] to-[#1e3a8a]',
      accentHex: '#facc15',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'GAME BOY' || c === 'GB') {
    return {
      id: 'gb',
      shortLabel: 'GB',
      fullLabel: 'GAME BOY',
      layout: 'header-top',
      bgClass: 'bg-[#27272e]',
      accentHex: '#be185d',
      textHex: '#F4F4F5',
    };
  }
  if (c === 'SNES' || c === 'SUPER NINTENDO') {
    return {
      id: 'snes',
      shortLabel: 'SNES',
      fullLabel: 'SUPER NINTENDO',
      layout: 'header-top',
      bgClass: 'bg-[#101014]',
      accentHex: '#dc2626',
      textHex: '#FFFFFF',
      isSnes: true,
    };
  }
  if (c === 'NES') {
    return {
      id: 'nes',
      shortLabel: 'NES',
      fullLabel: 'ENTERTAINMENT SYSTEM',
      layout: 'header-top',
      bgClass: 'bg-[#0b0b0e]',
      accentHex: '#e60012',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'N64' || c === 'NINTENDO 64') {
    return {
      id: 'n64',
      shortLabel: 'N64',
      fullLabel: 'NINTENDO 64',
      layout: 'header-top',
      bgClass: 'bg-[#09090d]',
      accentHex: '#009e49',
      textHex: '#FFFFFF',
      isN64: true,
    };
  }
  if (c === 'GENESIS' || c === 'SEGA GENESIS' || c === 'MEGADRIVE') {
    return {
      id: 'genesis',
      shortLabel: 'GENESIS',
      fullLabel: 'GENESIS',
      layout: 'spine-left',
      bgClass: 'bg-[#0b0b0f]',
      accentHex: '#dc2626',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'SEGA CD' || c === 'SEGACD') {
    return {
      id: 'segacd',
      shortLabel: 'SEGA CD',
      fullLabel: 'SEGA CD',
      layout: 'spine-left',
      bgClass: 'bg-[#090d1a]',
      accentHex: '#2563eb',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'SEGA 32X' || c === 'SEGA32X') {
    return {
      id: 'sega32x',
      shortLabel: '32X',
      fullLabel: 'SEGA 32X',
      layout: 'header-top',
      bgClass: 'bg-[#111116]',
      accentHex: '#eab308',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'MASTER SYSTEM' || c === 'MASTERSYSTEM') {
    return {
      id: 'sms',
      shortLabel: 'SMS',
      fullLabel: 'MASTER SYSTEM',
      layout: 'header-top',
      bgClass: 'bg-[#0d111a]',
      accentHex: '#ef4444',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'GAME GEAR' || c === 'GAMEGEAR') {
    return {
      id: 'gg',
      shortLabel: 'GG',
      fullLabel: 'GAME GEAR',
      layout: 'header-top',
      bgClass: 'bg-[#0f1018]',
      accentHex: '#3b82f6',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'SEGA SATURN' || c === 'SATURN') {
    return {
      id: 'saturn',
      shortLabel: 'SATURN',
      fullLabel: 'SEGA SATURN',
      layout: 'spine-left',
      bgClass: 'bg-[#0a0b12]',
      accentHex: '#60a5fa',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'TURBOGRAFX-16' || c === 'TURBOGRAFX16') {
    return {
      id: 'tg16',
      shortLabel: 'TG-16',
      fullLabel: 'TURBOGRAFX-16',
      layout: 'header-top',
      bgClass: 'bg-[#12100d]',
      accentHex: '#f59e0b',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'ATARI 2600' || c === 'ATARI2600') {
    return {
      id: 'atari',
      shortLabel: '2600',
      fullLabel: 'ATARI 2600',
      layout: 'header-top',
      bgClass: 'bg-[#140d08]',
      accentHex: '#ea580c',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'VIRTUAL BOY' || c === 'VIRTUALBOY') {
    return {
      id: 'vb',
      shortLabel: 'VB',
      fullLabel: 'VIRTUAL BOY',
      layout: 'header-top',
      bgClass: 'bg-[#120608]',
      accentHex: '#ef4444',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'FLASH') {
    return {
      id: 'flash',
      shortLabel: 'FLASH',
      fullLabel: 'FLASH ARCHIVE',
      layout: 'header-top',
      bgClass: 'bg-[#170909]',
      accentHex: '#ef4444',
      textHex: '#FFFFFF',
    };
  }
  if (c === 'WEBPORT' || c === 'WEB PORT') {
    return {
      id: 'webport',
      shortLabel: 'WEB PORT',
      fullLabel: 'WEB PORT EDITION',
      layout: 'header-top',
      bgClass: 'bg-[#081511]',
      accentHex: '#10b981',
      textHex: '#FFFFFF',
    };
  }

  return {
    id: 'generic',
    shortLabel: c.slice(0, 8),
    fullLabel: c,
    layout: 'header-top',
    bgClass: 'bg-[#0d0e14]',
    accentHex: '#3fa9f5',
    textHex: '#FFFFFF',
  };
}

export const ConsoleBoxOverlay: React.FC<ConsoleBoxOverlayProps> = ({
  consoleType,
  mode,
}) => {
  if (mode !== 'overlay' || !consoleType) return null;

  const spec = getConsoleVisualSpec(consoleType);

  return (
    <div
      className="pointer-events-none absolute top-2 left-2 z-[4] flex items-center gap-1.5 px-2 py-1 rounded-[4px] shadow-[0_3px_10px_rgba(0,0,0,0.75)] border border-white/20"
      style={{
        backgroundColor: spec.isNds ? '#f4f4f7' : 'rgba(7, 8, 12, 0.92)',
        color: spec.isNds ? '#111115' : '#ffffff',
        borderLeft: `3px solid ${spec.accentHex}`,
      }}
      aria-hidden="true"
    >
      {spec.isPs1 && <PsPrismMark className="w-3.5 h-3.5 shrink-0" />}
      {spec.isNds && <DsDualScreenMark className="w-3 h-3 shrink-0 text-neutral-800" />}
      <span className="text-[9.5px] font-black tracking-wider uppercase leading-none">
        {spec.isPs1 ? 'PlayStation' : spec.shortLabel}
      </span>
    </div>
  );
};
