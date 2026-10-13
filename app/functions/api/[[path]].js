// Graphic Generator API — Cloudflare Pages Function.
//
// Team requests (everything except /api/review…) come through Cloudflare Access in production,
// which signs people in and adds their email to the request. The client review endpoints are
// open, but only to someone holding that month's unguessable review token.
//
//   POST /api                    { action, … }   the studio's calendar, graphics, AI and review links
//   GET  /api/file/<key>                          a stored file (graphics, the messaging guide)
//   GET  /api/review?t=…                          the month a review link shows
//   GET  /api/review/file?t=…&k=…                 a graphic on that month
//   POST /api/review             { t, postId, decision, note, name }   the client's answer
//
// Storage: D1 (DB) holds months, review links, responses and guide records; R2 (FILES) holds
// the PNGs and the guide files.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5-5';
const CLIENT_NAMES = { 'Spring Forth': 'Spring Forth Academy', 'Bakken-Young': 'Bakken-Young Funeral & Cremation Services', 'McMillan': 'McMillan Precision Electric Motors' };
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const now = () => new Date().toISOString();

export async function onRequest({ request, env, params }) {
  const parts = params.path || [];
  const url = new URL(request.url);
  try {
    if (parts[0] === 'review') {
      if (parts[1] === 'file' && request.method === 'GET') return reviewFile(env, url);
      if (request.method === 'GET') return json(await reviewGet(env, url.searchParams.get('t')));
      if (request.method === 'POST') return json(await reviewRespond(env, await request.json()));
      return json({ ok: false, error: 'method' }, 405);
    }
    const user = teamUser(request, env);
    if (!user) return json({ ok: false, error: 'Sign in through the team login first' }, 401);
    if (parts[0] === 'file' && request.method === 'GET') return fileGet(env, parts.slice(1).join('/'));
    if (parts.length === 0 && request.method === 'POST') {
      const b = await request.json();
      const fn = ACTIONS[b.action];
      if (!fn) return json({ ok: false, error: 'unknown action' }, 400);
      return json(await fn(env, b, { user, origin: url.origin }));
    }
    return json({ ok: false, error: 'not found' }, 404);
  } catch (err) {
    return json({ ok: false, error: String(err && err.message || err), data: err && err.data }, err && err.status || 500);
  }
}

// Cloudflare Access puts the signed-in person's email on every request it lets through.
function teamUser(request, env) {
  if (env.AUTH_MODE === 'off') return 'local';
  return request.headers.get('cf-access-authenticated-user-email');
}

