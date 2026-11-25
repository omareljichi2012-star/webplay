/**
 * RAWG.io Gameplay Video Clips & Screenshots Service
 * Calls the server-side /api/rawg/media proxy so RAWG_API_KEY stays strictly on the server.
 */

export interface RawgVideoEntry {
  name: string;
  preview: string | null;
  url480: string | null;
  urlMax: string | null;
}

export interface RawgGameMediaBundle {
  found: boolean;
  missingKey?: boolean;
  rawgId?: number;
  name?: string;
  released?: string | null;
  rating?: number | null;
  backgroundImage?: string | null;
  videoUrl: string | null;
  videoPreview: string | null;
  videos: RawgVideoEntry[];
  screenshots: string[];
}

const RAWG_STORAGE_KEY = 'arcadia_rawg_cache_v1';
const rawgMemoryCache = new Map<string, RawgGameMediaBundle>();
const rawgInflight = new Map<string, Promise<RawgGameMediaBundle | null>>();

try {
  const saved = localStorage.getItem(RAWG_STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.entries(parsed).forEach(([k, v]) => {
      rawgMemoryCache.set(k, v as RawgGameMediaBundle);
    });
  }
} catch {}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersistRawg() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      while (rawgMemoryCache.size > 1000) {
        const oldest = rawgMemoryCache.keys().next().value;
        if (oldest !== undefined) rawgMemoryCache.delete(oldest);
        else break;
      }
      const obj: Record<string, RawgGameMediaBundle> = {};
      rawgMemoryCache.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(RAWG_STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }, 400);
}

export function clearRawgCache(): void {
  rawgMemoryCache.clear();
  try {
    localStorage.removeItem(RAWG_STORAGE_KEY);
  } catch {}
}

export async function resolveRawgGameMedia(
  gameTitle: string,
  consoleType?: string
): Promise<RawgGameMediaBundle | null> {
  if (!gameTitle) return null;
  const cleanTitle = gameTitle
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim() || gameTitle.trim();
  const key = `${(consoleType || 'retro').toLowerCase()}:${cleanTitle.toLowerCase()}`;

  if (rawgMemoryCache.has(key)) {
    return rawgMemoryCache.get(key) || null;
  }
  if (rawgInflight.has(key)) {
    return rawgInflight.get(key)!;
  }

  const reqPromise = (async (): Promise<RawgGameMediaBundle | null> => {
    try {
      const qs = new URLSearchParams({ title: cleanTitle });
      if (consoleType) qs.set('console', consoleType);
      const res = await fetch(`/api/rawg/media?${qs.toString()}`);

      if (res.status === 503) {
        return {
          found: false,
          missingKey: true,
          videoUrl: null,
          videoPreview: null,
          videos: [],
          screenshots: [],
        };
      }
      if (!res.ok) return null;

      const data = await res.json();
      if (!data?.success) return null;

      const bundle: RawgGameMediaBundle = {
        found: Boolean(data.found),
        rawgId: data.rawgId,
        name: data.name,
        released: data.released || null,
        rating: data.rating || null,
        backgroundImage: data.backgroundImage || null,
        videoUrl: data.videoUrl || null,
        videoPreview: data.videoPreview || null,
        videos: Array.isArray(data.videos) ? data.videos : [],
        screenshots: Array.isArray(data.screenshots) ? data.screenshots : [],
      };

      rawgMemoryCache.set(key, bundle);
      schedulePersistRawg();
      return bundle;
    } catch {
      return null;
    }
  })();

  rawgInflight.set(key, reqPromise);
  try {
    return await reqPromise;
  } finally {
    rawgInflight.delete(key);
  }
}
