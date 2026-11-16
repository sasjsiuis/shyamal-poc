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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const reqUrl = new URL(req.url || '/', 'http://localhost');
  const rawImgUrl = (reqUrl.searchParams.get('url') || '').trim().replace(/ /g, '%20');
  const rawRef = (reqUrl.searchParams.get('ref') || '').trim();

  if (!rawImgUrl) {
    res.statusCode = 400;
    res.end();
    return;
  }

  let safeImgUrl: URL;
  try {
    safeImgUrl = await validateSafeExternalUrl(rawImgUrl);
  } catch {
    res.statusCode = 400;
    res.end();
    return;
  }

  const referer = /^https?:\/\//i.test(rawRef) ? rawRef : `${safeImgUrl.protocol}//${safeImgUrl.hostname}/`;

  const tryDownloadImage = async (targetHref: string, ua: string, includeReferer: boolean, timeoutMs = 4400) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        'User-Agent': ua,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      };
      if (includeReferer) headers.Referer = referer;
      const resp = await fetch(targetHref, {
        signal: controller.signal,
        redirect: 'follow',
        headers,
      });
      if (!resp.ok) return null;
      if (resp.url && resp.url !== targetHref) {
        await validateSafeExternalUrl(resp.url);
      }
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
        return null;
      }
      const reader = resp.body?.getReader();
      if (!reader) return null;

      const chunks: Uint8Array[] = [];
      let total = 0;
      const maxImageBytes = 12 * 1024 * 1024;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxImageBytes) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
      }
      if (total < 64) return null;
      return {
        buffer: Buffer.concat(chunks),
        contentType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  type ProxyData = { buffer: Buffer; contentType: string };
  const firstSuccess = async (tasks: Promise<ProxyData | null>[]): Promise<ProxyData | null> =>
    new Promise((resolve) => {
      let resolved = false;
      let remaining = tasks.length;
      for (const task of tasks) {
        task
          .then((r) => {
            if (!resolved && r) {
              resolved = true;
              resolve(r);
            }
          })
          .catch(() => {})
          .finally(() => {
            remaining -= 1;
            if (!resolved && remaining <= 0) {
              resolved = true;
              resolve(null);
            }
          });
      }
    });

  const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  let imgData = await firstSuccess([
    tryDownloadImage(safeImgUrl.href, chromeUA, true, 4300),
    tryDownloadImage(safeImgUrl.href, chromeUA, false, 4300),
    tryDownloadImage(safeImgUrl.href, 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', false, 4300),
  ]);

  if (!imgData) {
    imgData = await tryDownloadImage(
      `https://wsrv.nl/?url=${encodeURIComponent(safeImgUrl.href)}&output=jpg`,
      chromeUA,
      false,
      4400
    );
  }

  if (!imgData) {
    res.statusCode = 404;
    res.end();
    return;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', imgData.contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(imgData.buffer);
}
