/**
 * SteamGridDB Unified Persistent Image Resolution Service
 *
 * Uses the server-side proxy (/api/steamgrid/*) for PS1, Retro Consoles, WebPort & Flash artwork:
 * 1. Resolves BOTH SteamGridDB Labeled Console Box Art photos (e.g., PS1 jewel-case labels baked into the uploaded grid)
 *    AND Clean Artwork vertical posters (600x900) directly from SteamGridDB's grid metadata (notes, style, dimensions).
 * 2. Resolves SteamGridDB Hero Banners (/heroes) and Transparent Title Logos (/logos) for the GAM.ONL showcase.
 * 3. Uses bounded concurrency throttling + persistent localStorage cache.
 */

const CACHE_STORAGE_KEY = 'arcadia_steamgrid_cache_v4';
const LEGACY_CACHE_KEYS = ['arcadia_steamgrid_cache_v3', 'arcadia_steamgrid_cache_v2'];
const MAX_CACHE_ENTRIES = 3000;
const MAX_CONCURRENT_REQUESTS = 6;

export interface SteamGridGridVariant {
  id: number;
  url: string;
  thumb?: string;
  width: number;
  height: number;
  style?: string;
  notes?: string | null;
  score?: number;
}

export interface SteamGridAssets {
  poster: string;
  labeledPoster?: string;
  cleanPoster?: string;
  thumb?: string;
  hero?: string;
  logo?: string;
  icon?: string;
  gameId?: number;
  source: 'steamgriddb-api';
}

export interface SteamGridMediaBundle {
  gameId?: number;
  hero: string | null;
  logo: string | null;
  icon: string | null;
  labeledPoster: string | null;
  cleanPoster: string | null;
  variants: SteamGridGridVariant[];
}

// In-memory cache synced with localStorage
const steamgridMemoryCache = new Map<string, SteamGridAssets | null>();
const steamgridHeroLogoCache = new Map<string, SteamGridMediaBundle | null>();
// Deduplicate concurrent lookups for the same title
const inflightLookups = new Map<string, Promise<SteamGridAssets | null>>();
const inflightRichLookups = new Map<string, Promise<SteamGridMediaBundle | null>>();

// Concurrency semaphore queue
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests = Math.max(0, activeRequests - 1);
  const next = waitQueue.shift();
  if (next) next();
}

// Hydrate memory cache from localStorage on load
try {
  for (const oldKey of LEGACY_CACHE_KEYS) {
    if (localStorage.getItem(oldKey)) localStorage.removeItem(oldKey);
  }
  const saved = localStorage.getItem(CACHE_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.entries(parsed).forEach(([k, v]) => {
      steamgridMemoryCache.set(k, v as SteamGridAssets | null);
    });
  }
} catch {
  // Ignore localStorage errors
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersistCache() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      while (steamgridMemoryCache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = steamgridMemoryCache.keys().next().value;
        if (oldestKey !== undefined) {
          steamgridMemoryCache.delete(oldestKey);
        } else {
          break;
        }
      }
      const obj: Record<string, SteamGridAssets | null> = {};
      steamgridMemoryCache.forEach((val, key) => {
        obj[key] = val;
      });
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore storage quota limits
    }
  }, 400);
}

export function clearSteamGridCache(): void {
  steamgridMemoryCache.clear();
  steamgridHeroLogoCache.clear();
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
    for (const oldKey of LEGACY_CACHE_KEYS) {
      localStorage.removeItem(oldKey);
    }
  } catch {}
}

function normalizeLookupTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim();
}

function getConsoleMatchKeywords(consoleType?: string): RegExp | null {
  const c = (consoleType || '').toUpperCase().trim();
  if (c === 'PS1' || c === 'PSX' || c === 'PLAYSTATION') {
    return /\b(ps1|psx|playstation|ps\s*1|ntsc|pal|jewel)\b/i;
  }
  if (c === 'SNES' || c === 'SUPER NINTENDO') {
    return /\b(snes|super nintendo|super famicom|sfc)\b/i;
  }
  if (c === 'NES') {
    return /\b(nes|famicom|nintendo entertainment)\b/i;
  }
  if (c === 'N64' || c === 'NINTENDO 64') {
    return /\b(n64|nintendo 64)\b/i;
  }
  if (c === 'GBA') {
    return /\b(gba|game boy advance)\b/i;
  }
  if (c === 'GBC' || c === 'GAME BOY COLOR') {
    return /\b(gbc|game boy color)\b/i;
  }
  if (c === 'GAME BOY' || c === 'GB') {
    return /\b(game boy|dmg|gb)\b/i;
  }
  if (c === 'NDS' || c === 'NINTENDO DS') {
    return /\b(nds|ds|nintendo ds)\b/i;
  }
  if (c === 'PSP') {
    return /\b(psp|playstation portable|umd)\b/i;
  }
  if (c.includes('GENESIS') || c.includes('MEGADRIVE')) {
    return /\b(genesis|mega drive|megadrive|sega)\b/i;
  }
  return null;
}

