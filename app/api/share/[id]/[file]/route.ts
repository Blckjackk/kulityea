import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { readManifest, shareDir } from '@/lib/share-store';

/**
 * Serves one shared file. Supports HTTP Range requests, which iPhone Safari
 * needs before it will play a video.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const manifest = await readManifest(id);
  const entry = manifest?.files.find((f) => f.name === file);
  if (!manifest || !entry) return new Response('Tidak ditemukan', { status: 404 });

  const filePath = path.join(shareDir(id), entry.name);
  const { size } = await fs.stat(filePath);
  const download = new URL(request.url).searchParams.has('unduh');
  const headers: Record<string, string> = {
    'Content-Type': entry.type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  };
  if (download) headers['Content-Disposition'] = `attachment; filename="kulityea-${entry.name}"`;

  const range = request.headers.get('range');
  const match = range?.match(/bytes=(\d*)-(\d*)/);
  if (match) {
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, 'Content-Length': String(size) } });
}
