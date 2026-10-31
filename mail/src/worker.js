import PostalMime from 'postal-mime';
import pageHtml from './page.html';
import appJs from './app.js';

const DOMAIN = 'hongspaces.com';
const RESERVED = new Set(['admin','postmaster','abuse','webmaster','root','mail','support','noreply','no-reply','www','api','static','cdn','test','null','undefined','one','verify','verification','otp','code','auth','login','confirm','confirmation','activate','activation','signup','register','security','2fa','mfa','captcha','notify','notification','notifications','alert','alerts','mailer','bounce']);
const MAX_RAW = 1_500_000;
const MAX_MAILBOX_MSGS = 80;
const MAX_PREVIEW = 180;
const TTL_MS = 24 * 60 * 60 * 1000;
/** Local-parts starting with this prefix (case-insensitive) never auto-expire or auto-delete. */
const PERMANENT_PREFIX = 'hong';
/** Far-future expires_at sentinel (~year 275760); purge also filters by prefix. */
const PERMANENT_EXPIRES_AT = 8640000000000000;
const RATE = {
  // claim: unlimited per user request (no create throttling)
  api: { n: 300, w: 60_000 },
  inbound: { n: 40, w: 3600_000 },
};
const LOCAL_RE = /^[a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?$/i;

function securityHeaders() {
  return {
    // img-src stays same-origin + data/blob: remote images go through /api/img proxy; cid via /api/message/.../cid/
    'content-security-policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...securityHeaders() },
  });
}

function clientIp(req) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
}

async function rateLimit(env, key, lim) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?').bind(key).first();
  if (!row || now - row.window_start > lim.w) {
    await env.DB.prepare('INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)').bind(key, now).run();
    return true;
  }
  if (row.count >= lim.n) return false;
  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return true;
}


function isPermanentLocal(local) {
  return String(local || '').toLowerCase().startsWith(PERMANENT_PREFIX);
}

function mailboxExpiresAt(local, now = Date.now()) {
  return isPermanentLocal(local) ? PERMANENT_EXPIRES_AT : now + TTL_MS;
}

function normalizeLocal(raw) {
  if (!raw) return null;
  let s = String(raw).trim().toLowerCase();
  if (s.includes('@')) s = s.split('@')[0];
  s = s.replace(/[^a-z0-9._-]/g, '');
  if (!s || s.length < 3 || s.length > 32 || !LOCAL_RE.test(s)) return null;
  if (RESERVED.has(s)) return null;
  return s;
}

function randomLocal() {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  for (const b of arr) out += alphabet[b % alphabet.length];
  return out;
}

function id() {
  return crypto.randomUUID().replace(/-/g, '');
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin, salt) {
  return sha256(`${salt}:${pin}`);
}

async function hashToken(token) {
  return sha256(`tok:${token}`);
}

