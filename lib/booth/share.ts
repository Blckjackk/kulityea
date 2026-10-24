import type { Outputs } from './types';

/** False when the app runs on a cloud host, where Wi-Fi sharing cannot work. */
export async function shareAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/share', { cache: 'no-store' });
    const data = (await res.json()) as { available?: boolean };
    return data.available !== false;
  } catch {
    return true;
  }
}

/** Sends the finished files to the kiosk's own server and returns the phone link. */
export async function uploadSession(outputs: Outputs): Promise<string> {
  const form = new FormData();
  const add = async (field: string, url?: string) => {
    if (!url) return;
    const blob = await (await fetch(url)).blob();
    form.append(field, blob, field);
  };
  await Promise.all([
    add('photo', outputs.photoUrl),
    add('gif', outputs.gifUrl),
    add('video', outputs.videoUrl),
    add('timelapse', outputs.timelapseUrl),
  ]);

  let res: Response;
  try {
    res = await fetch('/api/share', { method: 'POST', body: form });
  } catch {
    throw new Error('Server photobooth tidak merespons.');
  }
  const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
  if (!res.ok || !data.url) throw new Error(data.message ?? 'Gagal menyiapkan link unduhan.');
  return data.url;
}
