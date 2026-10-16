import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import adminLogin from '../api/admin/login.js';
import adminLogout from '../api/admin/logout.js';
import adminSession from '../api/admin/session.js';
import adminCertificate from '../api/admin/certificate.js';
import visitors from '../api/visitors.js';
import visitorsExport from '../api/visitors-export.js';
import visitorPhoto from '../api/visitor-photo.js';
import visitorRecord from '../api/visitors/[id].js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.all('/api/visitors', (req, res) => visitors(req, res));
app.all('/api/visitors/:id', (req, res) => visitorRecord(req, res));
app.all('/api/admin/login', (req, res) => adminLogin(req, res));
app.all('/api/admin/session', (req, res) => adminSession(req, res));
app.all('/api/admin/certificate', (req, res) => adminCertificate(req, res));
app.all('/api/admin/logout', (req, res) => adminLogout(req, res));
app.all('/api/visitors-export', (req, res) => visitorsExport(req, res));
app.all('/api/visitor-photo', (req, res) => visitorPhoto(req, res));

const dist = path.join(root, 'dist');
app.use(express.static(dist));
app.get(/^\/admin\/?$/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Foto terlalu besar. Silakan ambil ulang selfie.' });
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Format data tidak valid.' });
  return next(error);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`E-Presensi server aktif pada port ${port}`);
});
