import { google } from 'googleapis';

const HEADERS = ['Nomor', 'Hari/Tanggal', 'Jam Masuk', 'Nama Lengkap', 'Jabatan', 'Asal Instansi', 'Tujuan Kunjungan'];
const LIMITS = { namaLengkap: 120, jabatan: 100, asalInstansi: 150, tujuanKunjungan: 1000 };
const recentRequests = new Map();
const requestTimes = new Map();
const MAX_BODY_BYTES = 8 * 1024;

// Warna dalam format hex {red, green, blue} dengan skala 0-255 → dikonversi ke 0-1
function hex(color) {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  return { red: r, green: g, blue: b };
}

const COLOR_HEADER_BG = hex(0x145C45);   // hijau tua
const COLOR_HEADER_FG = hex(0xFFFFFF);   // putih
const COLOR_ROW_BG = hex(0xFFFFFF);      // putih
const COLOR_ROW_FG = hex(0x111111);      // hitam (bukan putih!)

function jakartaTimestamp(now = new Date()) {
  const dateParts = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).formatToParts(now);
  const part = (type) => dateParts.find((item) => item.type === type)?.value || '';
  const date = `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}`;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  return { hariTanggal: date, jamMasuk: time };
}

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').setHeader('Cache-Control', 'no-store').json(body);
}

function validate(body) {
  const result = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    if (typeof body?.[key] !== 'string') return null;
    const value = body[key].trim();
    if (!value || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) return null;
    result[key] = value;
  }
  return result;
}

