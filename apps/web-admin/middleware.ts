import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { TOKEN_COOKIE } from '@/lib/auth-cookies';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const isLogin = pathname === '/login';

  if (!token && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (token && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/monitor';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
