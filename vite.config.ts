import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import http from 'http';
import https from 'https';
import { spawn } from 'child_process';
import { extractSourceFromUrl } from './src/utils/sourceExtractor';

function crossOriginIsolationPlugin(): Plugin {
  const applyHeaders = (req: any, res: any, next: any) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, *');

    if (req.url?.includes('coi-') || req.url?.includes('serviceworker')) {
      res.setHeader('Service-Worker-Allowed', '/');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    next();
  };

  return {
    name: 'cross-origin-isolation',
    configureServer(server) {
      server.middlewares.use(applyHeaders);
    },
    configurePreviewServer(server) {
      server.middlewares.use(applyHeaders);
    }
  };
}

function romProxyPlugin(): Plugin {
  const handler = (req: any, res: any, next: any) => {
    // 1. LaunchBox GamesDB API Proxy
    if (req.url?.startsWith('/api/launchbox/')) {
      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Expose-Headers', '*');
        return res.end();
      }

      let targetApiUrl = '';
      if (req.url.startsWith('/api/launchbox/search/')) {
        const searchTerm = req.url.substring('/api/launchbox/search/'.length);
        targetApiUrl = `https://gamesdb-api.launchbox-app.com/api/search/${searchTerm}`;
      } else if (req.url.startsWith('/api/launchbox/details/')) {
        const gameId = req.url.substring('/api/launchbox/details/'.length);
        targetApiUrl = `https://gamesdb-api.launchbox-app.com/api/games/details/${gameId}`;
      }

      if (targetApiUrl) {
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        };

        const upstreamReq = https.get(targetApiUrl, { headers }, (upstreamRes) => {
          res.statusCode = upstreamRes.statusCode || 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Access-Control-Expose-Headers', '*');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          upstreamRes.pipe(res);
        });

        upstreamReq.on('error', (err) => {
          res.statusCode = 502;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        });
        return;
      }
    }

    // 1.5. SteamGridDB API Proxy with bounded in-memory response cache
    if (req.url?.startsWith('/api/steamgrid/')) {
      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Expose-Headers', '*');
        return res.end();
      }

      const gCache = ((globalThis as any).__steamGridProxyCache ||= new Map<string, { status: number; body: string }>());
      const cachedHit = gCache.get(req.url);
      if (cachedHit) {
        res.statusCode = cachedHit.status;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        return res.end(cachedHit.body);
      }

      let targetApiUrl = '';
      if (req.url.startsWith('/api/steamgrid/search/')) {
        const searchTerm = req.url.substring('/api/steamgrid/search/'.length).split('?')[0];
        if (searchTerm && !searchTerm.includes('..')) {
          targetApiUrl = `https://www.steamgriddb.com/api/v2/search/autocomplete/${searchTerm}`;
        }
      } else {
        const assetMatch = req.url.match(/^\/api\/steamgrid\/(grids|heroes|logos|icons)\/([^?]+)(?:\?(.*))?$/);
        if (assetMatch) {
          const [, assetType, gameIdPart, queryPart] = assetMatch;
          if (/^\d+$/.test(gameIdPart || '')) {
            const safeQs = queryPart ? `?${new URLSearchParams(queryPart).toString()}` : '';
            targetApiUrl = `https://www.steamgriddb.com/api/v2/${assetType}/game/${gameIdPart}${safeQs}`;
          }
        }
      }

      if (targetApiUrl) {
        const apiKey = process.env.STEAMGRIDDB_API_KEY || '';
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({ success: false, error: 'STEAMGRIDDB_API_KEY is not configured' }));
        }
        const headers = {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*'
        };

        const upstreamReq = https.get(targetApiUrl, { headers }, (upstreamRes) => {
          const chunks: Buffer[] = [];
          upstreamRes.on('data', (c: Buffer) => chunks.push(c));
          upstreamRes.on('end', () => {
            const status = upstreamRes.statusCode || 200;
            const body = Buffer.concat(chunks).toString('utf8');
            if (status >= 200 && status < 300) {
              if (gCache.size >= 8000) {
                const oldest = gCache.keys().next().value;
                if (oldest) gCache.delete(oldest);
              }
              gCache.set(req.url, { status, body });
            }
            res.statusCode = status;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Access-Control-Expose-Headers', '*');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.end(body);
          });
        });

        upstreamReq.on('error', (err) => {
          res.statusCode = 502;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err.message }));
        });
        return;
      }
    }

    // 1.6. RAWG.io Gameplay Video & Screenshot Proxy
    if (req.url?.startsWith('/api/rawg/media')) {
      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        return res.end();
      }
      const rawgKey = process.env.RAWG_API_KEY || '';
      if (!rawgKey) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ success: false, error: 'RAWG_API_KEY is not configured' }));
      }
      const rCache = ((globalThis as any).__rawgProxyCache ||= new Map<string, { status: number; body: string }>());
      const cached = rCache.get(req.url);
      if (cached) {
        res.statusCode = cached.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(cached.body);
      }

      (async () => {
        try {
          const parsedUrl = new URL(req.url, 'http://localhost:3000');
          const rawTitle = (parsedUrl.searchParams.get('title') || '').trim();
          const rawConsole = (parsedUrl.searchParams.get('console') || '').trim();
          if (!rawTitle || rawTitle.length > 200) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify({ success: false, error: 'Missing game title' }));
          }
          const cleanTitle = rawTitle.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim() || rawTitle;
          const searchRes = await fetch(
            `https://api.rawg.io/api/games?key=${encodeURIComponent(rawgKey)}&search=${encodeURIComponent(cleanTitle)}&page_size=6`,
            { headers: { Accept: 'application/json', 'User-Agent': 'GAM-ONL-RetroHub/1.0' } }
          );
          if (!searchRes.ok) {
            res.statusCode = searchRes.status;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify({ success: false, error: `RAWG HTTP ${searchRes.status}` }));
          }
          const searchJson: any = await searchRes.json();
          const results: any[] = Array.isArray(searchJson?.results) ? searchJson.results : [];
          if (results.length === 0) {
            const body = JSON.stringify({ success: true, found: false, videoUrl: null, videos: [], screenshots: [] });
            rCache.set(req.url, { status: 200, body });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(body);
          }

          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          const targetNorm = norm(cleanTitle);
          const consoleLower = rawConsole.toLowerCase();
          const best = [...results].sort((a, b) => {
            const scoreItem = (item: any) => {
              let pts = 0;
              const nameNorm = norm(item.name || '');
              if (nameNorm === targetNorm) pts += 120;
              else if (nameNorm.includes(targetNorm) || targetNorm.includes(nameNorm)) pts += 60;
              if (item.clip?.clip || item.clip?.clips?.full) pts += 45;
              if (Array.isArray(item.platforms) && consoleLower) {
                const plats = item.platforms.map((p: any) => String(p?.platform?.name || '').toLowerCase()).join(' ');
                if (consoleLower === 'ps1' && plats.includes('playstation')) pts += 25;
              }
              pts += Math.min(20, Number(item.added || 0) / 500);
              return pts;
            };
            return scoreItem(b) - scoreItem(a);
          })[0];

          const [moviesRes, shotsRes] = await Promise.all([
            fetch(`https://api.rawg.io/api/games/${best.id}/movies?key=${encodeURIComponent(rawgKey)}`, {
              headers: { Accept: 'application/json', 'User-Agent': 'GAM-ONL-RetroHub/1.0' },
            }).catch(() => null),
            fetch(`https://api.rawg.io/api/games/${best.id}/screenshots?key=${encodeURIComponent(rawgKey)}`, {
              headers: { Accept: 'application/json', 'User-Agent': 'GAM-ONL-RetroHub/1.0' },
            }).catch(() => null),
          ]);

          const moviesJson: any = moviesRes && moviesRes.ok ? await moviesRes.json().catch(() => null) : null;
          const shotsJson: any = shotsRes && shotsRes.ok ? await shotsRes.json().catch(() => null) : null;
          const videos: any[] = [];
          if (best.clip?.clip || best.clip?.clips?.full || best.clip?.clips?.['640']) {
            videos.push({
              name: `${best.name} Gameplay Clip`,
              preview: best.clip.preview || best.background_image || null,
              url480: best.clip.clips?.['640'] || best.clip.clips?.['320'] || best.clip.clip || null,
              urlMax: best.clip.clips?.full || best.clip.clip || best.clip.clips?.['640'] || null,
            });
          }
          for (const m of Array.isArray(moviesJson?.results) ? moviesJson.results : []) {
            const uMax = m?.data?.max || m?.data?.['480'] || null;
            const u480 = m?.data?.['480'] || m?.data?.max || null;
            if (uMax || u480) {
              videos.push({
                name: String(m.name || 'Gameplay Trailer'),
                preview: m.preview || best.background_image || null,
                url480: u480,
                urlMax: uMax,
              });
            }
          }
          const shotUrls: string[] = [];
          for (const s of Array.isArray(shotsJson?.results) ? shotsJson.results : best.short_screenshots || []) {
            if (s?.image && !shotUrls.includes(s.image)) shotUrls.push(s.image);
          }
          if (best.background_image && !shotUrls.includes(best.background_image)) shotUrls.unshift(best.background_image);

          const body = JSON.stringify({
            success: true,
            found: true,
            rawgId: best.id,
            name: best.name,
            slug: best.slug,
            released: best.released || null,
            rating: best.rating || null,
            backgroundImage: best.background_image || null,
            videoUrl: videos[0]?.urlMax || videos[0]?.url480 || null,
            videoPreview: videos[0]?.preview || best.background_image || null,
            videos,
            screenshots: shotUrls.slice(0, 12),
          });
          if (rCache.size >= 4000) {
            const oldest = rCache.keys().next().value;
            if (oldest) rCache.delete(oldest);
          }
          rCache.set(req.url, { status: 200, body });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(body);
        } catch (err: any) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: err?.message || 'RAWG error' }));
        }
      })();
      return;
    }

    // 1.7. AniList ID Resolver for AniEmbed / AnimeEmbed
    if (req.url?.startsWith('/api/anilist/resolve')) {
      const aCache = ((globalThis as any).__anilistProxyCache ||= new Map<string, { status: number; body: string }>());
      const cached = aCache.get(req.url);
      if (cached) {
        res.statusCode = cached.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(cached.body);
      }
      (async () => {
        try {
          const parsedUrl = new URL(req.url, 'http://localhost:3000');
          const rawTitle = (parsedUrl.searchParams.get('title') || '').trim();
          const season = Number(parsedUrl.searchParams.get('season') || 1);
          const year = Number(parsedUrl.searchParams.get('year') || 0);
          const formatHint = (parsedUrl.searchParams.get('format') || '').toUpperCase();
          if (!rawTitle || rawTitle.length > 200) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify({ success: false, error: 'Missing title' }));
          }
          const searchTitle =
            season > 1 && !/season\s*\d+/i.test(rawTitle) ? `${rawTitle} Season ${season}` : rawTitle;

          const runGql = async (term: string) => {
            const r = await fetch('https://graphql.anilist.co', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
              body: JSON.stringify({
                query: `query ($search: String) {
                  Page(perPage: 10) {
                    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                      id idMal format seasonYear episodes title { romaji english native }
                    }
                  }
                }`,
                variables: { search: term },
              }),
            });
            if (!r.ok) return [];
            const j: any = await r.json().catch(() => null);
            return Array.isArray(j?.data?.Page?.media) ? j.data.Page.media : [];
          };

          let candidates = await runGql(searchTitle);
          if (candidates.length === 0 && searchTitle !== rawTitle) candidates = await runGql(rawTitle);
          if (candidates.length === 0) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify({ success: false, error: 'No AniList match' }));
          }

          const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          const targetNorm = norm(rawTitle);
          const best = [...candidates].sort((a, b) => {
            const score = (m: any) => {
              let pts = 0;
              const eng = norm(m.title?.english || '');
              const rom = norm(m.title?.romaji || '');
              if (eng === targetNorm || rom === targetNorm) pts += 100;
              else if (eng.includes(targetNorm) || rom.includes(targetNorm)) pts += 40;
              if (formatHint === 'MOVIE' && m.format === 'MOVIE') pts += 50;
              if (formatHint === 'TV' && (m.format === 'TV' || m.format === 'ONA')) pts += 50;
              if (year > 0 && m.seasonYear === year) pts += 35;
              return pts;
            };
            return score(b) - score(a);
          })[0];

          const body = JSON.stringify({
            success: true,
            anilistId: best.id,
            malId: best.idMal || null,
            title: best.title?.english || best.title?.romaji || rawTitle,
            format: best.format || null,
            seasonYear: best.seasonYear || null,
          });
          aCache.set(req.url, { status: 200, body });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(body);
        } catch (err: any) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: err?.message || 'AniList error' }));
        }
      })();
      return;
    }


    if (req.url?.startsWith('/api/proxy-image')) {
      req.url = req.url.replace('/api/proxy-image', '/api/proxy');
    }

    if (req.url?.startsWith('/api/extract-source')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        return res.end();
      }

      (async () => {
        try {
          const parsedUrl = new URL(req.url, 'http://localhost:3000');
          const targetUrl = parsedUrl.searchParams.get('url');
          const result = await extractSourceFromUrl(targetUrl);

          res.statusCode = result.success ? 200 : 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(result));
        } catch {
          if (!res.headersSent) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                success: false,
                error: 'Target site blocked the automated request or is unreachable.',
              })
            );
          }
        }
      })();
      return;
    }

    if (!req.url?.startsWith('/api/proxy')) {
      return next();
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, *');
      res.setHeader('Access-Control-Max-Age', '86400');
      return res.end();
    }

    try {
      const parsedUrl = new URL(req.url, 'http://localhost:3000');
      let targetUrl = parsedUrl.searchParams.get('url');
      if (!targetUrl) {
        res.statusCode = 400;
        return res.end('Missing url parameter');
      }

      // Ad-Blocker rule: Block known intrusive popup networks, ALWAYS whitelist Google AdSense
      const isGoogleAdSense = targetUrl.includes('googlesyndication.com') ||
                              targetUrl.includes('googleads') ||
                              targetUrl.includes('googleservices.com');
      const isMaliciousAd = ['popads', 'adsterra', 'propellerads', 'monetag', 'clickadu'].some(p => targetUrl!.includes(p));
      if (!isGoogleAdSense && isMaliciousAd) {
        res.statusCode = 204;
        return res.end();
      }

      // Proactively rewrite legacy locked chd_psx URLs to 100% public mirror
      if (targetUrl.includes('chd_psx')) {
        const rawFilename = decodeURIComponent(targetUrl.split('/').pop() || '');
        const cleanName = rawFilename
          .replace(/\.chd$/i, '')
          .replace(/\s*\([^)]*\)/g, '')
          .replace(/\s*\[[^\]]*\]/g, '')
          .trim();
        targetUrl = `https://archive.org/download/ps1-rip-chd-ck/${encodeURIComponent(cleanName)}.chd`;
      }

      const method = req.method || 'GET';

      const forwardViaCurl = (urlToFetch: string) => {
        let targetOrigin = '';
        try {
          targetOrigin = new URL(urlToFetch).origin;
        } catch {}
        const args = [
          '-sS',
          '-L',
          '--max-time',
          '30',
          '-D',
          '-',
          ...(method === 'HEAD' ? ['-I'] : ['-o', '-']),
          '-A',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          '-H',
          'Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        ];
        if (targetOrigin) {
          args.push('-H', `Referer: ${targetOrigin}/`);
          args.push('-H', `Origin: ${targetOrigin}`);
        }
        args.push(urlToFetch);

        const curlProc = spawn('curl', args);
        const chunks: Buffer[] = [];

        curlProc.on('error', (err) => {
          if (!res.headersSent) {
            res.statusCode = 502;
            res.end(`Proxy curl error: ${err.message}`);
          }
        });

        req.on('close', () => {
          if (!curlProc.killed) curlProc.kill();
        });

        curlProc.stdout.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        curlProc.on('close', (code) => {
          if (res.headersSent) return;
          const raw = Buffer.concat(chunks);
          if (code !== 0 && raw.length === 0) {
            res.statusCode = 502;
            res.end('Upstream proxy transfer failed');
            return;
          }

          // Strip one or more HTTP header blocks (if redirects occurred with -L)
          let offset = 0;
          let finalStatus = 200;
          let finalContentType = 'application/octet-stream';
          let finalCacheControl = '';

          while (offset < raw.length) {
            const sep = raw.indexOf('\r\n\r\n', offset);
            if (sep === -1) break;
            const headerBlock = raw.slice(offset, sep).toString('utf8');
            if (!/^HTTP\/\d/i.test(headerBlock)) break;

            const lines = headerBlock.split('\r\n');
            const statusM = lines[0].match(/^HTTP\/[\d.]+\s+(\d{3})/);
            const status = statusM ? Number(statusM[1]) : 200;
            offset = sep + 4;

            for (const line of lines.slice(1)) {
              const colon = line.indexOf(':');
              if (colon === -1) continue;
              const k = line.slice(0, colon).trim().toLowerCase();
              const v = line.slice(colon + 1).trim();
              if (k === 'content-type') finalContentType = v;
              if (k === 'cache-control') finalCacheControl = v;
            }
            finalStatus = status;
            if (status < 300 || status >= 400) break;
          }

          const body = method === 'HEAD' ? Buffer.alloc(0) : raw.slice(offset);
          res.statusCode = finalStatus;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, *');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
          res.setHeader('Content-Type', finalContentType);
          if (finalCacheControl) {
            res.setHeader('Cache-Control', finalCacheControl);
          }
          res.setHeader('Content-Length', String(body.length));
          res.end(body);
        });
      };

      const forwardRequest = (urlToFetch: string, hops = 0, isFallback = false) => {
        if (hops > 5) {
          res.statusCode = 508;
          return res.end('Too many redirects');
        }

        // BatCave CDN / uploads require browser/curl TLS + HTTP/2 fingerprint
        if (urlToFetch.includes('batcave.biz')) {
          return forwardViaCurl(urlToFetch);
        }

        const client = urlToFetch.startsWith('https:') ? https : http;
        const headers: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': '*/*'
        };
        try {
          const targetOrigin = new URL(urlToFetch).origin;
          headers['Referer'] = `${targetOrigin}/`;
        } catch {}
        if (req.headers.range) {
          headers['Range'] = req.headers.range as string;
        }

        const upstreamReq = client.request(urlToFetch, { method, headers }, (upstreamRes) => {
          // Handle redirects
          if ([301, 302, 303, 307, 308].includes(upstreamRes.statusCode || 0) && upstreamRes.headers.location) {
            upstreamRes.resume();
            const redirectUrl = new URL(upstreamRes.headers.location, urlToFetch).toString();
            return forwardRequest(redirectUrl, hops + 1, isFallback);
          }

          // Fallback to curl if Cloudflare/WAF returns 403 on Node https TLS
          if ((upstreamRes.statusCode || 0) === 403 && !urlToFetch.includes('archive.org')) {
            upstreamRes.resume();
            return forwardViaCurl(urlToFetch);
          }

          // If upstream returns 401/403/404 on an archive.org PS1 CHD, failover to public mirrors
          if (!isFallback && [401, 403, 404].includes(upstreamRes.statusCode || 0) && urlToFetch.includes('archive.org')) {
            upstreamRes.resume();
            const rawFilename = decodeURIComponent(urlToFetch.split('/').pop() || '');
            const cleanName = rawFilename
              .replace(/\.chd$/i, '')
              .replace(/\s*\([^)]*\)/g, '')
              .replace(/\s*\[[^\]]*\]/g, '')
              .trim();
            const fallbackUrl = `https://archive.org/download/CuratedPSXRedumpCHDs/${encodeURIComponent(cleanName)}.chd`;
            return forwardRequest(fallbackUrl, 0, true);
          }

          res.statusCode = upstreamRes.statusCode || 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, *');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

          if (upstreamRes.headers['content-length']) {
            res.setHeader('Content-Length', upstreamRes.headers['content-length']);
          } else if (method === 'HEAD') {
            res.setHeader('Content-Length', '52428800'); // Safe fallback content length for HEAD
          }
          if (upstreamRes.headers['content-type']) {
            res.setHeader('Content-Type', upstreamRes.headers['content-type']);
          }
          if (upstreamRes.headers['accept-ranges']) {
            res.setHeader('Accept-Ranges', upstreamRes.headers['accept-ranges']);
          } else {
            res.setHeader('Accept-Ranges', 'bytes');
          }
          if (upstreamRes.headers['content-range']) {
            res.setHeader('Content-Range', upstreamRes.headers['content-range']);
          }

          if (method === 'HEAD') {
            res.end();
          } else {
            upstreamRes.pipe(res);
          }
        });

        upstreamReq.setTimeout(120000, () => {
          upstreamReq.destroy();
          if (!res.headersSent) {
            res.statusCode = 504;
            res.end('Gateway timeout');
          }
        });

        req.on('close', () => {
          upstreamReq.destroy();
        });

        upstreamReq.on('error', (err) => {
          if (!isFallback && urlToFetch.includes('archive.org')) {
            const rawFilename = decodeURIComponent(urlToFetch.split('/').pop() || '');
            const cleanName = rawFilename
              .replace(/\.chd$/i, '')
              .replace(/\s*\([^)]*\)/g, '')
              .replace(/\s*\[[^\]]*\]/g, '')
              .trim();
            const fallbackUrl = `https://archive.org/download/CuratedPSXRedumpCHDs/${encodeURIComponent(cleanName)}.chd`;
            return forwardRequest(fallbackUrl, 0, true);
          }
          if (!res.headersSent) {
            res.statusCode = 502;
            res.end(`Proxy error: ${err.message}`);
          }
        });

        upstreamReq.end();
      };

      forwardRequest(targetUrl);
    } catch (e: any) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(`Server error: ${e.message}`);
      }
    }
  };

  return {
    name: 'rom-proxy',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [crossOriginIsolationPlugin(), react(), tailwindcss(), romProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          player: path.resolve(__dirname, 'player.html'),
        }
      }
    }
  };
});