const ACTIONS = {
  ping: async (env, b) => ({ ok: true, ai: !!env.ANTHROPIC_API_KEY || env.AI_FAKE === '1', guide: !!(await guideRow(env, b.client)), app: true }),

  // ---------- graphics ----------
  save: async (env, b) => {
    const key = ['graphics', b.client, b.month, b.filename].join('/');
    await env.FILES.put(key, b64ToBytes(b.png), { httpMetadata: { contentType: 'image/png' } });
    return { ok: true, id: key, url: '/api/file/' + encodeURIComponent(key) };
  },
  status: async (env, b) => {
    const prefix = ['graphics', b.client, b.month].join('/') + '/';
    const list = await env.FILES.list({ prefix });
    return { ok: true, files: list.objects.map(o => o.key.slice(prefix.length)) };
  },

  // ---------- the shared calendar ----------
  'cal.list': async (env, b) => {
    const r = await env.DB.prepare('SELECT month, rev, updated_at FROM months WHERE client = ? ORDER BY month').bind(b.client).all();
    return { ok: true, months: r.results.map(x => ({ month: x.month, rev: x.rev, updatedAt: x.updated_at })) };
  },
  'cal.get': async (env, b) => ({ ok: true, data: await monthData(env, b.client, b.month) }),
  'cal.save': async (env, b) => {
    const cur = await monthData(env, b.client, b.month);
    if ((cur ? cur.rev : 0) !== (b.rev || 0)) throw Object.assign(new Error('conflict'), { status: 409, data: cur });
    const rev = (cur ? cur.rev : 0) + 1, at = now();
    const data = Object.assign({}, b.data);
    delete data.rev; delete data.month; delete data.updatedAt;
    // a save from the studio can't wipe out the client's answers that arrived meanwhile
    if (cur) for (const p of data.posts || []) { const was = (cur.posts || []).find(x => x.id === p.id); if (!was) continue;
      if (was.client && !p.client) p.client = was.client;
      if ((was.clientComments || []).length > (p.clientComments || []).length) p.clientComments = was.clientComments; }
    const res = await env.DB.prepare(
      `INSERT INTO months (client, month, data, rev, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (client, month) DO UPDATE SET data = excluded.data, rev = excluded.rev, updated_at = excluded.updated_at
       WHERE months.rev = ?`).bind(b.client, b.month, JSON.stringify(data), rev, at, rev - 1).run();
    if (!res.meta.changes) throw Object.assign(new Error('conflict'), { status: 409, data: await monthData(env, b.client, b.month) });
    return { ok: true, rev, updatedAt: at };
  },

  // ---------- the messaging guide ----------
  'guide.save': async (env, b) => {
    const ext = b.mime === 'application/pdf' ? 'pdf' : 'txt';
    const key = ['guides', b.client, 'messaging-guide.' + ext].join('/');
    await env.FILES.put(key, b64ToBytes(b.data), { httpMetadata: { contentType: b.mime } });
    await env.DB.prepare(`INSERT INTO guides (client, r2_key, mime, name, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (client) DO UPDATE SET r2_key = excluded.r2_key, mime = excluded.mime, name = excluded.name, updated_at = excluded.updated_at`)
      .bind(b.client, key, b.mime, b.name, now()).run();
    return { ok: true };
  },
  'guide.get': async (env, b) => {
    const g = await guideRow(env, b.client);
    return { ok: true, guide: g ? { name: g.name, updatedAt: g.updated_at, url: '/api/file/' + encodeURIComponent(g.r2_key) } : null };
  },

  // ---------- drafting with Claude ----------
  'ai.draft': async (env, b) => {
    const already = (b.already || []).map(p => '- ' + p.iso + ' [' + p.bucket + '] ' + p.hook + ': ' + String(p.post).slice(0, 140)).join('\n');
    const user =
      'Draft posts for ' + b.month + ', one for each of these dates:\n' +
      b.dates.map(d => '- ' + d.iso + ' (' + d.day + ')').join('\n') + '\n\n' +
      (b.notes ? 'What is happening this month (use these; do not add others): ' + b.notes + '\n\n' : '') +
      (already ? 'Already written for this month (do not repeat these topics, hooks or openings):\n' + already + '\n\n' : '') +
      'Across the month, balance the buckets, include enrollment and practical parent help where it fits the client, and fit the ' +
      'season (holidays and moments in ' + b.month + '). Use each date exactly as given.';
    return { ok: true, posts: await claude(env, b, user, 16000) };
  },
  'ai.rewrite': async (env, b) => {
    const p = b.post;
    const user =
      'Rewrite this post. Instruction: ' + (b.instruction || 'make it better') + '\n\n' +
      'Date: ' + p.iso + '\nBucket: ' + p.bucket + '\nHook: ' + p.hook + '\nPhoto idea: ' + (p.photoIdea || '') + '\nCaption:\n' + p.post +
      '\n\nReturn exactly one post with the same date.';
    return { ok: true, posts: await claude(env, b, user, 8000) };
  },

  // ---------- client review links ----------
  'review.create': async (env, b, ctx) => {
    // one link per month: making it again returns the same link, so one already sent keeps working
    const had = await env.DB.prepare('SELECT token FROM reviews WHERE client = ? AND month = ? ORDER BY created_at LIMIT 1').bind(b.client, b.month).first();
    const token = had ? had.token : randomToken();
    if (!had) await env.DB.prepare('INSERT INTO reviews (token, client, month, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(token, b.client, b.month, ctx.user, now()).run();
    return { ok: true, url: ctx.origin + '/review/?t=' + token };
  },
};

// ---------- helpers ----------
async function monthData(env, client, month) {
  const r = await env.DB.prepare('SELECT data, rev, updated_at FROM months WHERE client = ? AND month = ?').bind(client, month).first();
  if (!r) return null;
  return Object.assign(JSON.parse(r.data), { month, rev: r.rev, updatedAt: r.updated_at });
}
function guideRow(env, client) {
  return client ? env.DB.prepare('SELECT * FROM guides WHERE client = ?').bind(client).first() : null;
}
async function fileGet(env, key) {
  const obj = await env.FILES.get(decodeURIComponent(key));
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'application/octet-stream', 'cache-control': 'private, max-age=3600' } });
}
function b64ToBytes(b64) {
  const bin = atob(b64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(buf) {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------- Claude ----------
const POST_SCHEMA = {
  type: 'object',
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          iso: { type: 'string', description: 'The post date, YYYY-MM-DD, exactly as given' },
          bucket: { type: 'string' },
          hook: { type: 'string', description: 'The headline printed on the graphic, 3 to 10 words' },
          post: { type: 'string', description: 'The caption' },
          photoIdea: { type: 'string', description: 'One short line describing the photo to pair with it' },
        },
        required: ['iso', 'bucket', 'hook', 'post', 'photoIdea'],
        additionalProperties: false,
      },
    },
  },
  required: ['posts'],
  additionalProperties: false,
};

