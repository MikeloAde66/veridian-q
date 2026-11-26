// Gates the app behind login. "/" is the public landing page (with the
// temporary Enter button); everything else redirects there when there's no
// signed-in Supabase session. A signed-in visitor hitting "/" gets bounced
// straight into "/canvas". The gate only applies in production — local dev
// (npm run dev) always goes straight through, since the point of the gate
// is to lock the public deployment, not your own machine.
//
// TEMP BYPASS: set DISABLE_AUTH_GATE=true in Vercel's env vars to skip the
// gate in production too, while the real sign-in flow is still being sorted
// out. Flip that var off (or delete it) to turn the gate back on — no code
// change needed.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/auth/callback', '/auth/confirm', '/api/covers'];

// Every single deployment (including every production deploy) gets its own
// random one-off hostname (veridian-<hash>-mekelo-ades-projects.vercel.app)
// IN ADDITION TO the stable custom domain below -- both serve the exact same
// code, but browser storage (localStorage/IndexedDB, where projects live) is
// tied to the exact hostname, not the code. Landing on a fresh per-deployment
// URL after any redeploy -- which is very easy to do by accident (an old tab,
// a bookmarked inspector link, a shared link) -- silently looks like "all my
// projects disappeared" when really it's just a different, empty storage
// bucket under a different address. Redirecting every non-canonical hostname
// here, before anything else runs, means a project saved once is reachable
// from exactly one URL forever, instead of depending on which link happened
// to be open.
const CANONICAL_HOST = 'veridian-q.vercel.app';

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  if (host && host !== CANONICAL_HOST && host.endsWith('.vercel.app')) {
    const url = request.nextUrl.clone();
    url.protocol = 'https';
    url.host = CANONICAL_HOST;
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_AUTH_GATE === 'true') {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  if (user && path === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/canvas';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|covers/).*)',
  ],
};
