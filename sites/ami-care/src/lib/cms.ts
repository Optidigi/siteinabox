import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Page, SiteSettings } from './types';

const DATA_DIR = process.env.CMS_DATA_DIR ?? '/data';

async function readJson<T>(rel: string): Promise<T | null> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(DATA_DIR, rel), 'utf8');
  } catch (err: any) {
    // ENOENT (file missing) is the expected "no content yet" path — silent.
    // Any other read error is unexpected — log so operators can debug.
    if (err?.code !== 'ENOENT') {
      console.warn(`[cms] read failed for ${rel}:`, err?.message ?? err);
    }
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err: any) {
    // Corrupt JSON would otherwise vanish silently (page renders empty).
    // Loud here so operators see "Payload wrote garbage" vs "no content".
    console.error(`[cms] JSON parse failed for ${rel}:`, err?.message ?? err);
    return null;
  }
}

export async function getPage(slug: string): Promise<Page | null> {
  return readJson<Page>(`pages/${slug}.json`);
}

export async function getSite(): Promise<SiteSettings | null> {
  return readJson<SiteSettings>('site.json');
}

export function mediaPath(file: string): string {
  return path.join(DATA_DIR, 'media', file);
}