function isRateLimited(key) {
  const now = Date.now();
  for (const [ip, times] of requestTimes) {
    const valid = times.filter((time) => now - time < 60_000);
    if (valid.length) requestTimes.set(ip, valid); else requestTimes.delete(ip);
  }
  const times = requestTimes.get(key) || [];
  if (times.length >= 8) return true;
  times.push(now);
  requestTimes.set(key, times);
  return false;
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) throw new Error('CONFIG');
  return new google.auth.JWT({ email, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
}

export default async function handler(req, res) {
  res.setHeader('Allow', 'POST');
  if (req.method !== 'POST') return send(res, 405, { error: 'Metode permintaan tidak didukung.' });
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('application/json')) return send(res, 415, { error: 'Format permintaan tidak didukung.' });
  const rawLength = Number(req.headers['content-length'] || 0);
  if (rawLength > MAX_BODY_BYTES) return send(res, 413, { error: 'Ukuran data terlalu besar.' });
  let body = req.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return send(res, 413, { error: 'Ukuran data terlalu besar.' });
    try { body = JSON.parse(body); } catch { return send(res, 400, { error: 'Format data tidak valid.' }); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) return send(res, 400, { error: 'Format data tidak valid.' });
  const visitor = validate(body);
  if (!visitor) return send(res, 400, { error: 'Mohon isi seluruh kolom dengan benar dan sesuai batas karakter.' });

  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim().slice(0, 64) : 'unknown';
  if (isRateLimited(ip)) return send(res, 429, { error: 'Terlalu banyak pengiriman. Silakan tunggu sebentar sebelum mencoba lagi.' });
  const requestId = req.headers['idempotency-key'];
  const key = typeof requestId === 'string' && /^[\w-]{8,100}$/.test(requestId) ? `${ip}:${requestId}` : '';
  const now = Date.now();
  for (const [id, entry] of recentRequests) if (entry.expiresAt <= now) recentRequests.delete(id);
  if (key && recentRequests.has(key)) {
    const existing = recentRequests.get(key);
    if (existing.status === 'done') return send(res, 200, { success: true });
    if (existing.status === 'working') return send(res, 409, { error: 'Pengiriman sedang diproses. Mohon tunggu sebentar.' });
  }
  if (key) recentRequests.set(key, { status: 'working', expiresAt: now + 10 * 60_000 });

  let step = 'configuration';
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const sheetName = (process.env.GOOGLE_SHEETS_SHEET_NAME || 'Buku Tamu').trim();
    if (!spreadsheetId) throw new Error('CONFIG');
    const auth = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const title = `'${sheetName.replace(/'/g, "''")}'`;
    step = 'get_sheet';
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
    const sheet = spreadsheet.data.sheets?.find((item) => item.properties?.title?.trim().toLocaleLowerCase('id-ID') === sheetName.toLocaleLowerCase('id-ID'));
    if (!sheet) {
      console.error('visitor_sheet_not_found', { configuredSheetName: sheetName, availableSheetNames: (spreadsheet.data.sheets || []).map((item) => item.properties?.title).filter(Boolean) });
      throw new Error('SHEET_NOT_FOUND');
    }
    step = 'read_headers';
    const headerResponse = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${title}!A1:G1` });
    const configuredHeaders = headerResponse.data?.values?.[0] || [];
    const headersMatch = HEADERS.every((header, index) => {
      const actual = String(configuredHeaders[index] || '').trim().toLocaleLowerCase('id-ID');
      if (index === 0) return ['nomor', 'no'].includes(actual);
      return actual === header.toLocaleLowerCase('id-ID');
    });
    if (!headersMatch) throw new Error('SHEET_HEADERS');
    const { hariTanggal, jamMasuk } = jakartaTimestamp();
    const row = ['PENDING', hariTanggal, jamMasuk, visitor.namaLengkap, visitor.jabatan, visitor.asalInstansi, visitor.tujuanKunjungan];
    step = 'append_row';
    const appended = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${title}!A:G`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { majorDimension: 'ROWS', values: [row] },
    });
    const updatedRange = appended.data?.updates?.updatedRange || '';
    const match = updatedRange.match(/![A-Z]+(\d+):[A-Z]+\d+$/);
    const sheetRow = match ? Number(match[1]) : 0;
    if (!sheetRow || sheetRow < 2) throw new Error('APPEND_RANGE');
    const nomor = String(sheetRow - 1);
    step = 'write_number';
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A${sheetRow}`,
      valueInputOption: 'RAW',
      requestBody: { majorDimension: 'ROWS', values: [[nomor]] },
    });

    // === FORMAT: paksa hitam di putih untuk baris data, putih di hijau untuk header ===
    // Formatting is best-effort; a formatting failure must not turn a saved visit into a failure.
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            // Header (baris 1) — background hijau, teks putih, bold, center
            {
              repeatCell: {
                range: { sheetId: sheet.properties.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: COLOR_HEADER_BG,
                    textFormat: { foregroundColor: COLOR_HEADER_FG, bold: true },
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment',
              },
            },
            // Baris data (2 s/d sheetRow) — background putih, teks HITAM
            {
              repeatCell: {
                range: { sheetId: sheet.properties.sheetId, startRowIndex: 1, endRowIndex: sheetRow, startColumnIndex: 0, endColumnIndex: 7 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: COLOR_ROW_BG,
                    textFormat: { foregroundColor: COLOR_ROW_FG },
                    verticalAlignment: 'MIDDLE',
                  },
                },
                fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat,userEnteredFormat.verticalAlignment',
              },
            },
            // Kolom A (Nomor) pakai format TEXT biar tidak auto-jadi angka/putih
            {
              repeatCell: {
                range: { sheetId: sheet.properties.sheetId, startRowIndex: 1, endRowIndex: sheetRow, startColumnIndex: 0, endColumnIndex: 1 },
                cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
                fields: 'userEnteredFormat.numberFormat',
              },
            },
            // Kolom B, C (Hari/Tanggal, Jam Masuk) — rata kiri
            {
              repeatCell: {
                range: { sheetId: sheet.properties.sheetId, startRowIndex: 1, endRowIndex: sheetRow, startColumnIndex: 1, endColumnIndex: 3 },
                cell: { userEnteredFormat: { horizontalAlignment: 'LEFT' } },
                fields: 'userEnteredFormat.horizontalAlignment',
              },
            },
            // Kolom G (Tujuan) — wrap text biar tidak overflow
            {
              repeatCell: {
                range: { sheetId: sheet.properties.sheetId, startRowIndex: 1, endRowIndex: sheetRow, startColumnIndex: 6, endColumnIndex: 7 },
                cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
                fields: 'userEnteredFormat.wrapStrategy',
              },
            },
          ],
        },
      });
    } catch (formatError) {
      console.error('visitor_formatting_failed', { code: String(formatError?.code || ''), status: Number(formatError?.response?.status || 0) });
    }

    if (key) recentRequests.set(key, { status: 'done', expiresAt: Date.now() + 10 * 60_000 });
    const savedRange = appended.data?.updates?.updatedRange || `${sheetName}!A${sheetRow}:G${sheetRow}`;
    console.info('visitor_saved', { sheetName, savedRange, nomor });
    return send(res, 201, { success: true, savedRange, nomor });
  } catch (error) {
    if (key) recentRequests.delete(key);
    const status = Number(error?.response?.status || error?.response?.data?.error?.code || (Number(error?.code) || 0));
    const reason = error?.response?.data?.error?.errors?.[0]?.reason || error?.response?.data?.error?.status || '';
    const code = error?.code;
    console.error('visitor_save_failed', { step, code: String(code || ''), status, reason: String(reason) });
    if (error?.message === 'SHEET_HEADERS') return send(res, 503, { error: 'Susunan header Google Sheets belum sesuai. Pastikan kolom A sampai G berurutan: NO atau Nomor, Hari/Tanggal, Jam Masuk, Nama Lengkap, Jabatan, Asal Instansi, Tujuan Kunjungan.' });
    if (error?.message === 'SHEET_NOT_FOUND') return send(res, 503, { error: `Worksheet "${process.env.GOOGLE_SHEETS_SHEET_NAME || 'Buku Tamu'}" tidak ditemukan. Periksa nama tab pada spreadsheet.` });
    if (error?.message === 'CONFIG' || status === 401 || status === 403 || /invalid_grant|private key|DECODER|PEM/i.test(String(error?.message || ''))) {
      return send(res, 503, { error: 'Autentikasi Google gagal. Periksa GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, izin Editor Service Account, dan status Google Sheets API.' });
    }
    if (status === 404) return send(res, 503, { error: 'Spreadsheet tidak ditemukan. Periksa GOOGLE_SHEETS_SPREADSHEET_ID.' });
    if (status === 400 && step === 'read_headers') return send(res, 503, { error: 'Worksheet tidak ditemukan atau nama GOOGLE_SHEETS_SHEET_NAME tidak cocok. Periksa ejaan nama tab spreadsheet.' });
    if (status === 400) return send(res, 503, { error: 'Google Sheets menolak format atau rentang data. Periksa nama worksheet dan header kolom A sampai G.' });
    return send(res, 502, { error: 'Data belum dapat disimpan. Silakan coba kembali beberapa saat lagi.' });
  }
}

export { HEADERS, jakartaTimestamp };