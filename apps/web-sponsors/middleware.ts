import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/auth-cookies';

const SPONSORS_HOST = (process.env.NEXT_PUBLIC_SPONSORS_HOST || 'sponsor.x4match.com')
  .replace(/^https?:\/\//, '')
  .toLowerCase();
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = (request.headers.get('host')?.split(':')[0] ?? '').toLowerCase().replace(/^www\./, '');
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  const isPlatformHost =
    host === SPONSORS_HOST ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1';

  // Custom domain: rewrite root paths to /{slug}/...
  if (!isPlatformHost && !pathname.startsWith('/dashboard') && pathname !== '/login') {
    try {
      const res = await fetch(`${API_URL}/sponsors/resolve?host=${encodeURIComponent(host)}`, {
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const data = (await res.json()) as { mode?: string; sponsor?: { slug: string } };
        if (data.mode === 'custom' && data.sponsor?.slug) {
          const slug = data.sponsor.slug;
          if (!pathname.startsWith(`/${slug}`)) {
            const url = request.nextUrl.clone();
            url.pathname = `/${slug}${pathname === '/' ? '' : pathname}`;
            return NextResponse.rewrite(url);
          }
        }
      }
    } catch {
      // fall through
    }
  }

  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const isLogin = pathname === '/login' || pathname.startsWith('/login/');

  if (isDashboard && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (token && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard/resumen';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
