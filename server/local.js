import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import visitorsHandler from '../api/visitors.js';

// Load local secrets for the standalone API process. Vercel supplies its own env vars.
dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
app.all('/api/visitors', (req, res) => visitorsHandler(req, res));

// `npm start` serves the built frontend and the API from the same origin.
app.use(express.static(path.join(root, 'dist'), { index: 'index.html' }));

app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Ukuran data terlalu besar.' });
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'Format data tidak valid.' });
  return next(error);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`E-Presensi server aktif pada port ${port}`);
});
