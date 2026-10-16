import { ensureSchema, escapeXml, formatVisit, getSql, requireAdmin, sendJson } from '../server/core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Metode permintaan tidak didukung.' });
  }
  if (!await requireAdmin(req, res)) return;
  try {
    const sql = await ensureSchema(getSql());
    const rows = await sql`SELECT id, created_at, nama_lengkap, tempat_tanggal_lahir, jabatan, asal_instansi, tujuan_kunjungan FROM visitor_records ORDER BY created_at ASC, id ASC`;
    const headers = ['Nomor', 'Hari/Tanggal', 'Jam Masuk', 'Nama Lengkap', 'Tempat, Tanggal Lahir', 'Jabatan', 'Asal Instansi', 'Tujuan Kunjungan'];
    const cells = (items) => `<Row>${items.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join('')}</Row>`;
    const dataRows = rows.map(formatVisit).map((visit) => cells([
      visit.nomor, visit.hariTanggal, visit.jamMasuk, visit.namaLengkap, visit.tempatTanggalLahir, visit.jabatan, visit.asalInstansi, visit.tujuanKunjungan,
    ])).join('');
    const document = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Buku Tamu"><Table>${cells(headers)}${dataRows}</Table></Worksheet></Workbook>`;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    res.status(200).setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8').setHeader('Content-Disposition', `attachment; filename="buku-tamu-${date}.xls"`).setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(`\uFEFF${document}`);
  } catch (error) {
    console.error('visitor_export_failed', { code: String(error?.code || error?.name || 'unknown') });
    return sendJson(res, 502, { error: 'Data belum dapat diekspor. Silakan coba kembali.' });
  }
}
