import http from 'http';
import https from 'https';
import * as cheerio from 'cheerio';

export interface ExtractSourceSuccess {
  success: true;
  type: 'feed' | 'reader' | 'catalog';
  title: string;
  sourceUrl: string;
  items?: Array<{ title: string; url: string; poster: string }>;
  images?: string[];
}

export interface ExtractSourceFailure {
  success: false;
  error: string;
  statusCode?: number;
}

export type ExtractSourceResult = ExtractSourceSuccess | ExtractSourceFailure;

export interface FetchResponse {
  statusCode: number;
  contentType: string;
  body: string;
  finalUrl: string;
}

export type FetcherFn = (url: string, timeoutMs?: number) => Promise<FetchResponse>;

const DEFAULT_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 5;

/**
 * Validates and normalizes a user-supplied URL for extraction.
 * Automatically prepends `https://` if no protocol scheme is provided.
 */
export function normalizeExtractUrl(
  rawInput: string | null | undefined
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = (rawInput ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Please enter a URL to extract.' };
  }

  // Reject clearly non-HTTP schemes like javascript:, data:, file:, ftp:
  const schemeMatch = trimmed.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):(.*)$/);
  let candidate = trimmed;
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      return {
        ok: false,
        error: 'Invalid URL protocol. Only http:// and https:// URLs are supported.',
      };
    }
    // Fix malformed "https:example.com" missing "//" if encountered
    if (!trimmed.toLowerCase().startsWith(`${scheme}://`)) {
      candidate = `${scheme}://${schemeMatch[2].replace(/^\/+/, '')}`;
    }
  } else if (trimmed.startsWith('//')) {
    candidate = `https:${trimmed}`;
  } else {
    candidate = `https://${trimmed}`;
  }

  // Reject whitespace inside the URL
  if (/\s/.test(candidate)) {
    return {
      ok: false,
      error: 'Invalid URL format. Please remove spaces and check the address.',
    };
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        ok: false,
        error: 'Invalid URL protocol. Only http:// and https:// URLs are supported.',
      };
    }
    const hostname = parsed.hostname;
    if (!hostname || (!hostname.includes('.') && hostname !== 'localhost')) {
      return {
        ok: false,
        error: 'Invalid domain name. Please enter a valid website URL (e.g., https://example.com).',
      };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return {
      ok: false,
      error: 'Invalid URL format. Please check the address and try again.',
    };
  }
}

/**
 * Performs an HTTP/HTTPS GET request with redirect support and strict timeout.
 */
export function defaultFetchUrl(
  urlToFetch: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  hops = 0
): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    if (hops > MAX_REDIRECTS) {
      reject(new Error('Too many redirects from target site.'));
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(urlToFetch);
    } catch {
      reject(new Error('Invalid target URL.'));
      return;
    }

    const client = parsed.protocol === 'https:' ? https : http;
    const reqOpts: https.RequestOptions = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: 'https://www.google.com/',
      },
    };

    let settled = false;
    const finishError = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const upReq = client.get(urlToFetch, reqOpts, (upRes) => {
      const status = upRes.statusCode || 0;

      if ([301, 302, 303, 307, 308].includes(status) && upRes.headers.location) {
        upRes.resume();
        try {
          const nextUrl = new URL(upRes.headers.location, urlToFetch).toString();
          defaultFetchUrl(nextUrl, timeoutMs, hops + 1).then(
            (res) => {
              if (!settled) {
                settled = true;
                resolve(res);
              }
            },
            finishError
          );
        } catch {
          finishError(new Error('Target site returned an invalid redirect location.'));
        }
        return;
      }

      const chunks: Buffer[] = [];
      upRes.on('data', (chunk: Buffer | string) => {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      });
      upRes.on('end', () => {
        if (settled) return;
        settled = true;
        resolve({
          statusCode: status,
          contentType: String(upRes.headers['content-type'] || ''),
          body: Buffer.concat(chunks).toString('utf8'),
          finalUrl: urlToFetch,
        });
      });
      upRes.on('error', (err) => finishError(err));
    });

    upReq.setTimeout(timeoutMs, () => {
      upReq.destroy(new Error('Request timed out'));
    });

    upReq.on('error', (err) => finishError(err));
  });
}