// AI_FAKE=1 (local testing only, in .dev.vars): sample posts instead of calling Claude
function fakePosts(b) {
  if (b.post) return [Object.assign({}, b.post, { post: '(rewritten: ' + b.instruction + ') ' + b.post.post })];
  return b.dates.map((d, i) => ({ iso: d.iso, bucket: (b.buckets || ['Post'])[((b.already || []).length + i) % (b.buckets || ['Post']).length],
    hook: 'Sample hook for ' + d.iso.slice(5), post: 'Sample post for ' + d.iso + (b.notes ? ' \u2014 ' + b.notes : '') + '.\n\nCall to action.',
    photoIdea: 'a child reading a book at a table' }));
}

async function claude(env, b, userText, maxTokens) {
  if (env.AI_FAKE === '1' && !env.ANTHROPIC_API_KEY) return fakePosts(b);
  if (!env.ANTHROPIC_API_KEY) throw new Error('No Anthropic API key is set up yet');
  const examples = (b.examples || []).map(p => '[' + p.bucket + '] ' + (p.hook ? 'Hook: ' + p.hook + '\n' : '') + p.post).join('\n\n---\n\n');
  const system = [{ type: 'text', text:
    'You write social media posts for ' + (b.clientFull || b.client) + '. A person on the agency team reviews every draft before it ' +
    'is posted, so write strong first drafts they only need to tweak.\n\n' +
    'Voice: follow the messaging guide when there is one; it is authoritative. The past posts show the voice, rhythm, length, ' +
    'audience and recurring programs in practice. Match how they sound.\n\n' +
    'Facts: never invent events, dates, names, statistics, prices or quotes. You may mention programs and traditions that appear ' +
    'in the guide or the past posts. When a post needs a detail you do not have, write [CONFIRM: what is needed] in its place.\n\n' +
    'Each post has: a bucket (one of: ' + (b.buckets || []).join(', ') + '); a hook, the headline printed on the graphic, 3 to 10 ' +
    'words, no hashtags or emojis; the caption, written like the past posts, usually 60 to 150 words, short paragraphs, ending with ' +
    'a clear call to action, hashtags only if the past posts use them; and a photo idea, one short line describing an ordinary photo ' +
    'from their own library that would suit it (for example: a child working on math at a desk; families at a project table).' }];
  if (examples) system.push({ type: 'text', text: 'PAST POSTS:\n\n' + examples });

  // the guide: text joins the system prompt; a PDF (a document block) leads the user message
  const content = [];
  const g = await guideRow(env, b.client);
  if (g) {
    const obj = await env.FILES.get(g.r2_key);
    if (obj) {
      if (g.mime === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytesToB64(await obj.arrayBuffer()) }, title: 'Messaging guide' });
      else system.push({ type: 'text', text: 'MESSAGING GUIDE:\n' + await obj.text() });
    }
  }
  // everything before the varying request is the same for a whole month's drafting: cache it
  (content.length ? content : system)[(content.length ? content : system).length - 1].cache_control = { type: 'ephemeral' };
  content.push({ type: 'text', text: userText });

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let res;
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      // if a safety classifier declines, the API retries on its recommended fallback model
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: POST_SCHEMA } },
      system,
      messages: [{ role: 'user', content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('The Anthropic API key was rejected');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Claude is busy right now — try again in a minute');
    if (err instanceof Anthropic.APIError) throw new Error('Claude API error ' + err.status + ': ' + err.message);
    throw err;
  }
  if (res.stop_reason === 'refusal') throw new Error('Claude declined to write this one');
  if (res.stop_reason === 'max_tokens') throw new Error('The draft ran too long; try fewer posts at a time');
  const text = res.content.filter(c => c.type === 'text').map(c => c.text).join('');
  return JSON.parse(text).posts;
}

