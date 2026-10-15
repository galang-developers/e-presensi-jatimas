import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCodePanel() {
  const appUrl = import.meta.env.VITE_APP_URL?.trim().replace(/\/$/, '');
  const [image, setImage] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    if (appUrl) QRCode.toDataURL(appUrl, { width: 240, margin: 2, color: { dark: '#123d30', light: '#ffffff' } })
      .then((url) => { if (active) setImage(url); })
      .catch(() => { if (active) setMessage('QR Code belum dapat dibuat.'); });
    return () => { active = false; };
  }, [appUrl]);

  async function copyLink() {
    try { await navigator.clipboard.writeText(appUrl); setMessage('Link berhasil disalin.'); }
    catch { setMessage('Tidak dapat menyalin link pada perangkat ini.'); }
  }

  return (
    <aside className="qr-panel">
      <div className="eyebrow">AKSES CEPAT</div>
      <h2>Buka dengan QR Code</h2>
      {image ? <img className="qr-image" src={image} alt="QR Code menuju buku tamu PKBM Jati Mas" /> :
        <div className="qr-placeholder">{appUrl ? 'Menyiapkan QR Code…' : 'QR Code akan tersedia setelah URL aplikasi diatur.'}</div>}
      {appUrl ? <div className="qr-actions">
        <button className="button button-secondary" type="button" onClick={copyLink}>Salin Link</button>
        <a className={`button button-secondary ${!image ? 'disabled-link' : ''}`} href={image || undefined} download="qr-e-presensi-jati-mas.png" aria-disabled={!image}>Unduh QR Code</a>
      </div> : <p className="qr-hint">Isi <code>VITE_APP_URL</code> dengan URL deployment publik untuk mengaktifkan QR.</p>}
      {message && <p className="form-notice" role="status">{message}</p>}
    </aside>
  );
}