/**
 * Parses fetched JSON, RSS/Atom XML, or HTML safely with cheerio.
 */
export function parseExtractedContent(
  rawBody: string,
  contentType: string,
  targetUrl: string
): ExtractSourceResult {
  try {
    const trimmed = (rawBody || '').trim();
    if (!trimmed) {
      return {
        success: false,
        error: 'Target site returned an empty response.',
      };
    }

    // Detect Cloudflare or WAF bot-challenge pages returned with 200
    const lowerBody = trimmed.toLowerCase();
    if (
      (lowerBody.includes('<title>just a moment...</title>') ||
        lowerBody.includes('cf-browser-verification') ||
        lowerBody.includes('/cdn-cgi/challenge-platform')) &&
      lowerBody.includes('cloudflare')
    ) {
      return {
        success: false,
        error: 'Target site blocked the automated request or is unreachable.',
      };
    }

    if (
      contentType.includes('application/json') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('[')
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        const rawList = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.items)
          ? parsed.items
          : Array.isArray(parsed?.entries)
          ? parsed.entries
          : Array.isArray(parsed?.results)
          ? parsed.results
          : [parsed];
        const items = rawList
          .filter((entry: any) => entry && typeof entry === 'object')
          .map((entry: any, idx: number) => {
            const rawLink = String(entry.url || entry.link || entry.href || targetUrl);
            const rawThumb = String(
              entry.poster || entry.thumbnail || entry.image || entry.cover || entry.img || ''
            );
            let absLink = rawLink;
            let absThumb = rawThumb;
            try {
              absLink = new URL(rawLink, targetUrl).href;
            } catch {}
            try {
              absThumb = rawThumb && !rawThumb.startsWith('data:') ? new URL(rawThumb, targetUrl).href : '';
            } catch {}
            return {
              title: String(entry.title || entry.name || `Item #${idx + 1}`).trim(),
              url: absLink,
              poster: absThumb,
            };
          });
        return {
          success: true,
          type: 'feed',
          title: String(parsed?.title || targetUrl),
          items,
          sourceUrl: targetUrl,
        };
      } catch {
        // Fall through to XML/HTML parsing if not valid JSON
      }
    }

    if (
      contentType.includes('xml') ||
      contentType.includes('rss') ||
      trimmed.includes('<rss') ||
      trimmed.includes('<feed')
    ) {
      const $ = cheerio.load(rawBody, { xmlMode: true });
      const items: Array<{ title: string; url: string; poster: string }> = [];
      $('item, entry').each((_, el) => {
        const title = $(el).find('title').first().text().trim();
        const rawLink =
          $(el).find('link').first().text().trim() || $(el).find('link').first().attr('href') || '';
        const rawThumb =
          $(el).find('enclosure').attr('url') ||
          $(el).find('media\\:thumbnail, thumbnail').attr('url') ||
          $(el).find('media\\:content').attr('url') ||
          $(el).find('image').first().text().trim() ||
          '';
        let absLink = rawLink;
        let absThumb = rawThumb;
        try {
          if (rawLink) absLink = new URL(rawLink, targetUrl).href;
        } catch {}
        try {
          if (rawThumb && !rawThumb.startsWith('data:')) absThumb = new URL(rawThumb, targetUrl).href;
        } catch {}
        if (title) items.push({ title, url: absLink || targetUrl, poster: absThumb });
      });
      return {
        success: true,
        type: 'feed',
        title: $('channel > title, feed > title').first().text().trim() || targetUrl,
        items,
        sourceUrl: targetUrl,
      };
    }

    const $ = cheerio.load(rawBody);
    const pageTitle = $('title').text().trim() || targetUrl;

    const pickSrcFromSrcset = (srcset?: string): string => {
      if (!srcset) return '';
      const parts = srcset
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 0) return '';
      // Prefer highest resolution candidate (last entry)
      const last = parts[parts.length - 1];
      return last.split(/\s+/)[0] || '';
    };

    const resolveImgAttr = (el: any): string => {
      const $el = $(el);
      const candidates = [
        $el.attr('data-src'),
        $el.attr('data-lazy-src'),
        $el.attr('data-original'),
        pickSrcFromSrcset($el.attr('data-srcset')),
        pickSrcFromSrcset($el.attr('srcset')),
        $el.attr('src'),
      ];
      for (const c of candidates) {
        const val = (c || '').trim();
        if (val && !val.startsWith('data:')) return val;
      }
      return '';
    };

    const isSmallOrIconImg = (el: any, src: string): boolean => {
      const lower = src.toLowerCase();
      if (
        lower.includes('logo') ||
        lower.includes('icon') ||
        lower.includes('avatar') ||
        lower.includes('favicon') ||
        lower.includes('emoji') ||
        lower.includes('badge') ||
        lower.includes('spinner') ||
        lower.includes('loader') ||
        lower.includes('/ads/') ||
        lower.includes('banner')
      ) {
        return true;
      }
      const wAttr = Number($(el).attr('width'));
      const hAttr = Number($(el).attr('height'));
      if ((!Number.isNaN(wAttr) && wAttr > 0 && wAttr < 80) || (!Number.isNaN(hAttr) && hAttr > 0 && hAttr < 80)) {
        return true;
      }
      return false;
    };

    const imgCandidates: string[] = [];
    $('img').each((_, el) => {
      const src = resolveImgAttr(el);
      if (!src || isSmallOrIconImg(el, src)) return;
      try {
        const abs = new URL(src, targetUrl).href;
        if (!imgCandidates.includes(abs)) imgCandidates.push(abs);
      } catch {
        // Ignore malformed image URLs
      }
    });

    if (imgCandidates.length >= 3) {
      return {
        success: true,
        type: 'reader',
        title: pageTitle,
        images: imgCandidates,
        sourceUrl: targetUrl,
      };
    }

    const catalogItems: Array<{ title: string; url: string; poster: string }> = [];
    const seenLinks = new Set<string>();

    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
      try {
        const absUrl = new URL(href, targetUrl).href;
        if (seenLinks.has(absUrl)) return;

        const img = $(el).find('img').first();
        const imgSrc = img.length ? resolveImgAttr(img[0]) : '';
        const title = ($(el).attr('title') || img.attr('alt') || $(el).text() || '')
          .replace(/\s+/g, ' ')
          .trim();

        if (
          title &&
          title.length > 2 &&
          (imgSrc || absUrl.includes('issue') || absUrl.includes('chapter') || absUrl.includes('read'))
        ) {
          seenLinks.add(absUrl);
          const absPoster = imgSrc ? new URL(imgSrc, targetUrl).href : '';
          catalogItems.push({
            title,
            url: absUrl,
            poster: absPoster,
          });
        }
      } catch {
        // Ignore malformed link URLs
      }
    });

    return {
      success: true,
      type: 'catalog',
      title: pageTitle,
      items: catalogItems,
      sourceUrl: targetUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message
        ? `Failed to parse content from target site: ${err.message}`
        : 'Failed to parse content from target site.',
    };
  }
}

/**
 * Full end-to-end source extraction with URL normalization, fetch error handling,
 * HTTP status checking, and safe cheerio parsing. Never throws.
 */
export async function extractSourceFromUrl(
  rawUrl: string | null | undefined,
  fetcher: FetcherFn = defaultFetchUrl
): Promise<ExtractSourceResult> {
  try {
    const normalized = normalizeExtractUrl(rawUrl);
    if (normalized.ok === false) {
      return { success: false, error: normalized.error };
    }

    const response = await fetcher(normalized.url, DEFAULT_TIMEOUT_MS);

    if (response.statusCode === 403 || response.statusCode === 401 || response.statusCode === 429 || response.statusCode >= 500) {
      return {
        success: false,
        statusCode: response.statusCode,
        error: 'Target site blocked the automated request or is unreachable.',
      };
    }

    if (response.statusCode >= 400 || response.statusCode === 0) {
      return {
        success: false,
        statusCode: response.statusCode,
        error: `Target site returned HTTP ${response.statusCode} or is unreachable.`,
      };
    }

    return parseExtractedContent(response.body, response.contentType, response.finalUrl || normalized.url);
  } catch {
    return {
      success: false,
      error: 'Target site blocked the automated request or is unreachable.',
    };
  }
}
