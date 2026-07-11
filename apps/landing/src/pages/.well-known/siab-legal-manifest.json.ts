import { createPublicLegalManifest } from '../../lib/legal';

export const prerender = true;

export function GET() {
  return new Response(`${JSON.stringify(createPublicLegalManifest(), null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, must-revalidate',
    },
  });
}
