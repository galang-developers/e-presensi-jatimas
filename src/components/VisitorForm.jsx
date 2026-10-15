import { useState } from 'react';
import { limits, validateVisitor } from '../lib/validation.js';

const initialValues = { namaLengkap: '', jabatan: '', asalInstansi: '', tujuanKunjungan: '' };
const fields = [
  { name: 'namaLengkap', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap' },
  { name: 'jabatan', label: 'Jabatan', placeholder: 'Contoh: Tutor, Pengelola' },
  { name: 'asalInstansi', label: 'Asal Instansi', placeholder: 'Masukkan asal instansi' },
];

export default function VisitorForm({ onSuccess }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
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
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Data belum dapat disimpan. Silakan coba kembali.');
      setValues(initialValues);
      onSuccess();
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
      {fields.map(({ name, label, placeholder }) => <div className="field" key={name}>
        <label htmlFor={name}>{label}<span aria-hidden="true" className="required-star"> *</span></label>
        <input id={name} name={name} type="text" autoComplete={name === 'namaLengkap' ? 'name' : 'off'} maxLength={limits[name]} placeholder={placeholder} value={values[name]} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} />
        {errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]}</span>}
      </div>)}
      <div className="field">
        <label htmlFor="tujuanKunjungan">Tujuan Kunjungan<span aria-hidden="true" className="required-star"> *</span></label>
        <textarea id="tujuanKunjungan" name="tujuanKunjungan" rows="4" maxLength={limits.tujuanKunjungan} placeholder="Ceritakan keperluan kunjungan Anda" value={values.tujuanKunjungan} onChange={(event) => update('tujuanKunjungan', event.target.value)} aria-invalid={Boolean(errors.tujuanKunjungan)} aria-describedby={errors.tujuanKunjungan ? 'tujuanKunjungan-error' : undefined} />
        <div className="field-meta">{errors.tujuanKunjungan ? <span className="field-error" id="tujuanKunjungan-error">{errors.tujuanKunjungan}</span> : <span />}{values.tujuanKunjungan.length}/{limits.tujuanKunjungan}</div>
      </div>
      {notice && <p className="form-notice error-notice" role="alert">{notice}</p>}
      <button className="button button-primary submit-button" type="submit" disabled={busy}>
        {busy && <span className="spinner" aria-hidden="true" />}{busy ? 'Menyimpan data…' : 'SIMPAN BUKU TAMU'}
      </button>
      <p className="privacy-note"><span aria-hidden="true">●</span> Data kunjungan tersimpan dengan aman untuk keperluan administrasi.</p>
    </form>
  );
}
