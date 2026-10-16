import { clearAdminCookie, sendJson } from '../../server/core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Metode permintaan tidak didukung.' });
  }
  res.setHeader('Set-Cookie', clearAdminCookie());
  return sendJson(res, 200, { success: true });
}