const GENERIC_BOX_LABEL_RE =
  /\b(box\s*art|boxart|cover|retail|case|spine|template|original|ntsc|pal|label|console|banner|border)\b/i;
const NO_LABEL_PHRASE_RE =
  /\b(no[\s_-]*(ps1|psx|playstation|console|banner|template|label|border|logo)s?|without[\s_-]*(banner|template|label|border)|bannerless)\b/i;
const CLEAN_TEXTLESS_RE =
  /\b(no[\s_-]*logo|textless|clean|borderless|minimal|key[\s_-]*art)\b/i;

/**
 * Scores SteamGridDB grid photos for authentic console-labeled box art
 * (photos uploaded to SteamGridDB that include the PS1/console banner in the artwork).
 */
function scoreLabeledGrid(grid: any, consoleType?: string): number {
  const notes = String(grid.notes || '');
  const style = String(grid.style || '').toLowerCase();
  const w = Number(grid.width) || 0;
  const h = Number(grid.height) || 0;
  const upvotes = Number(grid.upvotes || grid.score || 0);

  let pts = Math.min(20, upvotes);
  const consoleRe = getConsoleMatchKeywords(consoleType);

  if (NO_LABEL_PHRASE_RE.test(notes)) {
    pts -= 160;
  } else {
    if (consoleRe && consoleRe.test(notes)) pts += 120;
    if (GENERIC_BOX_LABEL_RE.test(notes)) pts += 65;
  }
  if (style === 'alternate' && notes.length > 0) pts += 15;
  if (style === 'no_logo' || CLEAN_TEXTLESS_RE.test(notes)) pts -= 70;
  if (style === 'blurred') pts -= 60;

  // Favor portrait 600x900 or PS1 square jewel-case dimensions
  if (w === 600 && h === 900) pts += 30;
  else if (w > 0 && h > 0 && Math.abs(w - h) <= 10) pts += 22;
  else if (h > w) pts += 18;
  else pts -= 15;

  return pts;
}

/**
 * Scores SteamGridDB grid photos for clean vertical posters without retail box labels.
 */
function scoreCleanGrid(grid: any): number {
  const notes = String(grid.notes || '');
  const style = String(grid.style || '').toLowerCase();
  const w = Number(grid.width) || 0;
  const h = Number(grid.height) || 0;
  const upvotes = Number(grid.upvotes || grid.score || 0);

  let pts = Math.min(20, upvotes);

  if (w === 600 && h === 900) pts += 60;
  else if (h > w) pts += 40;
  else if (w === h) pts -= 25;
  else pts -= 40;

  if (NO_LABEL_PHRASE_RE.test(notes)) pts += 85;
  if (style === 'no_logo' || CLEAN_TEXTLESS_RE.test(notes)) pts += 45;
  if (style === 'alternate') pts += 15;
  if (!NO_LABEL_PHRASE_RE.test(notes)) {
    if (GENERIC_BOX_LABEL_RE.test(notes)) pts -= 55;
    if (/\b(ps1|psx|playstation|snes|nes|n64|gba|genesis|psp|ntsc|pal)\b/i.test(notes)) pts -= 75;
  }
  if (style === 'blurred') pts -= 40;

  return pts;
}

