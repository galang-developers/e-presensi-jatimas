import { useEffect, useRef, useState } from 'react';
import { limits, validateVisitor } from '../lib/validation.js';

const initialValues = { namaLengkap: '', tempatTanggalLahir: '', jabatan: '', asalInstansi: '', tujuanKunjungan: '', selfieDataUrl: '' };
const fields = [
  { name: 'namaLengkap', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap', required: true },
  { name: 'tempatTanggalLahir', label: 'Tempat, Tanggal Lahir', placeholder: 'Contoh: Bandung, 12 Januari 1990', required: true },
  { name: 'jabatan', label: 'Jabatan', placeholder: 'Contoh: Tutor, Pengelola', required: true },
  { name: 'asalInstansi', label: 'Asal Instansi', placeholder: 'Masukkan asal instansi', required: true },
];

async function compressSelfie(file) {
  if (!file.type.startsWith('image/')) throw new Error('Pilih file foto yang valid.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Ukuran foto maksimal 15 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('Foto tidak dapat dibaca. Coba ambil ulang selfie.'); }
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  let quality = 0.84;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 3_400_000 && quality > 0.52) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > 3_400_000) throw new Error('Foto masih terlalu besar. Coba ambil ulang dengan kamera.');
  return dataUrl;
}

export default function VisitorForm({ onSuccess }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const submissionKey = useRef(crypto.randomUUID());
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => setCameraError('Kamera belum dapat ditampilkan. Periksa izin kamera browser.'));
    }
  }, [cameraOpen]);

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  async function chooseSelfie(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    setNotice('');
    try { update('selfieDataUrl', await compressSelfie(file)); }
    catch (error) { setNotice(error.message || 'Foto tidak dapat diproses.'); }
    finally { setPhotoBusy(false); }
  }

  async function openCamera() {
    setNotice('');
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice('Kamera tidak tersedia di browser ini. Silakan pilih Upload Foto.');
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 1280 } } });
      setCameraOpen(true);
    } catch {
      setNotice('Izin kamera tidak tersedia. Izinkan akses kamera atau gunakan Upload Foto.');
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  function captureCamera() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError('Kamera belum siap. Tunggu sebentar lalu coba lagi.');
      return;
    }
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
    let quality = 0.84;
    let selfieDataUrl = canvas.toDataURL('image/jpeg', quality);
    while (selfieDataUrl.length > 3_400_000 && quality > 0.52) {
      quality -= 0.08;
      selfieDataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    if (selfieDataUrl.length > 3_400_000) {
      setCameraError('Ukuran foto terlalu besar. Silakan ambil ulang.');
      return;
    }
    update('selfieDataUrl', selfieDataUrl);
    closeCamera();
  }

  async function submit(event) {
    event.preventDefault();
    const validation = validateVisitor(values);
    setErrors(validation);
    setNotice('');
    if (Object.keys(validation).length) {
      setNotice('Mohon periksa kembali isian yang ditandai.');
      document.getElementById(Object.keys(validation)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, submissionKey: submissionKey.current }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Data belum dapat disimpan. Silakan coba kembali.');
      setValues(initialValues);
      submissionKey.current = crypto.randomUUID();
      onSuccess(result.nomor);
    } catch (error) {
      setNotice(error.message || 'Terjadi kendala saat menyimpan. Data Anda tetap tersimpan di formulir.');
    } finally { setBusy(false); }
  }

  return (
    <form className="form-card" onSubmit={submit} noValidate>
      <div className="form-heading">
        <div><div className="eyebrow">BUKU TAMU DIGITAL</div><h2>Data Pengunjung</h2></div>
        <span className="required-note"><span aria-hidden="true">*</span> Wajib diisi</span>
      </div>
      {fields.map(({ name, label, placeholder, required }) => <div className="field" key={name}>
        <label htmlFor={name}>{label}{required && <span aria-hidden="true" className="required-star"> *</span>}</label>
        <input id={name} name={name} type="text" autoComplete={name === 'namaLengkap' ? 'name' : 'off'} maxLength={limits[name]} placeholder={placeholder} value={values[name]} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} />
        {errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]}</span>}
      </div>)}
      <div className="field">
        <label htmlFor="tujuanKunjungan">Tujuan Kunjungan <span className="optional-label">(opsional)</span></label>
        <textarea id="tujuanKunjungan" name="tujuanKunjungan" rows="3" maxLength={limits.tujuanKunjungan} placeholder="Ceritakan keperluan kunjungan Anda" value={values.tujuanKunjungan} onChange={(event) => update('tujuanKunjungan', event.target.value)} aria-invalid={Boolean(errors.tujuanKunjungan)} aria-describedby={errors.tujuanKunjungan ? 'tujuanKunjungan-error' : undefined} />
        <div className="field-meta">{errors.tujuanKunjungan ? <span className="field-error" id="tujuanKunjungan-error">{errors.tujuanKunjungan}</span> : <span />}{values.tujuanKunjungan.length}/{limits.tujuanKunjungan}</div>
      </div>
      <div className="field selfie-field">
        <span className="selfie-field-label">Selfie Pengunjung <span aria-hidden="true" className="required-star">*</span></span>
        <p className="selfie-help">Ambil foto wajah lewat kamera atau unggah foto dari perangkat. Foto hanya dapat dilihat admin.</p>
        {values.selfieDataUrl && <div className="selfie-preview"><img src={values.selfieDataUrl} alt="Pratinjau selfie" /></div>}
        <div className="selfie-actions">
          <button className="button button-secondary" type="button" onClick={openCamera} disabled={photoBusy || busy}>Buka Kamera</button>
          <button className="button button-secondary" type="button" onClick={() => document.getElementById('uploadSelfie')?.click()} disabled={photoBusy || busy}>{photoBusy ? 'Memproses foto…' : 'Upload Foto'}</button>
        </div>
        <input className="visually-hidden" id="uploadSelfie" name="selfie" type="file" accept="image/*" onChange={chooseSelfie} disabled={photoBusy || busy} aria-invalid={Boolean(errors.selfieDataUrl)} />
        {errors.selfieDataUrl && <span className="field-error">{errors.selfieDataUrl}</span>}
      </div>
      {notice && <p className="form-notice error-notice" role="alert">{notice}</p>}
      <button className="button button-primary submit-button" type="submit" disabled={busy || photoBusy}>
        {busy && <span className="spinner" aria-hidden="true" />}{busy ? 'Menyimpan data…' : 'SIMPAN BUKU TAMU'}
      </button>
      <p className="privacy-note"><span aria-hidden="true">●</span> Foto dan data kunjungan hanya digunakan untuk administrasi PKBM Jati Mas.</p>
      {cameraOpen && <div className="camera-modal" role="presentation" onClick={closeCamera}><section className="camera-dialog" role="dialog" aria-modal="true" aria-label="Ambil selfie" onClick={(event) => event.stopPropagation()}><div className="camera-dialog-heading"><strong>Ambil Selfie</strong><button type="button" className="modal-close" onClick={closeCamera} aria-label="Tutup kamera">×</button></div><video ref={videoRef} autoPlay muted playsInline />{cameraError && <p className="field-error" role="alert">{cameraError}</p>}<div className="camera-dialog-actions"><button className="button button-secondary" type="button" onClick={closeCamera}>Batal</button><button className="button button-primary" type="button" onClick={captureCamera}>Ambil Foto</button></div></section></div>}
    </form>
  );
}
