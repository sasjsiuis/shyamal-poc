import type { IncomingMessage, ServerResponse } from 'node:http';
import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateOrReservedIP(ip: string): boolean {
  let cleanIp = ip.trim().toLowerCase();
  if (cleanIp.startsWith('::ffff:')) cleanIp = cleanIp.slice(7);
  if (net.isIPv4(cleanIp)) {
    const [a, b] = cleanIp.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(cleanIp)) {
    if (cleanIp === '::1' || cleanIp === '::') return true;
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(cleanIp)) return true;
    return false;
  }
  return true;
}

async function validateSafeExternalUrl(rawInput: string): Promise<URL> {
  let normalized = rawInput.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  const parsed = new URL(normalized);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported URL protocol');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Blocked internal hostname');
  }
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) throw new Error('Blocked private IP');
    return parsed;
  }
  const records = await dns.lookup(hostname, { all: true });
  if (!records || records.length === 0) throw new Error('Could not resolve hostname');
  for (const rec of records) {
    if (isPrivateOrReservedIP(rec.address)) throw new Error('Blocked private resolved IP');
  }
  return parsed;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  zwnj: '\u200C',
  zwj: '\u200D',
};

function decodeHtmlEntities(input: string): string {
  if (!input) return '';
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-zA-Z]+);/g, (full, name) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? full)
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHeadline(rawTitle: string, siteName?: string): string {
  let title = decodeHtmlEntities(rawTitle).trim();
  if (!title) return '';
  const separators = [' | ', ' - ', ' – ', ' — ', ' :: ', ' • ', ' // '];
  for (const sep of separators) {
    const idx = title.lastIndexOf(sep);
    if (idx > 14) {
      const rightSide = title.slice(idx + sep.length).trim();
      const wordCount = rightSide.split(/\s+/).length;
      if (
        wordCount <= 4 ||
        (siteName && rightSide.toLowerCase().includes(siteName.toLowerCase())) ||
        /news|tv|sylhet|alo|post|kantho|jugantor|kalbela|ittefaq|samakal|tribune|bangla|daily|times|online|24|\.com|\.net|\.bd|নিউজ|টিভি|সিলেট|আলো|কণ্ঠ|যুগান্তর|কালবেলা|ইত্তেফাক|সমকাল|ট্রিবিউন|প্রতিদিন|বার্তা|সংবাদ/i.test(
          rightSide
        )
      ) {
        title = title.slice(0, idx).trim();
      }
    }
  }
  return title;
}

function resolveMaybeUrl(candidate: string | undefined | null, baseUrl: string): string {
  if (!candidate) return '';
  const cleaned = decodeHtmlEntities(candidate).trim();
  if (!cleaned || cleaned.startsWith('data:image/svg') || cleaned.startsWith('javascript:')) {
    return '';
  }
  try {
    const resolved = new URL(cleaned, baseUrl);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.href;
    }
  } catch {
    return '';
  }
  return '';
}

interface ExtractedMeta {
  title: string;
  image: string;
  siteName: string;
}