function pickBestSearchMatch(results: any[], cleanTitle: string, isPs1: boolean): any | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normTarget = norm(cleanTitle);
  const targetTokens = normTarget.split(' ').filter((w) => w.length >= 2);

  const relevant = results.filter((r) => {
    const rNorm = norm(r.name || '');
    if (!rNorm) return false;
    if (rNorm === normTarget || rNorm.includes(normTarget) || normTarget.includes(rNorm)) return true;
    if (targetTokens.length === 0) return false;
    const rTokens = new Set(rNorm.split(' '));
    const matches = targetTokens.filter((t) => rTokens.has(t)).length;
    return matches / targetTokens.length >= 0.6;
  });

  if (relevant.length === 0) return null;

  return [...relevant].sort((a, b) => {
    const aName = norm(a.name || '');
    const bName = norm(b.name || '');
    const aExact = aName === normTarget ? 1 : 0;
    const bExact = bName === normTarget ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    if (isPs1) {
      const aClassic = a.release_date && a.release_date < 1200000000 ? 1 : 0;
      const bClassic = b.release_date && b.release_date < 1200000000 ? 1 : 0;
      if (aClassic !== bClassic) return bClassic - aClassic;
    }

    const aVerified = a.verified ? 1 : 0;
    const bVerified = b.verified ? 1 : 0;
    return bVerified - aVerified;
  })[0];
}

function isSteamGridSupportedConsole(consoleType?: string): { isPs1: boolean; supported: boolean } {
  const cType = (consoleType || '').toUpperCase().trim();
  const isPs1 = cType === 'PS1' || cType === 'PLAYSTATION' || cType === 'PSX';
  const supported =
    Boolean(cType) ||
    isPs1 ||
    cType.includes('WEB') ||
    cType.includes('FLASH') ||
    cType.includes('PORT') ||
    !cType;
  return { isPs1, supported };
}

/**
 * Unified SteamGridDB resolver returning both console-labeled box art grids and clean vertical posters.
 */
export async function resolveSteamGridImage(
  gameTitle: string,
  consoleType?: string
): Promise<SteamGridAssets | null> {
  if (!gameTitle) return null;
  const cleanTitle = normalizeLookupTitle(gameTitle) || gameTitle.trim();
  const { isPs1, supported } = isSteamGridSupportedConsole(consoleType);

  const normalizedTitle = `${(consoleType || 'retro').toLowerCase()}:${cleanTitle.toLowerCase()}`;

  if (steamgridMemoryCache.has(normalizedTitle)) {
    return steamgridMemoryCache.get(normalizedTitle) || null;
  }

  if (!supported) {
    steamgridMemoryCache.set(normalizedTitle, null);
    return null;
  }

  if (inflightLookups.has(normalizedTitle)) {
    return inflightLookups.get(normalizedTitle)!;
  }

  const lookupPromise = (async (): Promise<SteamGridAssets | null> => {
    await acquireSlot();
    try {
      const searchUrl = `/api/steamgrid/search/${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(searchUrl);

      if (!res.ok) throw new Error(`SteamGridDB proxy returned HTTP ${res.status}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const bestMatch = pickBestSearchMatch(data.data, cleanTitle, isPs1);
        const gameId = bestMatch?.id;

        if (gameId) {
          // Query portrait posters + PS1 square jewel-case dimensions in a single API call
          let gridRes = await fetch(
            `/api/steamgrid/grids/${gameId}?dimensions=600x900,342x482,660x930,512x512,1024x1024&nsfw=false&humor=false`
          );
          let gridData = gridRes.ok ? await gridRes.json() : null;

          if (!gridData?.success || !Array.isArray(gridData.data) || gridData.data.length === 0) {
            gridRes = await fetch(`/api/steamgrid/grids/${gameId}?nsfw=false&humor=false`);
            gridData = gridRes.ok ? await gridRes.json() : null;
          }

          if (gridData?.success && Array.isArray(gridData.data) && gridData.data.length > 0) {
            const list = gridData.data;

            const bestLabeled = [...list].sort(
              (a, b) => scoreLabeledGrid(b, consoleType) - scoreLabeledGrid(a, consoleType)
            )[0];
            const bestClean = [...list].sort((a, b) => scoreCleanGrid(b) - scoreCleanGrid(a))[0];
            const isVerifiedLabeled = bestLabeled && scoreLabeledGrid(bestLabeled, consoleType) >= 70;

            const assets: SteamGridAssets = {
              poster: bestClean?.url || list[0].url,
              labeledPoster: isVerifiedLabeled ? bestLabeled.url : undefined,
              cleanPoster: bestClean?.url || list[0].url,
              thumb: bestClean?.thumb || list[0].thumb,
              gameId,
              source: 'steamgriddb-api',
            };
            steamgridMemoryCache.set(normalizedTitle, assets);
            schedulePersistCache();
            return assets;
          }
        }
      }
    } catch (err) {
      console.warn(`[SteamGridDB Service] Could not resolve image for "${gameTitle}":`, err);
    } finally {
      releaseSlot();
    }

    // Do not cache 503/network misses permanently if API key is missing so adding key later works immediately
    return null;
  })();

  inflightLookups.set(normalizedTitle, lookupPromise);
  try {
    return await lookupPromise;
  } finally {
    inflightLookups.delete(normalizedTitle);
  }
}

