import type { Metadata } from 'next';
import { Download } from 'lucide-react';
import { readManifest, type ShareKind } from '@/lib/share-store';
import { Logo } from '@/components/Logo';
import { btnPrimary } from '@/lib/ui';

export const metadata: Metadata = {
  title: 'Fotomu | KulitYea Photobooth',
  robots: { index: false, follow: false },
};

const LABEL: Record<ShareKind, string> = {
  photo: 'Foto',
  gif: 'GIF',
  video: 'Video bingkai',
  timelapse: 'Timelapse',
};

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manifest = await readManifest(id);

  if (!manifest) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 bg-base px-5 text-ink">
        <Logo size="md" />
        <h1 className="text-4xl font-extrabold">Link sudah tidak berlaku.</h1>
        <p className="text-ink-soft">Foto hanya tersimpan 24 jam di laptop photobooth. Minta petugas booth kalau masih butuh fotonya.</p>
      </main>
    );
  }

  const date = new Date(manifest.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-base px-4 pb-10 pt-5 text-ink">
      <header className="flex items-center justify-between">
        <Logo size="md" />
        <span className="text-sm text-ink-soft">{date}</span>
      </header>

      <h1 className="mt-6 text-4xl font-extrabold leading-tight">Fotomu dari photobooth.</h1>
      <p className="mt-2 text-ink-soft">
        Tekan Simpan untuk mengunduh. Di iPhone, kamu juga bisa tekan lama fotonya lalu pilih Simpan ke Foto. Link berlaku 24 jam.
      </p>

      <div className="mt-6 space-y-5">
        {manifest.files.map((f) => {
          const src = `/api/share/${id}/${f.name}`;
          return (
            <figure key={f.name} className="overflow-hidden rounded-2xl bg-surface">
              <div className="flex justify-center bg-muted">
                {f.type.startsWith('video/') ? (
                  <video src={src} controls loop muted playsInline autoPlay className="max-h-[70dvh] w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={LABEL[f.kind]} className="max-h-[70dvh] w-auto" />
                )}
              </div>
              <figcaption className="flex items-center justify-between gap-3 p-3">
                <span className="font-semibold">{LABEL[f.kind]}</span>
                <a href={`${src}?unduh`} className={`${btnPrimary} h-12 px-5 text-sm`}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Simpan
                </a>
              </figcaption>
            </figure>
          );
        })}
      </div>

      <p className="mt-10 text-center text-sm text-ink-soft">KulitYea Photobooth · RiseUp Fest 2026</p>
    </main>
  );
}