function parseHtmlMetadata(html: string, pageUrl: string): ExtractedMeta {
  let title = '';
  let image = '';
  let siteName = '';

  const metas = html.match(/<meta\s+[^>]*>/gi) || [];
  const metaMap: Record<string, string> = {};
  for (const tag of metas) {
    const keyMatch =
      tag.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i) ||
      tag.match(/(?:property|name|itemprop)\s*=\s*([^\s>]+)/i);
    const contentMatch =
      tag.match(/content\s*=\s*["']([^"']*)["']/i) ||
      tag.match(/content\s*=\s*([^\s>]+)/i);
    if (keyMatch && contentMatch) {
      const k = keyMatch[1].toLowerCase().trim();
      const v = contentMatch[1].trim();
      if (v && !metaMap[k]) metaMap[k] = v;
    }
  }

  siteName = decodeHtmlEntities(metaMap['og:site_name'] || metaMap['application-name'] || metaMap['publisher'] || '');

  const ldRegex = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch: RegExpExecArray | null;
  let ldTitle = '';
  let ldImage = '';

  const inspectLdNode = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) inspectLdNode(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj['@graph'] && Array.isArray(obj['@graph'])) inspectLdNode(obj['@graph']);
    const nodeType = String(obj['@type'] || '');
    const isArticle = /Article|News|Report|BlogPosting|VideoObject|WebPage/i.test(nodeType) || Boolean(obj.headline);
    if (isArticle) {
      if (!ldTitle && typeof obj.headline === 'string' && obj.headline.trim()) ldTitle = obj.headline.trim();
      else if (!ldTitle && typeof obj.name === 'string' && obj.name.trim()) ldTitle = obj.name.trim();
      if (!ldImage && obj.image) {
        if (typeof obj.image === 'string') ldImage = obj.image;
        else if (Array.isArray(obj.image) && obj.image.length > 0) {
          const first = obj.image[0];
          if (typeof first === 'string') ldImage = first;
          else if (first && typeof first === 'object' && typeof (first as Record<string, unknown>).url === 'string') {
            ldImage = String((first as Record<string, unknown>).url);
          }
        } else if (typeof obj.image === 'object' && typeof (obj.image as Record<string, unknown>).url === 'string') {
          ldImage = String((obj.image as Record<string, unknown>).url);
        }
      }
      if (!ldImage && typeof obj.thumbnailUrl === 'string') ldImage = obj.thumbnailUrl;
    }
  };

  while ((ldMatch = ldRegex.exec(html)) !== null) {
    try {
      const rawJson = ldMatch[1].trim();
      if (rawJson) inspectLdNode(JSON.parse(rawJson));
    } catch {
      // ignore
    }
  }

  let h1Title = '';
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let h1Match: RegExpExecArray | null;
  while ((h1Match = h1Regex.exec(html)) !== null) {
    const stripped = decodeHtmlEntities(h1Match[1].replace(/<[^>]+>/g, ' '));
    if (stripped.length > 8) {
      h1Title = stripped;
      break;
    }
  }

  const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const docTitle = titleTagMatch ? decodeHtmlEntities(titleTagMatch[1].replace(/<[^>]+>/g, ' ')) : '';
  const rawTitleCandidate =
    metaMap['og:title'] || ldTitle || metaMap['twitter:title'] || h1Title || metaMap['title'] || docTitle;
  title = cleanHeadline(rawTitleCandidate, siteName);
  if (/^(just a moment|attention required|access denied|403 forbidden|cloudflare|security check|page not found|404)/i.test(title)) {
    title = '';
  }

  const linkImgMatch = html.match(/<link[^>]+rel\s*=\s*["']image_src["'][^>]+href\s*=\s*["']([^"']+)["']/i);
  const rawImgCandidates = [
    metaMap['og:image:secure_url'],
    metaMap['og:image'],
    metaMap['og:image:url'],
    ldImage,
    metaMap['twitter:image'],
    metaMap['twitter:image:src'],
    metaMap['image'],
    linkImgMatch ? linkImgMatch[1] : '',
  ];

  for (const cand of rawImgCandidates) {
    const resolved = resolveMaybeUrl(cand, pageUrl);
    if (resolved && !/logo|favicon|icon|avatar|sprite|blank\.gif|1x1/i.test(resolved)) {
      image = resolved;
      break;
    }
  }
  if (!image) {
    for (const cand of rawImgCandidates) {
      const resolved = resolveMaybeUrl(cand, pageUrl);
      if (resolved) {
        image = resolved;
        break;
      }
    }
  }
  if (!image) {
    const imgTags = html.match(/<img\s+[^>]*>/gi) || [];
    for (const tag of imgTags) {
      const srcMatch = tag.match(/(?:data-src|data-lazy-src|data-original|src)\s*=\s*["']([^"']+)["']/i);
      if (!srcMatch) continue;
      const resolved = resolveMaybeUrl(srcMatch[1], pageUrl);
      if (!resolved || /logo|icon|avatar|pixel|tracker|ads|banner-ad|\.svg/i.test(resolved)) continue;
      image = resolved;
      break;
    }
  }
  return { title, image, siteName };
}

async function fetchHtmlWithUA(url: string, userAgent: string, timeoutMs = 5500): Promise<ExtractedMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const parsed = new URL(url);
    const resp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'bn-BD,bn;q=0.95,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        Referer: `${parsed.protocol}//${parsed.hostname}/`,
      },
    });
    if (!resp.ok) return { title: '', image: '', siteName: '' };
    const reader = resp.body?.getReader();
    if (!reader) return { title: '', image: '', siteName: '' };

    const chunks: Uint8Array[] = [];
    let total = 0;
    const maxBytes = 1_500_000;
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let partialHtml = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
        partialHtml += decoder.decode(value, { stream: true });
        if (
          (total > 32_000 &&
            partialHtml.includes('</head>') &&
            /og:title/i.test(partialHtml) &&
            /og:image/i.test(partialHtml)) ||
          total >= maxBytes
        ) {
          await reader.cancel().catch(() => {});
          break;
        }
      }
    }

    const combined = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      combined.set(c, offset);
      offset += c.byteLength;
    }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(combined);
    return parseHtmlMetadata(html, resp.url || url);
  } catch {
    return { title: '', image: '', siteName: '' };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchViaMicrolink(url: string, timeoutMs = 4200): Promise<ExtractedMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return { title: '', image: '', siteName: '' };
    const json = (await resp.json()) as {
      status?: string;
      data?: { title?: string; publisher?: string; image?: { url?: string } | string };
    };
    if (json?.status === 'success' && json.data) {
      const siteName = json.data.publisher || '';
      const img = typeof json.data.image === 'string' ? json.data.image : json.data.image?.url || '';
      return {
        title: cleanHeadline(json.data.title || '', siteName),
        image: resolveMaybeUrl(img, url),
        siteName,
      };
    }
    return { title: '', image: '', siteName: '' };
  } catch {
    return { title: '', image: '', siteName: '' };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchViaAllOrigins(url: string, timeoutMs = 4200): Promise<ExtractedMeta> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {
      signal: controller.signal,
      headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
    });
    if (!resp.ok) return { title: '', image: '', siteName: '' };
    const html = (await resp.text()).slice(0, 1_000_000);
    return parseHtmlMetadata(html, url);
  } catch {
    return { title: '', image: '', siteName: '' };
  } finally {
    clearTimeout(timer);
  }
}