/**
 * Resolves wide SteamGridDB Hero Banners, Transparent Logos, and Grid variants for GAM.ONL Spotlight & Game Details.
 */
export async function resolveSteamGridHeroAndLogo(
  gameTitle: string,
  consoleType?: string
): Promise<SteamGridMediaBundle | null> {
  if (!gameTitle) return null;
  const cleanTitle = normalizeLookupTitle(gameTitle) || gameTitle.trim();
  const cType = (consoleType || 'retro').toLowerCase();
  const cacheKey = `rich:${cType}:${cleanTitle.toLowerCase()}`;

  if (steamgridHeroLogoCache.has(cacheKey)) {
    return steamgridHeroLogoCache.get(cacheKey) || null;
  }
  if (inflightRichLookups.has(cacheKey)) {
    return inflightRichLookups.get(cacheKey)!;
  }

  const isPs1 = cType === 'ps1' || cType === 'playstation' || cType === 'psx';

  const lookup = (async (): Promise<SteamGridMediaBundle | null> => {
    await acquireSlot();
    try {
      const searchRes = await fetch(`/api/steamgrid/search/${encodeURIComponent(cleanTitle)}`);
      if (!searchRes.ok) return null;
      const searchJson = await searchRes.json();
      const match =
        searchJson?.success && Array.isArray(searchJson.data)
          ? pickBestSearchMatch(searchJson.data, cleanTitle, isPs1)
          : null;
      const gameId = match?.id;
      if (!gameId) return null;

      const [heroesRes, logosRes, iconsRes, gridsRes] = await Promise.all([
        fetch(`/api/steamgrid/heroes/${gameId}?nsfw=false&humor=false`),
        fetch(`/api/steamgrid/logos/${gameId}?nsfw=false&humor=false`),
        fetch(`/api/steamgrid/icons/${gameId}?nsfw=false&humor=false`),
        fetch(`/api/steamgrid/grids/${gameId}?dimensions=600x900,512x512,1024x1024&nsfw=false&humor=false`),
      ]);

      const heroesJson = heroesRes.ok ? await heroesRes.json() : null;
      const logosJson = logosRes.ok ? await logosRes.json() : null;
      const iconsJson = iconsRes.ok ? await iconsRes.json() : null;
      const gridsJson = gridsRes.ok ? await gridsRes.json() : null;

      const heroes = Array.isArray(heroesJson?.data) ? heroesJson.data : [];
      const logos = Array.isArray(logosJson?.data) ? logosJson.data : [];
      const icons = Array.isArray(iconsJson?.data) ? iconsJson.data : [];
      const grids = Array.isArray(gridsJson?.data) ? gridsJson.data : [];

      const bestHero = heroes[0]?.url || null;
      const officialLogo =
        logos.find((l: any) => l.style === 'official' || l.style === 'white') || logos[0];
      const bestLogo = officialLogo?.url || null;
      const officialIcon =
        icons.find((i: any) => i.mime === 'image/png' && (Number(i.width) >= 64 || !i.width)) ||
        icons.find((i: any) => i.mime === 'image/png') ||
        icons[0];
      const bestIcon = officialIcon?.url || officialIcon?.thumb || null;

      const bestLabeled =
        grids.length > 0
          ? [...grids].sort((a, b) => scoreLabeledGrid(b, consoleType) - scoreLabeledGrid(a, consoleType))[0]?.url
          : null;
      const bestClean =
        grids.length > 0
          ? [...grids].sort((a, b) => scoreCleanGrid(b) - scoreCleanGrid(a))[0]?.url
          : null;

      const bundle: SteamGridMediaBundle = {
        gameId,
        hero: bestHero,
        logo: bestLogo,
        icon: bestIcon,
        labeledPoster: bestLabeled,
        cleanPoster: bestClean,
        variants: grids.slice(0, 12).map((g: any) => ({
          id: g.id,
          url: g.url,
          thumb: g.thumb,
          width: Number(g.width) || 600,
          height: Number(g.height) || 900,
          style: g.style,
          notes: g.notes || null,
          score: Number(g.upvotes || g.score || 0),
        })),
      };

      steamgridHeroLogoCache.set(cacheKey, bundle);
      return bundle;
    } catch {
      return null;
    } finally {
      releaseSlot();
    }
  })();

  inflightRichLookups.set(cacheKey, lookup);
  try {
    return await lookup;
  } finally {
    inflightRichLookups.delete(cacheKey);
  }
}

