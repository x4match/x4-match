import { OpenInApp } from '@/components/OpenInApp';
import { APP_SCHEME, type SharePreview } from '@/lib/share';

export function ShareLanding({
  preview,
  appPath,
  eyebrow,
  fallbackTitle,
}: {
  preview: SharePreview | null;
  /** Ruta dentro de la app, sin barra inicial (ej. `match/123`). */
  appPath: string;
  eyebrow: string;
  fallbackTitle: string;
}) {
  return (
    <OpenInApp
      eyebrow={eyebrow}
      title={preview?.title ?? fallbackTitle}
      description={preview?.description ?? 'Abrilo en la app de x4 match para ver todos los detalles.'}
      image={preview?.image}
      deepLink={`${APP_SCHEME}://${appPath}`}
    />
  );
}
