import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { requireAdmin, sendJson } from '../../server/core.js';

const assets = new Map([
  ['logo-tutwuri.png', 'image/png'],
  ['logo-pkbm-jatimas.png', 'image/png'],
  ['ttd1.png', 'image/png'],
  ['ttd2.png', 'image/png'],
]);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Metode permintaan tidak didukung.' });
  }
  if (!await requireAdmin(req, res)) return;

  const asset = String(req.query?.asset || '');
  try {
    if (assets.has(asset)) {
      const assetPath = new URL(`../../server/certificate/assets/${asset}`, import.meta.url);
      const image = await readFile(assetPath);
      res.status(200).setHeader('Content-Type', assets.get(asset)).setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(image);
    }
    if (asset) return sendJson(res, 404, { error: 'Aset sertifikat tidak ditemukan.' });

    const template = await readFile(new URL('../../server/certificate/sertif.html', import.meta.url), 'utf8');
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(template);
  } catch (error) {
    console.error('admin_certificate_template_failed', { code: String(error?.code || error?.name || 'unknown') });
    return sendJson(res, 500, { error: 'Template sertifikat belum dapat dibuka.' });
  }
}