export interface SteamGridWheelIconData {
  gameId?: number;
  icon: string | null;
  logo: string | null;
}

const steamgridIconWheelCache = new Map<string, SteamGridWheelIconData | null>();
const inflightIconLookups = new Map<string, Promise<SteamGridWheelIconData | null>>();

/**
 * Lightweight SteamGridDB resolver specifically for the GAM.ONL curved wheel
 * fetching crisp game Icons (/icons) + Title Logos (/logos).
 */
export async function resolveSteamGridWheelIcon(
  gameTitle: string,
  consoleType?: string
): Promise<SteamGridWheelIconData | null> {
  if (!gameTitle) return null;
  const cleanTitle = normalizeLookupTitle(gameTitle) || gameTitle.trim();
  const cType = (consoleType || 'retro').toLowerCase();
  const cacheKey = `wheel:${cType}:${cleanTitle.toLowerCase()}`;

  // Reuse full rich cache if already populated
  const richKey = `rich:${cType}:${cleanTitle.toLowerCase()}`;
  const richHit = steamgridHeroLogoCache.get(richKey);
  if (richHit) {
    return { gameId: richHit.gameId, icon: richHit.icon, logo: richHit.logo };
  }

  if (steamgridIconWheelCache.has(cacheKey)) {
    return steamgridIconWheelCache.get(cacheKey) || null;
  }
  if (inflightIconLookups.has(cacheKey)) {
    return inflightIconLookups.get(cacheKey)!;
  }

  const isPs1 = cType === 'ps1' || cType === 'playstation' || cType === 'psx';

  const lookup = (async (): Promise<SteamGridWheelIconData | null> => {
    await acquireSlot();
    try {
      const searchRes = await fetch(`/api/steamgrid/search/${encodeURIComponent(cleanTitle)}`);
      if (!searchRes.ok) return null;
      const searchJson = await searchRes.json();
      const match =
        searchJson?.success && Array.isArray(searchJson.data)
          ? pickBestSearchMatch(searchJson.data, cleanTitle, isPs1)
          : null;
      const gameId = match?.id;
      if (!gameId) return null;

      const [iconsRes, logosRes] = await Promise.all([
        fetch(`/api/steamgrid/icons/${gameId}?nsfw=false&humor=false`),
        fetch(`/api/steamgrid/logos/${gameId}?nsfw=false&humor=false`),
      ]);

      const iconsJson = iconsRes.ok ? await iconsRes.json() : null;
      const logosJson = logosRes.ok ? await logosRes.json() : null;

      const icons = Array.isArray(iconsJson?.data) ? iconsJson.data : [];
      const logos = Array.isArray(logosJson?.data) ? logosJson.data : [];

      const bestIconObj =
        icons.find((i: any) => i.mime === 'image/png' && (Number(i.width) >= 64 || !i.width)) ||
        icons.find((i: any) => i.mime === 'image/png') ||
        icons[0];
      const bestLogoObj =
        logos.find((l: any) => l.style === 'official' || l.style === 'white') || logos[0];

      const result: SteamGridWheelIconData = {
        gameId,
        icon: bestIconObj?.url || bestIconObj?.thumb || null,
        logo: bestLogoObj?.url || null,
      };
      steamgridIconWheelCache.set(cacheKey, result);
      return result;
    } catch {
      return null;
    } finally {
      releaseSlot();
    }
  })();

  inflightIconLookups.set(cacheKey, lookup);
  try {
    return await lookup;
  } finally {
    inflightIconLookups.delete(cacheKey);
  }
}
