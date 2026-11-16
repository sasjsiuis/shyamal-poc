import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractNewsFromTargetUrl,
  fetchProxiedImageBuffer,
} from './api/_lib/newsExtractor.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.disable('x-powered-by');

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/extract', async (req: Request, res: Response) => {
    const rawUrl = String(req.query.url || '').trim();
    const result = await extractNewsFromTargetUrl(rawUrl);
    res.status(200).json(result);
  });

  app.get('/api/proxy-image', async (req: Request, res: Response) => {
    const rawImgUrl = String(req.query.url || '').trim();
    const rawRef = String(req.query.ref || '').trim();

    if (!rawImgUrl) {
      res.status(400).end();
      return;
    }

    const imgData = await fetchProxiedImageBuffer(rawImgUrl, rawRef);
    if (!imgData) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', imgData.contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(imgData.buffer);
  });

  // Serve static assets from public/ (templates, fonts, sample images)
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
