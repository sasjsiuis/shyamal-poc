import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchProxiedImageBuffer } from './_lib/newsExtractor';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const reqUrl = new URL(req.url || '/', 'http://localhost');
  const rawImgUrl = (reqUrl.searchParams.get('url') || '').trim();
  const rawRef = (reqUrl.searchParams.get('ref') || '').trim();

  if (!rawImgUrl) {
    res.statusCode = 400;
    res.end();
    return;
  }

  const imgData = await fetchProxiedImageBuffer(rawImgUrl, rawRef);
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
