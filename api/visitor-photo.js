import { get } from '@vercel/blob';
import { Readable } from 'node:stream';
import { ensureSchema, getSql, requireAdmin, sendJson } from '../server/core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Metode permintaan tidak didukung.' });
  }
  if (!await requireAdmin(req, res)) return;
  const id = String(req.query?.id || '');
  if (!/^\d{1,18}$/.test(id)) return sendJson(res, 400, { error: 'Nomor data tidak valid.' });
  try {
    const sql = await ensureSchema(getSql());
    const rows = await sql`SELECT selfie_path FROM visitor_records WHERE id = ${id} LIMIT 1`;
    if (!rows.length) return sendJson(res, 404, { error: 'Foto tidak ditemukan.' });
    const blob = await get(rows[0].selfie_path, { access: 'private' });
    if (!blob || blob.statusCode !== 200) return sendJson(res, 404, { error: 'Foto tidak ditemukan.' });
    res.status(200).setHeader('Content-Type', 'image/jpeg').setHeader('X-Content-Type-Options', 'nosniff').setHeader('Content-Disposition', 'inline; filename="selfie.jpg"');
    return Readable.fromWeb(blob.stream).pipe(res);
  } catch (error) {
    console.error('visitor_photo_failed', { code: String(error?.code || error?.name || 'unknown') });
    return sendJson(res, 502, { error: 'Foto belum dapat dibuka.' });
  }
}
