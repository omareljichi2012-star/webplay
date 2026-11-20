import type { SyntheticEvent } from 'react';

export const GTA_V_POSTER_URL =
  'https://cdn2.steamgriddb.com/grid/af0a25e27510f77d97634a6bbe653b13.jpg';

export const GTA_V_THUMB_URL =
  'https://cdn2.steamgriddb.com/thumb/af0a25e27510f77d97634a6bbe653b13.jpg';

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Creates a self-contained SVG data URI poster fallback so poster cards never
 * render broken image icons even on strict static hosts or blocked networks.
 */
export function createSvgPosterFallback(
  title = 'Stream X Media',
  category = 'Poster'
): string {
  const rawTitle = String(title || 'Stream X Media').trim();
  const rawCategory = String(category || 'Media').trim().toUpperCase();
  const displayTitle =
    rawTitle.length > 26 ? `${rawTitle.slice(0, 23)}...` : rawTitle || 'Media';
  const safeTitle = escapeXml(displayTitle);
  const safeCategory = escapeXml(rawCategory || 'POSTER');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a14"/>
      <stop offset="50%" stop-color="#141428"/>
      <stop offset="100%" stop-color="#070810"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#9333ea" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#9333ea" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="500" height="750" fill="url(#bg)"/>
  <circle cx="250" cy="300" r="160" fill="url(#glow)"/>
  <circle cx="250" cy="300" r="68" fill="#1f1d36" stroke="#9333ea" stroke-width="2.5"/>
  <polygon points="238,270 278,300 238,330" fill="#c084fc"/>
  <text x="250" y="438" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="800" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
  <text x="250" y="474" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" fill="#a855f7" text-anchor="middle" letter-spacing="3">${safeCategory}</text>
  <rect x="200" y="516" width="100" height="4" rx="2" fill="#7e22ce" opacity="0.6"/>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Idempotent React <img> onError handler that replaces a failing remote poster URL
 * with a clean SVG poster fallback.
 */
export function handlePosterImageError(
  event: SyntheticEvent<HTMLImageElement>,
  title?: string,
  category?: string
): void {
  const img = event.currentTarget;
  if (!img || img.dataset.fallbackApplied === 'true') return;
  img.dataset.fallbackApplied = 'true';
  img.src = createSvgPosterFallback(title || img.alt || 'Media', category || 'Poster');
}
