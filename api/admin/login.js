import { createAdminCookie, credentialsMatch, sendJson } from '../../server/core.js';

const attempts = new Map();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Metode permintaan tidak didukung.' });
  }
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim().slice(0, 64) : 'local';
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 8) return sendJson(res, 429, { error: 'Terlalu banyak percobaan login. Coba lagi satu menit lagi.' });
  recent.push(now);
  attempts.set(ip, recent);
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 120 || password.length > 300 || !credentialsMatch(username, password)) {
    return sendJson(res, 401, { error: 'Username atau password tidak sesuai.' });
  }
  try {
    res.setHeader('Set-Cookie', await createAdminCookie(username));
    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('admin_login_configuration_failed', { reason: String(error?.message || 'unknown') });
    return sendJson(res, 503, { error: 'Login admin belum dikonfigurasi oleh pengelola.' });
  }
}