function extractYouTubeThumbnail(targetUrl: URL): string {
  const host = targetUrl.hostname.toLowerCase();
  let videoId = '';
  if (host.includes('youtu.be')) {
    videoId = targetUrl.pathname.slice(1).split('/')[0];
  } else if (host.includes('youtube.com')) {
    videoId = targetUrl.searchParams.get('v') || '';
    if (!videoId && targetUrl.pathname.startsWith('/shorts/')) {
      videoId = targetUrl.pathname.split('/')[2] || '';
    }
  }
  if (videoId && /^[a-zA-Z0-9_-]{8,15}$/.test(videoId)) {
    return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  }
  return '';
}

function extractTitleFromSlug(targetUrl: URL): string {
  try {
    const segments = targetUrl.pathname
      .split('/')
      .map((s) => decodeURIComponent(s).trim())
      .filter(Boolean);
    const meaningful = segments
      .map((seg) =>
        seg
          .replace(/\.(html?|php|aspx?|jsp)$/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b\d{5,}\b/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      )
      .filter(
        (seg) =>
          seg.length > 6 &&
          !/^(news|article|story|details|national|politics|sports|bangladesh|world|opinion)$/i.test(seg)
      );
    if (meaningful.length === 0) return '';
    meaningful.sort((a, b) => b.length - a.length);
    return meaningful[0];
  } catch {
    return '';
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const reqUrl = new URL(req.url || '/', 'http://localhost');
  const rawUrl = (reqUrl.searchParams.get('url') || '').trim();

  if (!rawUrl) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ title: '', image: '', proxiedImage: '', siteName: '' }));
    return;
  }

  try {
    const safeUrl = await validateSafeExternalUrl(rawUrl);
    const href = safeUrl.href;

    const [socialResult, whatsappResult, browserResult] = await Promise.all([
      fetchHtmlWithUA(href, 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 5200),
      fetchHtmlWithUA(href, 'WhatsApp/2.23.20.0 A', 5200),
      fetchHtmlWithUA(
        href,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        5200
      ),
    ]);

    let title = socialResult.title || whatsappResult.title || browserResult.title;
    let image =
      socialResult.image ||
      whatsappResult.image ||
      browserResult.image ||
      extractYouTubeThumbnail(safeUrl);
    let siteName = socialResult.siteName || whatsappResult.siteName || browserResult.siteName;

    if (!title || !image) {
      const [ml, ao] = await Promise.all([
        fetchViaMicrolink(href, 3800),
        fetchViaAllOrigins(href, 3800),
      ]);
      if (!title) title = ml.title || ao.title;
      if (!image) image = ml.image || ao.image;
      if (!siteName) siteName = ml.siteName || ao.siteName;
    }

    if (!title) {
      title = extractTitleFromSlug(safeUrl);
    }

    let proxiedImage = '';
    if (image) {
      try {
        const validImgUrl = await validateSafeExternalUrl(image);
        image = validImgUrl.href;
        proxiedImage = `/api/proxy-image?url=${encodeURIComponent(validImgUrl.href)}&ref=${encodeURIComponent(safeUrl.origin)}`;
      } catch {
        image = '';
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ title, image, proxiedImage, siteName }));
  } catch {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ title: '', image: '', proxiedImage: '', siteName: '' }));
  }
}
