import { ANDROID_PACKAGE } from '@/lib/app-links';

/**
 * Android App Links. Requiere ANDROID_SHA256_CERT_FINGERPRINTS (separadas por coma): la huella
 * de la clave de firma de Play Console y, si querés probar builds de EAS, la de `eas credentials`.
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return Response.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
