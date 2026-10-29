'use client';

import { useEffect, useState } from 'react';
import { SITE } from '@/content/site';
import { PLAY_STORE_URL } from '@/lib/share';

type Platform = 'ios' | 'android' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

/**
 * Si la app está instalada, el sistema abre el link directo en la app (universal links / app
 * links) y esta página ni se ve. Si llegó acá, ofrecemos abrirla por esquema o instalarla.
 */
export function OpenInApp({
  title,
  description,
  image,
  deepLink,
  eyebrow,
}: {
  title: string;
  description: string;
  image?: string | null;
  deepLink: string;
  eyebrow: string;
}) {
  const [platform, setPlatform] = useState<Platform>('other');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const appStore = SITE.links.appStore;
  const playStore = PLAY_STORE_URL;

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-6 px-6 py-16 text-center">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="mx-auto aspect-video w-full rounded-3xl object-cover" />
      ) : null}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#D7FF00]">{eyebrow}</p>
        <h1 className="text-3xl font-extrabold leading-tight">{title}</h1>
        <p className="text-base text-neutral-400">{description}</p>
      </div>
      <div className="flex flex-col gap-3">
        <a
          href={deepLink}
          className="rounded-2xl bg-[#D7FF00] px-5 py-4 text-base font-extrabold text-black"
        >
          Abrir en x4 match
        </a>
        {platform !== 'android' ? (
          <a
            href={appStore}
            className="rounded-2xl border border-neutral-700 px-5 py-4 text-base font-bold"
          >
            Descargar en App Store
          </a>
        ) : null}
        {platform !== 'ios' ? (
          <a
            href={playStore}
            className="rounded-2xl border border-neutral-700 px-5 py-4 text-base font-bold"
          >
            Descargar en Google Play
          </a>
        ) : null}
      </div>
      <p className="text-xs text-neutral-500">
        ¿Todavía no tenés la app? Descargala, creá tu cuenta y volvé a tocar el link.
      </p>
    </section>
  );
}
