import { neon } from '@neondatabase/serverless';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();
const COOKIE = 'epresensi_admin';
const SESSION_SECONDS = 8 * 60 * 60;
let schemaReady;

export function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').setHeader('Cache-Control', 'no-store').json(body);
}

export function getSql() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
  if (!url) throw new Error('DATABASE_NOT_CONFIGURED');
  return neon(url);
}

export async function ensureSchema(sql = getSql()) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS visitor_records (
      id BIGSERIAL PRIMARY KEY,
      submission_key VARCHAR(100) UNIQUE,
      nama_lengkap VARCHAR(120) NOT NULL,
      tempat_tanggal_lahir VARCHAR(150) NOT NULL DEFAULT '',
      jabatan VARCHAR(100) NOT NULL,
      asal_instansi VARCHAR(150) NOT NULL,
      tujuan_kunjungan VARCHAR(1000) NOT NULL DEFAULT '',
      selfie_path TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`ALTER TABLE visitor_records ADD COLUMN IF NOT EXISTS tempat_tanggal_lahir VARCHAR(150) NOT NULL DEFAULT ''`;
    })().catch((error) => { schemaReady = undefined; throw error; });
  }
  await schemaReady;
  return sql;
}

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_SECRET must contain at least 32 characters');
  return encoder.encode(secret);
}

export async function createAdminCookie(username) {
  const token = await new SignJWT({ role: 'admin', username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('e-presensi-jati-mas')
    .setAudience('admin')
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(sessionSecret());
  const secure = (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') ? '; Secure' : '';
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearAdminCookie() {
  const secure = (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') ? '; Secure' : '';
  return `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export async function getAdminSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const token = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { issuer: 'e-presensi-jati-mas', audience: 'admin' });
    if (payload.role !== 'admin' || typeof payload.username !== 'string') return null;
    return { username: payload.username };
  } catch {
    return null;
  }
}

export function credentialsMatch(username, password) {
  const expectedUsername = process.env.ADMIN_USERNAME || '';
  const expectedPassword = process.env.ADMIN_PASSWORD || '';
  if (!expectedUsername || !expectedPassword || !username || !password) return false;
  // Hash both inputs first so timingSafeEqual always compares equal-length buffers.
  const actualUser = createHash('sha256').update(String(username)).digest();
  const expectedUser = createHash('sha256').update(expectedUsername).digest();
  const actualPass = createHash('sha256').update(String(password)).digest();
  const expectedPass = createHash('sha256').update(expectedPassword).digest();
  return Boolean(timingSafeEqual(actualUser, expectedUser) & timingSafeEqual(actualPass, expectedPass));
}

export async function requireAdmin(req, res) {
  const session = await getAdminSession(req);
  if (!session) {
    sendJson(res, 401, { error: 'Silakan login sebagai admin terlebih dahulu.' });
    return null;
  }
  return session;
}

export function formatVisit(row) {
  const createdAt = new Date(row.created_at);
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).formatToParts(createdAt);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return {
    id: String(row.id),
    // Display numbers are dense and are recalculated from current records after deletions.
    nomor: String(row.nomor ?? row.id),
    hariTanggal: `${part('weekday')}, ${part('day')} ${part('month')} ${part('year')}`,
    jamMasuk: new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(createdAt),
    namaLengkap: row.nama_lengkap,
    tempatTanggalLahir: row.tempat_tanggal_lahir || '',
    jabatan: row.jabatan,
    asalInstansi: row.asal_instansi,
    tujuanKunjungan: row.tujuan_kunjungan,
    createdAt: createdAt.toISOString(),
  };
}

export function escapeXml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]);
}
