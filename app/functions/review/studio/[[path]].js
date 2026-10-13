// The studio, served for a client editing a graphic from their review link.
//
// The studios and photo libraries sit behind the team login. This path is open (like the rest of
// /review), so it only serves files when the request carries a valid review token — in the
// address (?t=) for the page, then in a cookie scoped to /review for everything the page loads —
// and only that client's own studio files plus the client list.
import { CLIENT_SLUGS } from '../../api/[[path]].js';

export async function onRequest({ request, env, params }) {
  const url = new URL(request.url);
  const parts = (params.path || []).filter(Boolean);
  const cookie = (request.headers.get('cookie') || '').match(/(?:^|;\s*)rv=([^;]+)/);
  const t = url.searchParams.get('t') || (cookie && decodeURIComponent(cookie[1]));
  const review = t ? await env.DB.prepare('SELECT client FROM reviews WHERE token = ?').bind(t).first() : null;
  if (!review) return new Response('This link isn’t valid', { status: 403 });
  const slug = CLIENT_SLUGS[review.client];
  const path = parts.join('/');
  const allowed = path === 'clients.js' || (slug && (path === slug || path.startsWith(slug + '/')));
  if (!allowed) return new Response('Not found', { status: 404 });
  // the studio page itself needs a trailing slash so its relative links (library/, art/, ../clients.js) resolve here
  if (path === slug && !url.pathname.endsWith('/')) return Response.redirect(url.origin + url.pathname + '/' + url.search, 302);
  const asset = await env.ASSETS.fetch(new Request(url.origin + '/' + path + (path === slug ? '/' : ''), request));
  const res = new Response(asset.body, asset);
  res.headers.set('cache-control', 'private, no-store');
  if (url.searchParams.get('t')) res.headers.append('set-cookie', 'rv=' + encodeURIComponent(t) + '; Path=/review; SameSite=Lax; Secure; HttpOnly');
  return res;
}
