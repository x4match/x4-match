import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/auth-cookies';

const PUBLIC_PATHS = ['/', '/login', '/register', '/precios'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  // Legacy landing URL
  if (pathname === '/bienvenida') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || (p !== '/' && pathname.startsWith(`${p}/`)),
  );

  if (!token && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (token && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/panel';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Logged-in users opening the marketing home go straight to the panel
  if (token && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/panel';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
