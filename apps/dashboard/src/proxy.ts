import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const username = process.env.DASHBOARD_USERNAME;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!username || !password) return new NextResponse('Dashboard credentials are not configured.', { status: 503 });
  const expected = `Basic ${btoa(`${username}:${password}`)}`;
  if (request.headers.get('authorization') === expected) return NextResponse.next();
  return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="SiteFleet"' } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
