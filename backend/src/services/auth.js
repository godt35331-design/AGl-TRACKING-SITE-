import crypto from 'crypto';

/**
 * Minimal signed-session helpers (no extra dependencies).
 *
 * A token is `base64url(payload).base64url(HMAC-SHA256(payload))`, where the payload
 * holds { role, email, trackingNumber, exp }. The server never trusts anything a client
 * sends about who it is — only a token it signed itself.
 *
 * Required environment variables (set them in Render):
 *   AUTH_SECRET          long random string used to sign sessions
 *   ADMIN_TRACKING_CODE  the secret code the administrator types to sign in
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches the front end

let secret = (process.env.AUTH_SECRET || '').trim();
if (!secret) {
  secret = crypto.randomBytes(32).toString('hex');
  console.warn('[AUTH] AUTH_SECRET is not set. Using a temporary secret: everyone is signed out whenever the server restarts. Set AUTH_SECRET in your environment.');
} else if (secret.length < 24) {
  console.warn('[AUTH] AUTH_SECRET is short. Use at least 32 random characters.');
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');

/** Compare two strings without leaking how many characters matched. */
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function signToken({ role, email, trackingNumber }) {
  const payload = b64(JSON.stringify({ role, email, trackingNumber: trackingNumber || '', exp: Date.now() + SESSION_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || !data.role || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/** Adds req.user when a valid token is present; never rejects. */
export function attachUser(req, _res, next) {
  req.user = verifyToken(bearer(req));
  next();
}

export function requireUser(req, res, next) {
  const user = verifyToken(bearer(req));
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  const user = verifyToken(bearer(req));
  if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
  if (user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  req.user = user;
  next();
}

/** The administrator's sign-in code, or '' when the server has not been configured. */
export function getAdminCode() {
  return (process.env.ADMIN_TRACKING_CODE || process.env.ADMIN_TRACKING_NUMBER || '').trim().toUpperCase();
}

export function getAdminEmail() {
  return (process.env.ADMIN_EMAIL || 'admin@aglgloballogistics.com').trim().toLowerCase();
}

export function warnIfAdminMisconfigured() {
  const code = getAdminCode();
  if (!code) {
    console.warn('[AUTH] ADMIN_TRACKING_CODE is not set: administrator sign-in is DISABLED until you add it to your environment.');
  } else if (code.length < 12) {
    console.warn('[AUTH] ADMIN_TRACKING_CODE is short. Use 16+ random characters so it cannot be guessed.');
  }
}

/* ---------------- login attempt limiter (per client address) ---------------- */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED = 8;
const attempts = new Map(); // ip -> { count, resetAt }

export function loginLimiter(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.resetAt > now && rec.count >= MAX_FAILED) {
    const mins = Math.ceil((rec.resetAt - now) / 60000);
    return res.status(429).json({ error: `Too many attempts. Please try again in ${mins} minute${mins === 1 ? '' : 's'}.` });
  }
  req.recordFailedLogin = () => {
    const cur = attempts.get(ip);
    if (!cur || cur.resetAt <= now) attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    else cur.count += 1;
  };
  req.clearFailedLogins = () => attempts.delete(ip);
  next();
}

/* ---------------- public tracking lookups: slow down number guessing ---------------- */

const LOOKUP_WINDOW_MS = 10 * 60 * 1000;
const LOOKUP_MAX = 120;
const lookups = new Map(); // ip -> { count, resetAt }

export function lookupLimiter(req, res, next) {
  if (req.user && req.user.role) return next(); // signed-in users are not throttled
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  let rec = lookups.get(ip);
  if (!rec || rec.resetAt <= now) { rec = { count: 0, resetAt: now + LOOKUP_WINDOW_MS }; lookups.set(ip, rec); }
  rec.count += 1;
  if (rec.count > LOOKUP_MAX) {
    return res.status(429).json({ error: 'Too many tracking lookups. Please wait a few minutes and try again.' });
  }
  next();
}
// keep the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of attempts) if (rec.resetAt <= now) attempts.delete(ip);
  for (const [ip, rec] of lookups) if (rec.resetAt <= now) lookups.delete(ip);
}, 5 * 60 * 1000).unref();