// ---------- the client review page's endpoints ----------
async function reviewByToken(env, t) {
  if (!t) return null;
  return env.DB.prepare('SELECT * FROM reviews WHERE token = ?').bind(t).first();
}
async function reviewGet(env, t) {
  const r = await reviewByToken(env, t);
  if (!r) return { ok: false, error: 'This review link isn’t valid' };
  const data = await monthData(env, r.client, r.month);
  if (!data) return { ok: false, error: 'This month isn’t available' };
  const [y, m] = r.month.split('-').map(Number);
  const label = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const rows = (await env.DB.prepare('SELECT post_id, decision, note, name, created_at FROM responses WHERE token = ? ORDER BY id').bind(t).all()).results;
  const thread = id => rows.filter(x => x.post_id === id && (x.note || x.decision !== 'comment'))
    .map(x => ({ decision: x.decision, note: x.note, name: x.name, at: x.created_at }));
  const full = (CLIENT_NAMES[r.client] || r.client);
  return { ok: true, client: r.client, clientFull: full, month: r.month, label,
    posts: (data.posts || []).slice().sort((a, b2) => a.iso < b2.iso ? -1 : 1).map(p => ({
      id: p.id, iso: p.iso, bucket: p.bucket, hook: p.noHead ? '' : p.hook, post: p.post,
      graphic: p.graphic && p.graphic.id ? '/api/review/file?t=' + encodeURIComponent(t) + '&k=' + encodeURIComponent(p.graphic.id) : null,
      client: p.client || null, thread: thread(p.id) })) };
}
async function reviewFile(env, url) {
  const t = url.searchParams.get('t'), k = url.searchParams.get('k');
  const r = await reviewByToken(env, t);
  if (!r) return new Response('Not found', { status: 404 });
  const data = await monthData(env, r.client, r.month);
  // only the graphics on this link's own month
  if (!data || !(data.posts || []).some(p => p.graphic && p.graphic.id === k)) return new Response('Not found', { status: 404 });
  return fileGet(env, encodeURIComponent(k));
}
async function reviewRespond(env, b) {
  const r = await reviewByToken(env, b.t);
  if (!r) return { ok: false, error: 'This review link isn’t valid' };
  // approved | changes | declined set the post's status; comment is feedback without a decision
  if (!['approved', 'changes', 'declined', 'comment'].includes(b.decision)) return { ok: false, error: 'decision' };
  if ((b.decision === 'changes' || b.decision === 'comment') && !String(b.note || '').trim()) return { ok: false, error: 'Please write your feedback first' };
  const at = now(), note = String(b.note || '').slice(0, 4000), name = String(b.name || '').slice(0, 120);
  await env.DB.prepare('INSERT INTO responses (token, post_id, decision, note, name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(b.t, b.postId, b.decision, note, name, at).run();
  // the answer also goes on the post itself, so the team sees it in the calendar
  for (let attempt = 0; attempt < 3; attempt++) {
    const data = await monthData(env, r.client, r.month);
    const post = data && (data.posts || []).find(p => p.id === b.postId);
    if (!post) return { ok: false, error: 'That post isn’t on this month any more' };
    if (b.decision !== 'comment') post.client = { decision: b.decision, note, name, at };
    post.clientComments = (post.clientComments || []).concat(note ? [{ decision: b.decision, note, name, at }] : []).slice(-30);
    const rev = data.rev + 1, store = Object.assign({}, data); delete store.rev; delete store.month; delete store.updatedAt;
    const res = await env.DB.prepare('UPDATE months SET data = ?, rev = ?, updated_at = ? WHERE client = ? AND month = ? AND rev = ?')
      .bind(JSON.stringify(store), rev, at, r.client, r.month, data.rev).run();
    if (res.meta.changes) return { ok: true, client: post.client || null, entry: { decision: b.decision, note, name, at } };
  }
  return { ok: false, error: 'Please try again' };
}
