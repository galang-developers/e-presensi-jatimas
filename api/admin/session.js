import { getAdminSession, sendJson } from '../../server/core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Metode permintaan tidak didukung.' });
  }
  return sendJson(res, 200, { authenticated: Boolean(await getAdminSession(req)) });
}
