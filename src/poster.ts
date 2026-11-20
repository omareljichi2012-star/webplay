// 100% Reliable Poster Pathway & Fallback System
import type { SyntheticEvent } from 'react';

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeColor(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed) || /^rgba?\([^)]+\)$/.test(trimmed) || /^[a-zA-Z]+$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

function normalizeConsoleKey(consoleType: string | undefined): string {
  return (consoleType || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

// SVG Retro Cartridge Assets for Guaranteed Non-Blank Fallbacks
export function createCartridgeSvg(
  systemLabel: string,
  bgColor: string,
  accentColor: string,
  detailText: string,
  gameTitle?: string
): string {
  const rawTitle = (gameTitle || systemLabel || 'Retro Classic').trim();
  const truncatedTitle = rawTitle.length > 24 ? `${rawTitle.slice(0, 22)}...` : rawTitle;
  const safeLabel = escapeXml((systemLabel || 'Retro Arcade').toUpperCase());
  const safeTitle = escapeXml(truncatedTitle);
  const safeDetail = escapeXml(detailText || 'WebPlay Verified Classic');
  const safeBg = escapeXml(sanitizeColor(bgColor, '#1b1c2b'));
  const safeAccent = escapeXml(sanitizeColor(accentColor, '#8b2ed8'));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 420" width="100%" height="100%">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${safeBg}" />
        <stop offset="100%" stop-color="#05060a" />
      </linearGradient>
      <linearGradient id="labelGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#141523" />
        <stop offset="100%" stop-color="#090a12" />
      </linearGradient>
    </defs>
    <!-- Cartridge Shell -->
    <rect x="20" y="20" width="280" height="380" rx="20" fill="url(#bgGrad)" stroke="#282938" stroke-width="3"/>
    <!-- Top Grip Ridges -->
    <line x1="50" y1="45" x2="270" y2="45" stroke="#282938" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="58" x2="270" y2="58" stroke="#282938" stroke-width="4" stroke-linecap="round"/>
    <line x1="50" y1="71" x2="270" y2="71" stroke="#282938" stroke-width="4" stroke-linecap="round"/>
    <!-- Label Recess -->
    <rect x="40" y="95" width="240" height="270" rx="12" fill="url(#labelGrad)" stroke="${safeAccent}" stroke-width="2" stroke-opacity="0.5"/>
    <!-- System Badge -->
    <rect x="55" y="115" width="210" height="34" rx="8" fill="${safeAccent}" fill-opacity="0.15" stroke="${safeAccent}" stroke-width="1.5"/>
    <text x="160" y="137" fill="${safeAccent}" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="900" text-anchor="middle" letter-spacing="1.5">${safeLabel}</text>
    <!-- Center Game Title Label -->
    <rect x="55" y="165" width="210" height="110" rx="8" fill="#0d0e18" stroke="#232434" stroke-width="1"/>
    <text x="160" y="210" fill="#ffffff" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="800" text-anchor="middle">${safeTitle}</text>
    <text x="160" y="240" fill="${safeAccent}" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="700" text-anchor="middle" letter-spacing="1">AUTHENTIC EDITION</text>
    <!-- Micro Text / Seal -->
    <text x="160" y="310" fill="#9a9aaa" font-family="Inter, system-ui, sans-serif" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="1">WEBPLAY VERIFIED</text>
    <text x="160" y="330" fill="#6b6c80" font-family="Inter, system-ui, sans-serif" font-size="10" text-anchor="middle">${safeDetail}</text>
    <!-- Cartridge Pins Indicator -->
    <rect x="60" y="385" width="200" height="15" rx="3" fill="#1b1d2e"/>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Fallback image maps keyed by console type
export function getConsoleFallbackPoster(consoleType: string, title?: string): string {
  const key = normalizeConsoleKey(consoleType);

  if (key === 'nes' || key === 'nintendo entertainment system' || key === 'fc' || key === 'famicom') {
    return createCartridgeSvg('NES', '#1f2030', '#e63946', '8-Bit Cartridge', title);
  }
  if (key === 'snes' || key === 'super nintendo' || key === 'super famicom') {
    return createCartridgeSvg('SNES', '#252033', '#8b2ed8', '16-Bit Super Cartridge', title);
  }
  if (key === 'gba' || key === 'game boy advance') {
    return createCartridgeSvg('Game Boy Advance', '#121e36', '#4cc9f0', '32-Bit Handheld Core', title);
  }
  if (key === 'flash' || key === 'flash vault' || key === 'swf') {
    return createCartridgeSvg('Flash Vault', '#2d142c', '#f72585', 'Vector SWF Preservation', title);
  }
  if (key === 'sega genesis' || key === 'genesis' || key === 'mega drive' || key === 'sega mega drive') {
    return createCartridgeSvg('Sega Genesis', '#1a1a24', '#ffd166', '16-Bit Mega Drive', title);
  }
  if (key === 'nintendo ds' || key === 'nds' || key === 'ds') {
    return createCartridgeSvg('Nintendo DS', '#182428', '#61e0bb', 'Dual-Screen Touch Card', title);
  }
  if (key === 'n64' || key === 'nintendo 64') {
    return createCartridgeSvg('Nintendo 64', '#16192b', '#ef476f', '64-Bit Reality Cartridge', title);
  }
  if (key === 'ps1' || key === 'psx' || key === 'playstation' || key === 'playstation 1') {
    return createCartridgeSvg('PlayStation', '#1a1829', '#06d6a0', '32-Bit CD-ROM Disc', title);
  }
  if (key === 'webport' || key === 'web port' || key === 'browser') {
    return createCartridgeSvg('Web Port', '#0f2027', '#00d2ff', 'WebAssembly Stream Engine', title);
  }

  return createCartridgeSvg(consoleType || 'Retro Arcade', '#1b1c2b', '#8b2ed8', 'WebPlay Verified Classic', title);
}

// Direct Libretro Boxart CDN resolver
export function getLibretroBoxart(consoleType: string, title: string): string {
  const cleanTitle = (title || '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[:\/\\*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTitle) return '';

  const key = normalizeConsoleKey(consoleType);
  let folder = '';

  if (key === 'nes' || key === 'nintendo entertainment system') {
    folder = 'Nintendo_-_Nintendo_Entertainment_System';
  } else if (key === 'snes' || key === 'super nintendo') {
    folder = 'Nintendo_-_Super_Nintendo_Entertainment_System';
  } else if (key === 'gba' || key === 'game boy advance') {
    folder = 'Nintendo_-_Game_Boy_Advance';
  } else if (key === 'sega genesis' || key === 'genesis' || key === 'mega drive') {
    folder = 'Sega_-_Mega_Drive_-_Genesis';
  } else if (key === 'nintendo ds' || key === 'nds' || key === 'ds') {
    folder = 'Nintendo_-_Nintendo_DS';
  } else if (key === 'n64' || key === 'nintendo 64') {
    folder = 'Nintendo_-_Nintendo_64';
  } else if (key === 'ps1' || key === 'psx' || key === 'playstation' || key === 'playstation 1') {
    folder = 'Sony_-_PlayStation';
  }

  if (!folder) return '';

  return `https://raw.githubusercontent.com/libretro-thumbnails/${folder}/master/Named_Boxarts/${encodeURIComponent(`${cleanTitle} (USA)`)}.png`;
}

export function isBlockedOrUnreliableImageUrl(url: string | undefined): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('data:image/')) return false;
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) return true;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes('api.rawg.io') ||
    lower.includes('images.igdb.com/igdb/image/upload/t_cover_big/') ||
    lower.includes('undefined') ||
    lower.includes('null')
  ) {
    return true;
  }

  return false;
}

// Main image URL selector with strict fallback guard
export function getSafePosterUrl(posterUrl: string | undefined, consoleType: string, title: string): string {
  if (posterUrl && !isBlockedOrUnreliableImageUrl(posterUrl)) {
    return posterUrl.trim();
  }
  const libretro = getLibretroBoxart(consoleType, title);
  if (libretro) return libretro;
  return getConsoleFallbackPoster(consoleType, title);
}

// Event handler for img onError to ensure NO IMAGE EVER LOADS BLANK
export function handlePosterError(
  e: SyntheticEvent<HTMLImageElement>,
  consoleType: string,
  title?: string
): void {
  const target = e.currentTarget;
  if (!target || target.dataset.posterFallbackApplied === 'true') return;
  target.dataset.posterFallbackApplied = 'true';

  const fallback = getConsoleFallbackPoster(consoleType, title || target.alt);
  if (target.src !== fallback) {
    target.src = fallback;
  }
}
