import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register');

    if (isAuthPage && token) {
      const role = token.role;
      if (role === 'admin') {
        return NextResponse.redirect(new URL('/dashboardAdmin', req.url));
      }
      return NextResponse.redirect(new URL('/profile', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const isAuthPage = req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register');
        if (isAuthPage) return true;
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/monitor/:path*',
    '/profile/:path*',
    '/dashboardAdmin/:path*',
    '/api/monitor/:path*',
    '/api/dashboardAdmin/:path*',
    '/api/user/:path*',
    '/login',
    '/register',
  ],
};
