import type { APIRoute } from 'astro';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.CMS_DATA_DIR ?? '/data';
const MEDIA_DIR = path.join(DATA_DIR, 'media');

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf',
};

export const GET: APIRoute = async ({ params }) => {
  const rel = (params.path ?? '').replace(/^\/+/, '');
  const full = path.resolve(MEDIA_DIR, rel);
  if (!full.startsWith(MEDIA_DIR + path.sep) && full !== MEDIA_DIR) {
    return new Response('forbidden', { status: 403 });
  }
  try {
    const data = await fs.readFile(full);
    const ext = path.extname(full).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('not found', { status: 404 });
  }
};
