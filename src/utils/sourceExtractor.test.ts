import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeExtractUrl,
  parseExtractedContent,
  extractSourceFromUrl,
} from './sourceExtractor';

test('normalizeExtractUrl auto-prepends https:// when scheme is omitted', () => {
  const res = normalizeExtractUrl('batcave.biz');
  assert.deepEqual(res, { ok: true, url: 'https://batcave.biz/' });

  const withPath = normalizeExtractUrl('  batcave.biz/comics/invincible  ');
  assert.deepEqual(withPath, { ok: true, url: 'https://batcave.biz/comics/invincible' });
});

test('normalizeExtractUrl preserves explicit http/https schemes and rejects invalid inputs', () => {
  assert.deepEqual(normalizeExtractUrl('http://example.com/feed.xml'), {
    ok: true,
    url: 'http://example.com/feed.xml',
  });
  assert.deepEqual(normalizeExtractUrl('https://example.com'), {
    ok: true,
    url: 'https://example.com/',
  });

  const empty = normalizeExtractUrl('   ');
  assert.equal(empty.ok, false);

  const badProto = normalizeExtractUrl('javascript:alert(1)');
  assert.equal(badProto.ok, false);

  const badSpaces = normalizeExtractUrl('not a valid url');
  assert.equal(badSpaces.ok, false);

  const noTld = normalizeExtractUrl('justoneword');
  assert.equal(noTld.ok, false);
});

test('extractSourceFromUrl returns structured failure on 403, 500, and network timeout without throwing', async () => {
  const res403 = await extractSourceFromUrl('batcave.biz', async (url) => {
    assert.equal(url, 'https://batcave.biz/');
    return {
      statusCode: 403,
      contentType: 'text/html',
      body: '<html>Forbidden</html>',
      finalUrl: url,
    };
  });
  assert.equal(res403.success, false);
  if (!res403.success) {
    assert.equal(res403.error, 'Target site blocked the automated request or is unreachable.');
  }

  const res500 = await extractSourceFromUrl('https://example.com', async () => ({
    statusCode: 500,
    contentType: 'text/html',
    body: 'Internal Server Error',
    finalUrl: 'https://example.com/',
  }));
  assert.equal(res500.success, false);
  if (!res500.success) {
    assert.equal(res500.error, 'Target site blocked the automated request or is unreachable.');
  }

  const resTimeout = await extractSourceFromUrl('https://example.com', async () => {
    throw new Error('Request timed out');
  });
  assert.equal(resTimeout.success, false);
  if (!resTimeout.success) {
    assert.equal(resTimeout.error, 'Target site blocked the automated request or is unreachable.');
  }
});

test('parseExtractedContent handles Cloudflare challenge, reader images, catalog links, RSS, and JSON', () => {
  const cfChallenge = parseExtractedContent(
    '<html><head><title>Just a moment...</title></head><body>cloudflare /cdn-cgi/challenge-platform</body></html>',
    'text/html',
    'https://batcave.biz/'
  );
  assert.equal(cfChallenge.success, false);

  const reader = parseExtractedContent(
    `<html><head><title>Issue #1</title></head><body>
      <img src="/p1.jpg" /><img src="/p2.jpg" /><img src="/p3.jpg" />
    </body></html>`,
    'text/html',
    'https://example.com/issue-1'
  );
  assert.equal(reader.success, true);
  if (reader.success) {
    assert.equal(reader.type, 'reader');
    assert.equal(reader.images?.length, 3);
    assert.equal(reader.images?.[0], 'https://example.com/p1.jpg');
  }

  const rss = parseExtractedContent(
    `<rss version="2.0"><channel><title>Comic RSS</title><item><title>Issue 5</title><link>/issues/5</link></item></channel></rss>`,
    'application/rss+xml',
    'https://example.com/rss'
  );
  assert.equal(rss.success, true);
  if (rss.success) {
    assert.equal(rss.type, 'feed');
    assert.equal(rss.title, 'Comic RSS');
    assert.equal(rss.items?.[0]?.title, 'Issue 5');
    assert.equal(rss.items?.[0]?.url, 'https://example.com/issues/5');
  }

  const readerSrcset = parseExtractedContent(
    `<html><head><title>Reader Srcset</title></head><body>
      <img src="/small.png" width="24" height="24" />
      <img srcset="/low1.jpg 1x, /high1.jpg 2x" />
      <img data-lazy-src="/page2.webp" />
      <img data-src="/page3.png" />
    </body></html>`,
    'text/html',
    'https://example.com/read/1'
  );
  assert.equal(readerSrcset.success, true);
  if (readerSrcset.success) {
    assert.equal(readerSrcset.type, 'reader');
    assert.deepEqual(readerSrcset.images, [
      'https://example.com/high1.jpg',
      'https://example.com/page2.webp',
      'https://example.com/page3.png',
    ]);
  }

  const catalog = parseExtractedContent(
    `<html><head><title>Series Catalog</title></head><body>
      <a href="/chapter/1"><img data-src="/c1.jpg" alt="Chapter 1" /></a>
      <a href="/chapter/2"><img src="/c2.jpg" alt="Chapter 2" /></a>
    </body></html>`,
    'text/html',
    'https://example.com/series'
  );
  assert.equal(catalog.success, true);
  if (catalog.success) {
    assert.equal(catalog.type, 'catalog');
    assert.equal(catalog.items?.length, 2);
    assert.equal(catalog.items?.[0]?.url, 'https://example.com/chapter/1');
    assert.equal(catalog.items?.[0]?.poster, 'https://example.com/c1.jpg');
  }

  const jsonFeed = parseExtractedContent(
    JSON.stringify({
      title: 'JSON Comics',
      items: [{ title: 'Ep 1', link: '/ep/1', image: '/ep1.jpg' }],
    }),
    'application/json',
    'https://example.com/feed.json'
  );
  assert.equal(jsonFeed.success, true);
  if (jsonFeed.success) {
    assert.equal(jsonFeed.type, 'feed');
    assert.equal(jsonFeed.title, 'JSON Comics');
    assert.equal(jsonFeed.items?.[0]?.url, 'https://example.com/ep/1');
    assert.equal(jsonFeed.items?.[0]?.poster, 'https://example.com/ep1.jpg');
  }
});
