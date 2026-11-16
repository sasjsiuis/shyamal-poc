import type { IncomingMessage, ServerResponse } from 'node:http';
import { extractNewsFromTargetUrl } from './_lib/newsExtractor';

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

  try {
    const result = await extractNewsFromTargetUrl(rawUrl);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(result));
  } catch {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ title: '', image: '', proxiedImage: '', siteName: '' }));
  }
}