function timingSafeEq(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

async function ensureMailbox(env, local) {
  const now = Date.now();
  let box = await env.DB.prepare('SELECT * FROM mailboxes WHERE local = ?').bind(local).first();
  if (!box) {
    await env.DB.prepare(
      'INSERT INTO mailboxes (local, pin_hash, pin_salt, token_hash, created_at, last_access, expires_at) VALUES (?, NULL, NULL, NULL, ?, ?, ?)'
    ).bind(local, now, now, mailboxExpiresAt(local, now)).run();
    box = await env.DB.prepare('SELECT * FROM mailboxes WHERE local = ?').bind(local).first();
  }
  return box;
}

async function touchMailbox(env, local) {
  const now = Date.now();
  await env.DB.prepare('UPDATE mailboxes SET last_access = ?, expires_at = ? WHERE local = ?')
    .bind(now, mailboxExpiresAt(local, now), local).run();
}

function parseCookie(s) {
  const o = {};
  for (const part of s.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    o[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return o;
}

async function authorized(env, req, local) {
  const box = await env.DB.prepare('SELECT * FROM mailboxes WHERE local = ?').bind(local).first();
  if (!box) return { ok: true, box: null };
  if (!box.pin_hash) return { ok: true, box };
  const url = new URL(req.url);
  const auth = req.headers.get('authorization') || '';
  let token = req.headers.get('x-mailbox-token') || url.searchParams.get('tok') || '';
  if (auth.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim();
  const cookie = parseCookie(req.headers.get('cookie') || '')[`mb_${local}`];
  if (cookie) token = token || cookie;
  if (!token || !box.token_hash) return { ok: false, box, needPin: true };
  const th = await hashToken(token);
  if (!timingSafeEq(th, box.token_hash)) return { ok: false, box, needPin: true };
  return { ok: true, box };
}

async function purgeExpired(env) {
  const now = Date.now();
  const old = await env.DB.prepare('SELECT local FROM mailboxes WHERE expires_at < ? LIMIT 200').bind(now).all();
  for (const row of old.results || []) {
    if (isPermanentLocal(row.local)) {
      // Repair any stale expires_at so cron never picks them up again
      await env.DB.prepare('UPDATE mailboxes SET expires_at = ? WHERE local = ?')
        .bind(PERMANENT_EXPIRES_AT, row.local).run();
      continue;
    }
    const msgs = await env.DB.prepare('SELECT id, r2_key FROM messages WHERE local = ?').bind(row.local).all();
    for (const m of msgs.results || []) {
      try { await env.MAIL_BUCKET.delete(m.r2_key); } catch {}
    }
    await env.DB.prepare('DELETE FROM messages WHERE local = ?').bind(row.local).run();
    await env.DB.prepare('DELETE FROM mailboxes WHERE local = ?').bind(row.local).run();
    try { await deleteEmailRoute(env, row.local); } catch {}
  }
  // Stale message sweep: keep mail belonging to permanent (Hong*) mailboxes
  const stale = await env.DB.prepare(
    'SELECT id, r2_key, local FROM messages WHERE received_at < ? LIMIT 300'
  ).bind(now - TTL_MS).all();
  for (const m of stale.results || []) {
    if (isPermanentLocal(m.local)) continue;
    try { await env.MAIL_BUCKET.delete(m.r2_key); } catch {}
    await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(m.id).run();
  }
}

async function readRaw(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RAW) {
      try { reader.cancel(); } catch {}
      const err = new Error('too_large');
      throw err;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.byteLength; }
  return out;
}


async function ensureEmailRoute(env, local) {
  const token = env.CF_API_TOKEN;
  const zone = env.CF_ZONE_ID || '1dc40ba63f9c52c5a50352829426fd10';
  if (!token) return { skipped: true };
  const address = `${local}@${DOMAIN}`;
  // list existing rules (first page)
  const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/email/routing/rules?per_page=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = await listRes.json().catch(() => ({}));
  const rules = list.result || [];
  const exists = rules.some((r) => (r.matchers || []).some((m) => m.type === 'literal' && m.value === address) &&
    (r.actions || []).some((a) => a.type === 'worker' && (a.value || []).includes('hongui-mail')));
  if (exists) return { ok: true, existed: true };
  const createRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/email/routing/rules`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `hongui-mail:${local}`,
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: address }],
      actions: [{ type: 'worker', value: ['hongui-mail'] }],
    }),
  });
  const body = await createRes.json().catch(() => ({}));
  return { ok: !!body.success, status: createRes.status, body };
}


async function deleteEmailRoute(env, local) {
  const token = env.CF_API_TOKEN;
  const zone = env.CF_ZONE_ID || '1dc40ba63f9c52c5a50352829426fd10';
  if (!token) return;
  const address = `${local}@${DOMAIN}`;
  let page = 1;
  while (page <= 5) {
    const listRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/email/routing/rules?page=${page}&per_page=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const list = await listRes.json().catch(() => ({}));
    const rules = list.result || [];
    for (const r of rules) {
      const match = (r.matchers || []).some((m) => m.type === 'literal' && m.value === address);
      const isOurs = (r.name || '').startsWith('hongui-mail:') || (r.actions || []).some((a) => a.type === 'worker' && (a.value || []).includes('hongui-mail'));
      if (match && isOurs && r.id) {
        await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/email/routing/rules/${r.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
    if (rules.length < 50) break;
    page += 1;
  }
}

function sanitizeHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/\son[a-z]+=("|')[\s\S]*?\1/gi, '')
    .replace(/\son[a-z]+=([^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, 'data:text/plain')
    .slice(0, 400_000);
}

function normalizeCid(cid) {
  return String(cid || '').replace(/^<|>$/g, '').trim().toLowerCase();
}

function rewriteEmailHtml(html, { local, msgId, token }) {
  if (!html) return '';
  const tokQ = token ? `&tok=${encodeURIComponent(token)}` : '';
  // cid: inline images -> same-origin attachment endpoint
  let out = html.replace(/(\s(?:src|href)\s*=\s*)(["'])cid:([^"']+)\2/gi, (_, pre, q, cid) => {
    const clean = normalizeCid(cid);
    return `${pre}${q}/api/message/${msgId}/cid/${encodeURIComponent(clean)}?box=${encodeURIComponent(local)}${tokQ}${q}`;
  });
  out = out.replace(/(\s(?:src|href)\s*=\s*)(cid:[^\s>]+)/gi, (_, pre, cidRaw) => {
    const clean = normalizeCid(cidRaw.replace(/^cid:/i, ''));
    return `${pre}"/api/message/${msgId}/cid/${encodeURIComponent(clean)}?box=${encodeURIComponent(local)}${tokQ}"`;
  });
  // remote http(s) images -> careful same-origin proxy (blocks scripts via content-type check)
  out = out.replace(/(\s(?:src)\s*=\s*)(["'])(https?:\/\/[^"']+)\2/gi, (_, pre, q, url) => {
    return `${pre}${q}/api/img?box=${encodeURIComponent(local)}&u=${encodeURIComponent(url)}${tokQ}${q}`;
  });
  out = out.replace(/(\ssrc\s*=\s*)(https?:\/\/[^\s>]+)/gi, (_, pre, url) => {
    const clean = url.replace(/[>"']+$/, '');
    return `${pre}"/api/img?box=${encodeURIComponent(local)}&u=${encodeURIComponent(clean)}${tokQ}"`;
  });
  return out;
}

function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === 'metadata.google.internal') return true;
  // bare IPv4
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = m.slice(1).map(Number);
    if (a[0] === 10) return true;
    if (a[0] === 127) return true;
    if (a[0] === 0) return true;
    if (a[0] === 169 && a[1] === 254) return true;
    if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) return true;
    if (a[0] === 192 && a[1] === 168) return true;
  }
  return false;
}

async function proxyRemoteImage(req, env, local) {
  const url = new URL(req.url);
  const target = url.searchParams.get('u') || '';
  let parsed;
  try { parsed = new URL(target); } catch { return json({ error: '无效图片地址' }, 400); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return json({ error: '仅支持 http(s) 图片' }, 400);
  if (isPrivateHost(parsed.hostname)) return json({ error: '禁止内网地址' }, 400);
  if (!(await rateLimit(env, `img:${clientIp(req)}`, { n: 60, w: 60_000 }))) return json({ error: '请求过于频繁' }, 429);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'accept': 'image/*,*/*;q=0.1',
        'user-agent': 'HONGUI-Mail-ImageProxy/1.0',
      },
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!upstream.ok) return new Response('upstream error', { status: 502, headers: securityHeaders() });
    const ctype = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ctype.startsWith('image/') || ctype.includes('svg')) {
      return new Response('not an image', { status: 415, headers: securityHeaders() });
    }
    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > 2_000_000) return new Response('too large', { status: 413, headers: securityHeaders() });
    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': ctype,
        'cache-control': 'private, max-age=300',
        'x-content-type-options': 'nosniff',
        ...securityHeaders(),
      },
    });
  } catch {
    return new Response('fetch failed', { status: 502, headers: securityHeaders() });
  } finally {
    clearTimeout(timer);
  }
}

async function serveCidPart(env, req, local, msgId, cidRaw) {
  const row = await env.DB.prepare('SELECT * FROM messages WHERE id = ? AND local = ?').bind(msgId, local).first();
  if (!row) return json({ error: '未找到' }, 404);
  const obj = await env.MAIL_BUCKET.get(row.r2_key);
  if (!obj) return json({ error: '正文缺失' }, 404);
  const parsed = await PostalMime.parse(await obj.arrayBuffer());
  const want = normalizeCid(cidRaw);
  const att = (parsed.attachments || []).find((a) => normalizeCid(a.contentId) === want);
  if (!att || !att.content) return json({ error: '附件未找到' }, 404);
  const mime = (att.mimeType || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (!mime.startsWith('image/') || mime.includes('svg')) return json({ error: '仅支持图片附件' }, 415);
  const bytes = att.content instanceof ArrayBuffer ? att.content : att.content.buffer
    ? att.content.buffer.slice(att.content.byteOffset, att.content.byteOffset + att.content.byteLength)
    : att.content;
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': mime,
      'cache-control': 'private, max-age=600',
      'x-content-type-options': 'nosniff',
      ...securityHeaders(),
    },
  });
}

export default {
  async email(message, env, ctx) {
    try {
      const to = (message.to || '').toLowerCase();
      const local = normalizeLocal(to.split('@')[0] || '');
      if (!local) { message.setReject('Address not available'); return; }
      if (message.rawSize && message.rawSize > MAX_RAW) { message.setReject('Message too large'); return; }
      if (!(await rateLimit(env, `in:${local}`, RATE.inbound))) { message.setReject('Rate limited'); return; }

      let raw;
      try { raw = await readRaw(message.raw); }
      catch { message.setReject('Message too large'); return; }

      const parsed = await PostalMime.parse(raw);
      const msgId = id();
      const r2Key = `mail/${local}/${msgId}.eml`;
      await env.MAIL_BUCKET.put(r2Key, raw, {
        httpMetadata: { contentType: 'message/rfc822' },
        customMetadata: { from: message.from || '', to },
      });

      const subject = (parsed.subject || message.headers.get('subject') || '').slice(0, 500);
      const fromAddr = (parsed.from?.address || message.from || '').slice(0, 320);
      const text = (parsed.text || '').replace(/\s+/g, ' ').trim();
      const preview = text.slice(0, MAX_PREVIEW);
      const now = Date.now();

      await ensureMailbox(env, local);
      await touchMailbox(env, local);
      await env.DB.prepare(
        `INSERT INTO messages (id, local, from_addr, to_addr, subject, received_at, size, r2_key, preview, has_html)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(msgId, local, fromAddr, to, subject, now, raw.byteLength, r2Key, preview, parsed.html ? 1 : 0).run();

      if (!isPermanentLocal(local)) {
        const cnt = await env.DB.prepare('SELECT COUNT(*) AS c FROM messages WHERE local = ?').bind(local).first();
        if (cnt && cnt.c > MAX_MAILBOX_MSGS) {
          const drop = await env.DB.prepare(
            'SELECT id, r2_key FROM messages WHERE local = ? ORDER BY received_at ASC LIMIT ?'
          ).bind(local, cnt.c - MAX_MAILBOX_MSGS).all();
          for (const m of drop.results || []) {
            try { await env.MAIL_BUCKET.delete(m.r2_key); } catch {}
            await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(m.id).run();
          }
        }
      }
      ctx.waitUntil(purgeExpired(env));
    } catch (e) {
      console.error('email handler', e);
      message.setReject('Temporary processing error');
    }
  },

  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    ctx.waitUntil(purgeExpired(env));

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: securityHeaders() });

    const ip = clientIp(req);
    if (url.pathname.startsWith('/api/')) {
      if (!(await rateLimit(env, `api:${ip}`, RATE.api))) return json({ error: '请求过于频繁' }, 429);
    }

    try {
      if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/' || url.pathname === '')) {
        return new Response(req.method === 'HEAD' ? null : pageHtml, {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...securityHeaders() },
        });
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/app.js') {
        return new Response(req.method === 'HEAD' ? null : appJs, {
          headers: { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store', ...securityHeaders() },
        });
      }
      if (url.pathname === '/api/health') return json({ ok: true, service: 'hongui-mail' });

      if (url.pathname === '/api/claim' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        let local = body.local ? normalizeLocal(body.local) : randomLocal();
        if (body.local && !local) return json({ error: '前缀不可用（保留名或格式错误）' }, 400);
        if (!body.local) {
          for (let i = 0; i < 5; i++) {
            const existing = await env.DB.prepare('SELECT local FROM mailboxes WHERE local = ?').bind(local).first();
            if (!existing) break;
            local = randomLocal();
          }
        }
        const box = await ensureMailbox(env, local);
        await touchMailbox(env, local);
        const route = await ensureEmailRoute(env, local);
        return json({ local, address: `${local}@${DOMAIN}`, protected: !!(box && box.pin_hash), ttlHours: isPermanentLocal(local) ? null : 24, permanent: isPermanentLocal(local), routed: !!(route && (route.ok || route.existed || route.skipped)) });
      }

      if (url.pathname === '/api/pin' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const local = normalizeLocal(body.local);
        if (!local) return json({ error: '邮箱无效' }, 400);
        const pin = String(body.pin || '');
        if (pin && (pin.length < 4 || pin.length > 64)) return json({ error: 'PIN 需 4–64 位' }, 400);
        await ensureMailbox(env, local);
        const auth = await authorized(env, req, local);
        if (auth.box?.pin_hash && !auth.ok) return json({ error: '需要先解锁', needPin: true }, 401);
        if (!pin) {
          await env.DB.prepare('UPDATE mailboxes SET pin_hash = NULL, pin_salt = NULL, token_hash = NULL WHERE local = ?').bind(local).run();
          await touchMailbox(env, local);
          return json({ ok: true, protected: false });
        }
        const salt = id();
        const pin_hash = await hashPin(pin, salt);
        const token = id() + id();
        const token_hash = await hashToken(token);
        await env.DB.prepare('UPDATE mailboxes SET pin_hash = ?, pin_salt = ?, token_hash = ? WHERE local = ?')
          .bind(pin_hash, salt, token_hash, local).run();
        await touchMailbox(env, local);
        return json({ ok: true, protected: true, token });
      }

      if (url.pathname === '/api/unlock' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}));
        const local = normalizeLocal(body.local);
        const pin = String(body.pin || '');
        if (!local || !pin) return json({ error: '参数不完整' }, 400);
        const box = await env.DB.prepare('SELECT * FROM mailboxes WHERE local = ?').bind(local).first();
        if (!box || !box.pin_hash) return json({ error: '无需解锁' }, 400);
        const h = await hashPin(pin, box.pin_salt || '');
        if (!timingSafeEq(h, box.pin_hash)) return json({ error: 'PIN 错误' }, 401);
        const token = id() + id();
        const token_hash = await hashToken(token);
        await env.DB.prepare('UPDATE mailboxes SET token_hash = ? WHERE local = ?').bind(token_hash, local).run();
        await touchMailbox(env, local);
        return json({ ok: true, token });
      }

      if (url.pathname === '/api/inbox') {
        const local = normalizeLocal(url.searchParams.get('box'));
        if (!local) return json({ error: '邮箱无效' }, 400);
        const auth = await authorized(env, req, local);
        if (auth.box?.pin_hash && !auth.ok) return json({ error: '需要 PIN', needPin: true }, 401);

        if (req.method === 'DELETE') {
          const msgs = await env.DB.prepare('SELECT id, r2_key FROM messages WHERE local = ?').bind(local).all();
          for (const m of msgs.results || []) {
            try { await env.MAIL_BUCKET.delete(m.r2_key); } catch {}
          }
          await env.DB.prepare('DELETE FROM messages WHERE local = ?').bind(local).run();
          await touchMailbox(env, local);
          return json({ ok: true });
        }
        if (req.method !== 'GET') return json({ error: '方法不允许' }, 405);
        await ensureMailbox(env, local);
        await touchMailbox(env, local);
        const rows = await env.DB.prepare(
          'SELECT id, from_addr, to_addr, subject, received_at, size, preview, has_html FROM messages WHERE local = ? ORDER BY received_at DESC LIMIT ?'
        ).bind(local, MAX_MAILBOX_MSGS).all();
        return json({ local, address: `${local}@${DOMAIN}`, protected: !!(auth.box && auth.box.pin_hash), messages: rows.results || [] });
      }

      if (url.pathname.startsWith('/api/message/')) {
        const msgId = url.pathname.split('/')[3];
        if (!msgId || !/^[a-f0-9]{32}$/i.test(msgId)) return json({ error: '无效 ID' }, 400);
        const local = normalizeLocal(url.searchParams.get('box'));
        if (!local) return json({ error: '邮箱无效' }, 400);
        const auth = await authorized(env, req, local);
        if (auth.box?.pin_hash && !auth.ok) return json({ error: '需要 PIN', needPin: true }, 401);
        const row = await env.DB.prepare('SELECT * FROM messages WHERE id = ? AND local = ?').bind(msgId, local).first();
        if (!row) return json({ error: '未找到' }, 404);
        if (req.method === 'DELETE') {
          try { await env.MAIL_BUCKET.delete(row.r2_key); } catch {}
          await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(msgId).run();
          return json({ ok: true });
        }
        if (req.method !== 'GET') return json({ error: '方法不允许' }, 405);
        const obj = await env.MAIL_BUCKET.get(row.r2_key);
        let text = row.preview || '';
        let html = '';
        if (obj) {
          const parsed = await PostalMime.parse(await obj.arrayBuffer());
          text = parsed.text || text;
          const tok = req.headers.get('x-mailbox-token')
            || parseCookie(req.headers.get('cookie') || '')[`mb_${local}`]
            || url.searchParams.get('tok')
            || '';
          html = rewriteEmailHtml(sanitizeHtml(parsed.html || ''), { local, msgId, token: tok });
        }
        await touchMailbox(env, local);
        return json({ id: row.id, from_addr: row.from_addr, to_addr: row.to_addr, subject: row.subject, received_at: row.received_at, size: row.size, text, html });
      }

      // CID inline image from stored .eml
      if (url.pathname.match(/^\/api\/message\/[a-f0-9]{32}\/cid\//i) && req.method === 'GET') {
        const parts = url.pathname.split('/');
        const msgId = parts[3];
        const cid = decodeURIComponent(parts[5] || '');
        const local = normalizeLocal(url.searchParams.get('box'));
        if (!local || !msgId) return json({ error: '参数无效' }, 400);
        const auth = await authorized(env, req, local);
        if (auth.box?.pin_hash && !auth.ok) return json({ error: '需要 PIN', needPin: true }, 401);
        return serveCidPart(env, req, local, msgId, cid);
      }

      // Careful remote image proxy for HTML reader
      if (url.pathname === '/api/img' && req.method === 'GET') {
        const local = normalizeLocal(url.searchParams.get('box'));
        if (!local) return json({ error: '邮箱无效' }, 400);
        const auth = await authorized(env, req, local);
        if (auth.box?.pin_hash && !auth.ok) return json({ error: '需要 PIN', needPin: true }, 401);
        return proxyRemoteImage(req, env, local);
      }

      return json({ error: '未找到' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: '服务器错误' }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(purgeExpired(env));
  },
};
