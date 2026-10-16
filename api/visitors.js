import { del, put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import { ensureSchema, formatVisit, getSql, requireAdmin, sendJson } from '../server/core.js';

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_SELFIE_BYTES = 2_500_000;
const LIMITS = { namaLengkap: 120, tempatTanggalLahir: 150, jabatan: 100, asalInstansi: 150, tujuanKunjungan: 1000 };
const recentByIp = new Map();

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const fields = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    if (typeof body[key] !== 'string') return null;
    const value = body[key].trim();
    if (key === 'tujuanKunjungan' && !value) { fields[key] = ''; continue; }
    if (!value || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) return null;
    fields[key] = value;
  }
  if (typeof body.submissionKey !== 'string' || !/^[\w-]{8,100}$/.test(body.submissionKey)) return null;
  if (typeof body.selfieDataUrl !== 'string' || body.selfieDataUrl.length > MAX_SELFIE_BYTES * 1.4 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.selfieDataUrl)) return null;
  const selfie = Buffer.from(body.selfieDataUrl.slice('data:image/jpeg;base64,'.length), 'base64');
  if (selfie.length < 8 || selfie.length > MAX_SELFIE_BYTES || selfie[0] !== 0xff || selfie[1] !== 0xd8 || selfie.at(-2) !== 0xff || selfie.at(-1) !== 0xd9) return null;
  return { ...fields, submissionKey: body.submissionKey, selfie };
}

function rateLimited(ip) {
  const now = Date.now();
  const recent = (recentByIp.get(ip) || []).filter((time) => now - time < 60_000);
  if (recent.length >= 6) { recentByIp.set(ip, recent); return true; }
  recent.push(now);
  recentByIp.set(ip, recent);
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      if (!await requireAdmin(req, res)) return;
      const sql = await ensureSchema(getSql());
      const rows = await sql`SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS nomor, created_at, nama_lengkap, tempat_tanggal_lahir, jabatan, asal_instansi, tujuan_kunjungan FROM visitor_records ORDER BY created_at DESC, id DESC LIMIT 1000`;
      return sendJson(res, 200, { visitors: rows.map(formatVisit) });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'Metode permintaan tidak didukung.' });
    }
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) return sendJson(res, 415, { error: 'Format permintaan tidak didukung.' });
    let body = req.body;
    if (typeof body === 'string') {
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return sendJson(res, 413, { error: 'Foto terlalu besar. Silakan ambil ulang selfie.' });
      try { body = JSON.parse(body); } catch { return sendJson(res, 400, { error: 'Format data tidak valid.' }); }
    }
    if (Buffer.byteLength(JSON.stringify(body || {}), 'utf8') > MAX_BODY_BYTES) return sendJson(res, 413, { error: 'Foto terlalu besar. Silakan ambil ulang selfie.' });
    const visitor = validate(body);
    if (!visitor) return sendJson(res, 400, { error: 'Mohon periksa nama, jabatan, instansi, dan selfie Anda.' });
    const ipHeader = req.headers['x-forwarded-for'];
    const ip = typeof ipHeader === 'string' ? ipHeader.split(',')[0].trim().slice(0, 64) : 'local';
    if (rateLimited(ip)) return sendJson(res, 429, { error: 'Terlalu banyak pengiriman. Silakan tunggu sebentar.' });
    const sql = await ensureSchema(getSql());
    const existing = await sql`SELECT id FROM visitor_records WHERE submission_key = ${visitor.submissionKey} LIMIT 1`;
    if (existing.length) {
      const numberRows = await sql`SELECT nomor FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS nomor FROM visitor_records) numbered WHERE id = ${existing[0].id} LIMIT 1`;
      return sendJson(res, 200, { success: true, nomor: String(numberRows[0]?.nomor || '') });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_NOT_CONFIGURED');

    let uploadedPath = '';
    try {
      const blob = await put(`selfies/${randomUUID()}.jpg`, visitor.selfie, { access: 'private', contentType: 'image/jpeg', addRandomSuffix: false });
      uploadedPath = blob.pathname;
      const inserted = await sql`INSERT INTO visitor_records (submission_key, nama_lengkap, tempat_tanggal_lahir, jabatan, asal_instansi, tujuan_kunjungan, selfie_path)
        VALUES (${visitor.submissionKey}, ${visitor.namaLengkap}, ${visitor.tempatTanggalLahir}, ${visitor.jabatan}, ${visitor.asalInstansi}, ${visitor.tujuanKunjungan}, ${uploadedPath})
        ON CONFLICT (submission_key) DO NOTHING RETURNING id`;
      if (!inserted.length) {
        await del(uploadedPath, { access: 'private' });
        const duplicate = await sql`SELECT id FROM visitor_records WHERE submission_key = ${visitor.submissionKey} LIMIT 1`;
        const numberRows = duplicate.length ? await sql`SELECT nomor FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS nomor FROM visitor_records) numbered WHERE id = ${duplicate[0].id} LIMIT 1` : [];
        return sendJson(res, 200, { success: true, nomor: String(numberRows[0]?.nomor || '') });
      }
      const numberRows = await sql`SELECT nomor FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS nomor FROM visitor_records) numbered WHERE id = ${inserted[0].id} LIMIT 1`;
      return sendJson(res, 201, { success: true, nomor: String(numberRows[0]?.nomor || '') });
    } catch (error) {
      if (uploadedPath) {
        try { await del(uploadedPath, { access: 'private' }); } catch { /* keep the original storage error */ }
      }
      throw error;
    }
  } catch (error) {
    const status = Number(error?.status || error?.statusCode || 0);
    console.error('visitor_api_failed', { code: String(error?.code || error?.name || 'unknown'), status });
    if (error?.message === 'DATABASE_NOT_CONFIGURED') return sendJson(res, 503, { error: 'Database belum dikonfigurasi. Silakan hubungi pengelola.' });
    if (error?.message === 'BLOB_NOT_CONFIGURED') return sendJson(res, 503, { error: 'Penyimpanan foto belum dikonfigurasi. Silakan hubungi pengelola.' });
    return sendJson(res, 502, { error: 'Data belum dapat disimpan. Silakan coba kembali beberapa saat lagi.' });
  }
}
