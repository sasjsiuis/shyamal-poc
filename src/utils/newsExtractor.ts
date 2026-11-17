export function normalizeExternalUrl(input: string): string {
  const s = input.trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function sanitizeUrlInput(raw: string): string {
  const trimmed = raw.trim().replace(/[\r\n]+/g, ' ');
  if (!trimmed) return '';
  const urlMatches = trimmed.match(/https?:\/\/[^\s]+/gi);
  if (urlMatches && urlMatches.length > 0) {
    const first = urlMatches[0];
    const secondProtoIdx = first.slice(8).search(/https?:\/\//i);
    if (secondProtoIdx !== -1) {
      return first.slice(0, secondProtoIdx + 8);
    }
    return first;
  }
  return trimmed;
}

export function isLikelyUrl(input: string): boolean {
  const s = input.trim();
  if (s.length < 8) return false;
  if (/^https?:\/\/[^\s]+\.[^\s]+/i.test(s)) return true;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\/[^\s]*/i.test(s)) return true;
  return false;
}

export function isClientErrorOrChallengeTitle(raw: string): boolean {
  const t = raw.trim();
  if (!t) return true;
  return (
    /^(just a moment|attention required|access denied|403 forbidden|cloudflare|security check|page not found|404\b|error\s*404|nothing found|not found)/i.test(
      t
    ) || /\b404\s*[-–|:]\s*(nothing found|not found|page not found)/i.test(t)
  );
}

export function extractTitleFromSlugClient(rawUrl: string): string {
  try {
    const parsed = new URL(normalizeExternalUrl(rawUrl));
    const segments = parsed.pathname
      .split('/')
      .map((s) => decodeURIComponent(s).trim())
      .filter(Boolean);
    const meaningful = segments
      .filter((seg) => {
        const clean = seg.replace(/\.(html?|php|aspx?|jsp)$/i, '').trim();
        if (/^[0-9a-f]{10,}$/i.test(clean)) return false;
        if (/^[0-9a-f]{8}-[0-9a-f-]{12,}$/i.test(clean)) return false;
        return clean.length > 6;
      })
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
          seg.length > 8 &&
          (seg.includes(' ') || /[\u0980-\u09FF]/.test(seg)) &&
          !/^(news|article|story|details|national|politics|sports|bangladesh|world|opinion|national news|economics business)$/i.test(
            seg
          )
      );
    if (meaningful.length === 0) return '';
    meaningful.sort((a, b) => b.length - a.length);
    return meaningful[0];
  } catch {
    return '';
  }
}

export function extractYouTubeThumbClient(rawUrl: string): string {
  try {
    const parsed = new URL(normalizeExternalUrl(rawUrl));
    const host = parsed.hostname.toLowerCase();
    let videoId = '';
    if (host.includes('youtu.be')) {
      videoId = parsed.pathname.slice(1).split('/')[0];
    } else if (host.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v') || '';
      if (!videoId && parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2] || '';
      }
    }
    if (videoId && /^[a-zA-Z0-9_-]{8,15}$/.test(videoId)) {
      return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    }
  } catch {
    // ignore
  }
  return '';
}

export async function fetchMicrolinkClient(
  rawUrl: string,
  signal: AbortSignal
): Promise<{ title: string; image: string }> {
  try {
    const target = normalizeExternalUrl(rawUrl);
    if (!target) return { title: '', image: '' };
    const resp = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(target)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return { title: '', image: '' };
    const json = (await resp.json()) as {
      status?: string;
      data?: {
        title?: string;
        publisher?: string;
        image?: { url?: string } | string;
      };
    };
    if (json?.status !== 'success' || !json.data) {
      return { title: '', image: '' };
    }
    let title = (json.data.title || '').trim();
    const publisher = (json.data.publisher || '').trim();
    if (title && publisher) {
      for (const sep of [' | ', ' - ', ' – ', ' — ', ' :: ']) {
        const idx = title.lastIndexOf(sep);
        if (idx > 14 && title.slice(idx + sep.length).toLowerCase().includes(publisher.toLowerCase())) {
          title = title.slice(0, idx).trim();
          break;
        }
      }
    }
    if (isClientErrorOrChallengeTitle(title)) {
      return { title: '', image: '' };
    }
    const rawImg =
      typeof json.data.image === 'string'
        ? json.data.image
        : json.data.image?.url || '';
    return {
      title,
      image: rawImg.trim().replace(/ /g, '%20'),
    };
  } catch {
    return { title: '', image: '' };
  }
}

