import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  lanAddress,
  removeExpired,
  shareAvailability,
  shareDir,
  type ShareFile,
  type ShareKind,
  type ShareManifest,
} from '@/lib/share-store';

/** Lets the kiosk ask, before uploading anything, whether phone sharing works here. */
export function GET() {
  return Response.json(shareAvailability());
}

const FIELDS: { field: ShareKind; base: string }[] = [
  { field: 'photo', base: 'foto' },
  { field: 'gif', base: 'gif' },
  { field: 'video', base: 'video' },
  { field: 'timelapse', base: 'timelapse' },
];

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const MAX_FILE_BYTES = 60 * 1024 * 1024;

/** Saves a finished session on this laptop and returns the link guests open on their phone. */
export async function POST(request: Request) {
  if (!shareAvailability().available) {
    return Response.json({ error: 'cloud', message: 'QR hanya aktif saat photobooth dijalankan dari laptop kiosk.' }, { status: 501 });
  }
  const host = request.headers.get('host') ?? 'localhost:3000';
  const hostname = host.replace(/:\d+$/, '');
  // Guests' phones only read. Uploads come from the kiosk screen itself (opened as localhost),
  // unless the operator opts in to a separate kiosk device.
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  if (!local && process.env.KIOSK_ALLOW_REMOTE_UPLOAD !== '1') {
    return Response.json({ error: 'not-kiosk', message: 'Unggahan hanya diterima dari laptop kiosk.' }, { status: 403 });
  }
  const port = host.includes(':') ? host.split(':').pop() : '';
  const configured = process.env.KIOSK_PUBLIC_URL?.replace(/\/$/, '');
  const ip = lanAddress();
  if (!configured && !ip) {
    return Response.json({ error: 'no-lan', message: 'Laptop kiosk belum tersambung ke WiFi.' }, { status: 503 });
  }
  const base = configured ?? `http://${ip}${port ? `:${port}` : ''}`;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'bad-form', message: 'Data unggahan tidak terbaca.' }, { status: 400 });
  }

  const id = randomUUID();
  const dir = shareDir(id);
  await fs.mkdir(dir, { recursive: true });

  const files: ShareFile[] = [];
  for (const { field, base: name } of FIELDS) {
    const value = form.get(field);
    if (!(value instanceof Blob) || value.size === 0) continue;
    const type = value.type.split(';')[0];
    const ext = EXT[type];
    if (!ext || value.size > MAX_FILE_BYTES) continue;
    const fileName = `${name}.${ext}`;
    await fs.writeFile(path.join(dir, fileName), Buffer.from(await value.arrayBuffer()));
    files.push({ kind: field, name: fileName, type, size: value.size });
  }

  if (!files.length) {
    await fs.rm(dir, { recursive: true, force: true });
    return Response.json({ error: 'empty', message: 'Tidak ada file untuk dibagikan.' }, { status: 400 });
  }

  const manifest: ShareManifest = { createdAt: Date.now(), files };
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
  removeExpired().catch(() => undefined);

  return Response.json({ id, url: `${base}/s/${id}` });
}
