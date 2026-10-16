import { del } from '@vercel/blob';
import { ensureSchema, getSql, requireAdmin, sendJson } from '../../server/core.js';

const LIMITS = { namaLengkap: 120, tempatTanggalLahir: 150, jabatan: 100, asalInstansi: 150, tujuanKunjungan: 1000 };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'PUT, DELETE');
    return sendJson(res, 405, { error: 'Metode permintaan tidak didukung.' });
  }
  if (!await requireAdmin(req, res)) return;
  // Vercel supplies the dynamic segment through query; the local Express adapter uses params.
  const id = String(req.params?.id || req.query?.id || '');
  if (!/^\d{1,18}$/.test(id)) return sendJson(res, 400, { error: 'Nomor data tidak valid.' });
  try {
    const sql = await ensureSchema(getSql());
    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return sendJson(res, 400, { error: 'Format data tidak valid.' }); } }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return sendJson(res, 400, { error: 'Data perubahan tidak valid.' });
      const values = {};
      for (const [key, max] of Object.entries(LIMITS)) {
        if (typeof body[key] !== 'string') return sendJson(res, 400, { error: 'Lengkapi seluruh data pengunjung.' });
        const value = body[key].trim();
        if ((key !== 'tujuanKunjungan' && !value) || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) return sendJson(res, 400, { error: 'Periksa kembali data dan batas panjang isian.' });
        values[key] = value;
      }
      const updated = await sql`UPDATE visitor_records SET nama_lengkap = ${values.namaLengkap}, tempat_tanggal_lahir = ${values.tempatTanggalLahir}, jabatan = ${values.jabatan}, asal_instansi = ${values.asalInstansi}, tujuan_kunjungan = ${values.tujuanKunjungan} WHERE id = ${id} RETURNING id`;
      if (!updated.length) return sendJson(res, 404, { error: 'Data pengunjung tidak ditemukan.' });
      return sendJson(res, 200, { success: true });
    }
    const rows = await sql`DELETE FROM visitor_records WHERE id = ${id} RETURNING selfie_path`;
    if (!rows.length) return sendJson(res, 404, { error: 'Data pengunjung tidak ditemukan.' });
    try { await del(rows[0].selfie_path, { access: 'private' }); }
    catch (error) { console.error('visitor_photo_delete_failed', { code: String(error?.code || error?.name || 'unknown') }); }
    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('visitor_record_mutation_failed', { code: String(error?.code || error?.name || 'unknown') });
    return sendJson(res, 502, { error: 'Perubahan data belum dapat disimpan. Silakan coba kembali.' });
  }
}