export function parseClientHtmlMeta(html: string, pageUrl: string): { title: string; image: string } {
  if (!html || typeof DOMParser === 'undefined') return { title: '', image: '' };
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const pickMeta = (selectors: string[]): string => {
      for (const sel of selectors) {
        const el = doc.querySelector(sel);
        const val = el?.getAttribute('content')?.trim();
        if (val) return val;
      }
      return '';
    };

    const siteName = pickMeta([
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="publisher"]',
    ]);
    let rawTitle =
      pickMeta([
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        'meta[name="title"]',
      ]) ||
      doc.querySelector('h1')?.textContent?.trim() ||
      doc.title?.trim() ||
      '';

    if (isClientErrorOrChallengeTitle(rawTitle)) {
      return { title: '', image: '' };
    }

    if (rawTitle) {
      for (const sep of [' | ', ' - ', ' – ', ' — ', ' :: ']) {
        const idx = rawTitle.lastIndexOf(sep);
        if (idx > 14) {
          const right = rawTitle.slice(idx + sep.length).trim();
          if (
            right.split(/\s+/).length <= 4 ||
            (siteName && right.toLowerCase().includes(siteName.toLowerCase()))
          ) {
            rawTitle = rawTitle.slice(0, idx).trim();
            break;
          }
        }
      }
    }

    const rawImg =
      pickMeta([
        'meta[property="og:image:secure_url"]',
        'meta[property="og:image"]',
        'meta[property="og:image:url"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
      ]) ||
      doc.querySelector('link[rel="image_src"]')?.getAttribute('href')?.trim() ||
      '';

    let image = '';
    if (rawImg) {
      try {
        image = new URL(rawImg.replace(/ /g, '%20'), pageUrl).href;
      } catch {
        image = '';
      }
    }
    return { title: rawTitle, image };
  } catch {
    return { title: '', image: '' };
  }
}

export async function fetchAllOriginsClient(
  rawUrl: string,
  signal: AbortSignal
): Promise<{ title: string; image: string }> {
  try {
    const target = normalizeExternalUrl(rawUrl);
    if (!target) return { title: '', image: '' };
    const resp = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`, {
      signal,
    });
    if (!resp.ok) return { title: '', image: '' };
    const json = (await resp.json()) as { contents?: string };
    if (!json?.contents) return { title: '', image: '' };
    return parseClientHtmlMeta(json.contents, target);
  } catch {
    return { title: '', image: '' };
  }
}

export async function fetchJsonLinkClient(
  rawUrl: string,
  signal: AbortSignal
): Promise<{ title: string; image: string }> {
  try {
    const target = normalizeExternalUrl(rawUrl);
    if (!target) return { title: '', image: '' };
    const resp = await fetch(`https://jsonlink.io/api/extract?url=${encodeURIComponent(target)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return { title: '', image: '' };
    const json = (await resp.json()) as { title?: string; images?: string[] };
    const title = (json.title || '').trim();
    if (isClientErrorOrChallengeTitle(title)) {
      return { title: '', image: '' };
    }
    const image =
      Array.isArray(json.images) && json.images[0]
        ? json.images[0].trim().replace(/ /g, '%20')
        : '';
    return { title, image };
  } catch {
    return { title: '', image: '' };
  }
}

export async function fetchJinaClient(
  rawUrl: string,
  signal: AbortSignal
): Promise<{ title: string; image: string }> {
  try {
    const target = normalizeExternalUrl(rawUrl);
    if (!target) return { title: '', image: '' };
    const resp = await fetch(`https://r.jina.ai/${target}`, {
      signal,
      headers: { Accept: 'text/plain' },
    });
    if (!resp.ok) return { title: '', image: '' };
    const text = (await resp.text()).slice(0, 100_000);
    const titleMatch = text.match(/^Title:\s*(.+)$/m);
    let title = titleMatch ? titleMatch[1].trim() : '';
    if (title) {
      for (const sep of [' | ', ' - ', ' – ', ' — ', ' :: ']) {
        const idx = title.lastIndexOf(sep);
        if (idx > 14 && title.slice(idx + sep.length).trim().split(/\s+/).length <= 4) {
          title = title.slice(0, idx).trim();
          break;
        }
      }
    }
    if (isClientErrorOrChallengeTitle(title)) title = '';
    let image = '';
    const imgRegex = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = imgRegex.exec(text)) !== null) {
      const candidate = m[1].trim().replace(/ /g, '%20');
      if (candidate && !/logo|favicon|icon|avatar|sprite|\.svg/i.test(candidate)) {
        image = candidate;
        break;
      }
    }
    return { title, image };
  } catch {
    return { title: '', image: '' };
  }
}
