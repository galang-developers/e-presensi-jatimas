import { useCallback, useEffect, useMemo, useState } from 'react';

function ErrorNotice({ children }) {
  return children ? <p className="form-notice error-notice" role="alert">{children}</p> : null;
}

function LoginPanel({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Login gagal. Periksa kembali username dan password.');
      onLogin();
    } catch (reason) { setError(reason.message || 'Login belum dapat dilakukan.'); }
    finally { setBusy(false); }
  }
  return <section className="login-card">
    <div className="eyebrow">AREA PENGELOLA</div><h1>Login Admin</h1>
    <p>Masuk untuk melihat data kunjungan dan mengunduh rekap buku tamu.</p>
    <form onSubmit={submit}>
      <div className="field"><label htmlFor="admin-username">Username</label><input id="admin-username" autoComplete="username" maxLength={120} value={username} onChange={(event) => setUsername(event.target.value)} required /></div>
      <div className="field"><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" maxLength={300} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
      <ErrorNotice>{error}</ErrorNotice>
      <button className="button button-primary submit-button" disabled={busy}>{busy ? 'Memeriksa…' : 'MASUK'}</button>
    </form>
    <a className="text-link back-link" href="/">Kembali ke Form Buku Tamu</a>
  </section>;
}

function VisitorDashboard({ onLogout }) {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [photoId, setPhotoId] = useState('');
  const [editing, setEditing] = useState(null);
  const [editValues, setEditValues] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadVisitors = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/visitors', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) return onLogout();
      if (!response.ok) throw new Error(result.error || 'Data buku tamu belum dapat dimuat.');
      setVisitors(result.visitors || []);
    } catch (reason) { setError(reason.message || 'Data buku tamu belum dapat dimuat.'); }
    finally { setLoading(false); }
  }, [onLogout]);

  useEffect(() => { loadVisitors(); }, [loadVisitors]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('id-ID');
    if (!term) return visitors;
    return visitors.filter((visitor) => [visitor.namaLengkap, visitor.tempatTanggalLahir, visitor.jabatan, visitor.asalInstansi, visitor.hariTanggal].join(' ').toLocaleLowerCase('id-ID').includes(term));
  }, [query, visitors]);

  async function exportExcel() {
    setExporting(true);
    setError('');
    try {
      const response = await fetch('/api/visitors-export', { credentials: 'same-origin', cache: 'no-store' });
      if (response.status === 401) return onLogout();
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'File Excel belum dapat dibuat.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `buku-tamu-${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) { setError(reason.message || 'File Excel belum dapat dibuat.'); }
    finally { setExporting(false); }
  }

  function startEdit(visitor) {
    setEditing(visitor);
    setEditValues({ namaLengkap: visitor.namaLengkap, tempatTanggalLahir: visitor.tempatTanggalLahir || '', jabatan: visitor.jabatan, asalInstansi: visitor.asalInstansi, tujuanKunjungan: visitor.tujuanKunjungan || '' });
    setError('');
  }

  async function saveEdit(event) {
    event.preventDefault();
    setSavingEdit(true);
    setError('');
    try {
      const response = await fetch(`/api/visitors/${encodeURIComponent(editing.id)}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editValues) });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) return onLogout();
      if (!response.ok) throw new Error(result.error || 'Perubahan belum dapat disimpan.');
      setEditing(null);
      setEditValues(null);
      await loadVisitors();
    } catch (reason) { setError(reason.message || 'Perubahan belum dapat disimpan.'); }
    finally { setSavingEdit(false); }
  }

  async function deleteVisitor(visitor) {
    if (!window.confirm(`Hapus data kunjungan ${visitor.namaLengkap}? Foto selfienya juga akan dihapus.`)) return;
    setError('');
    try {
      const response = await fetch(`/api/visitors/${encodeURIComponent(visitor.id)}`, { method: 'DELETE', credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) return onLogout();
      if (!response.ok) throw new Error(result.error || 'Data belum dapat dihapus.');
      setVisitors((current) => current.filter((item) => item.id !== visitor.id));
    } catch (reason) { setError(reason.message || 'Data belum dapat dihapus.'); }
  }

  return <section className="admin-dashboard">
    <div className="dashboard-topline"><div><div className="eyebrow">PKBM JATI MAS</div><h1>Dashboard Buku Tamu</h1><p>Daftar kunjungan yang sudah dikirim melalui formulir.</p></div><button className="button button-secondary" type="button" onClick={onLogout}>Keluar</button></div>
    <ErrorNotice>{error}</ErrorNotice>
    <div className="dashboard-toolbar">
      <label className="search-box"><span className="visually-hidden">Cari pengunjung</span><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama, jabatan, instansi…" /></label>
      <div className="toolbar-actions"><span className="record-count">{visitors.length} kunjungan</span><button className="button button-primary export-button" type="button" onClick={exportExcel} disabled={exporting}>{exporting ? 'Menyiapkan…' : 'Unduh Excel'}</button></div>
    </div>
    {loading ? <div className="dashboard-state">Memuat data buku tamu…</div> : filtered.length === 0 ? <div className="dashboard-state"><strong>{visitors.length ? 'Data tidak ditemukan' : 'Belum ada kunjungan'}</strong><span>{visitors.length ? 'Coba kata pencarian lain.' : 'Data yang sudah dikirim pengunjung akan tampil di sini.'}</span></div> : <div className="table-wrap">
      <table className="visitor-table"><thead><tr><th>Nomor</th><th>Hari/Tanggal</th><th>Jam Masuk</th><th>Nama Lengkap</th><th>Tempat, Tanggal Lahir</th><th>Jabatan</th><th>Asal Instansi</th><th>Tujuan Kunjungan</th><th>Selfie</th><th>Aksi</th></tr></thead>
        <tbody>{filtered.map((visitor) => <tr key={visitor.id}>
          <td>{visitor.nomor}</td><td>{visitor.hariTanggal}</td><td>{visitor.jamMasuk}</td><td className="visitor-name">{visitor.namaLengkap}</td><td>{visitor.tempatTanggalLahir}</td><td>{visitor.jabatan}</td><td>{visitor.asalInstansi}</td><td className="purpose-cell">{visitor.tujuanKunjungan || '—'}</td>
          <td><button className="photo-thumb-button" type="button" onClick={() => setPhotoId(visitor.id)} aria-label={`Lihat selfie ${visitor.namaLengkap}`}><img src={`/api/visitor-photo?id=${encodeURIComponent(visitor.id)}`} alt="Selfie pengunjung" loading="lazy" /></button></td><td className="row-actions"><button type="button" className="button button-secondary" onClick={() => startEdit(visitor)}>Edit</button><button type="button" className="button button-danger" onClick={() => deleteVisitor(visitor)}>Hapus</button></td>
        </tr>)}</tbody>
      </table>
    </div>}
    <p className="export-note">File Excel berisi data kehadiran saja. Foto selfie tidak disertakan.</p>
    {photoId && <div className="photo-modal" role="presentation" onClick={() => setPhotoId('')}><div className="photo-modal-content" role="dialog" aria-modal="true" aria-label="Foto selfie pengunjung" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setPhotoId('')} aria-label="Tutup">×</button><img src={`/api/visitor-photo?id=${encodeURIComponent(photoId)}`} alt="Selfie pengunjung" /><button type="button" className="button button-secondary" onClick={() => setPhotoId('')}>Tutup</button></div></div>}
    {editing && <div className="photo-modal" role="presentation" onClick={() => !savingEdit && setEditing(null)}><section className="edit-modal" role="dialog" aria-modal="true" aria-label="Edit data pengunjung" onClick={(event) => event.stopPropagation()}><button type="button" className="modal-close" onClick={() => setEditing(null)} aria-label="Tutup" disabled={savingEdit}>×</button><div className="eyebrow">PERBARUI CATATAN</div><h2>Edit Data Pengunjung</h2><form onSubmit={saveEdit}>{[['namaLengkap','Nama Lengkap'],['tempatTanggalLahir','Tempat, Tanggal Lahir'],['jabatan','Jabatan'],['asalInstansi','Asal Instansi']].map(([name,label])=><div className="field" key={name}><label htmlFor={`edit-${name}`}>{label}</label><input id={`edit-${name}`} maxLength={name==='namaLengkap'?120:name==='tempatTanggalLahir'||name==='asalInstansi'?150:100} required value={editValues[name]} onChange={(event)=>setEditValues((current)=>({...current,[name]:event.target.value}))}/></div>)}<div className="field"><label htmlFor="edit-tujuanKunjungan">Tujuan Kunjungan (opsional)</label><textarea id="edit-tujuanKunjungan" rows="3" maxLength="1000" value={editValues.tujuanKunjungan} onChange={(event)=>setEditValues((current)=>({...current,tujuanKunjungan:event.target.value}))}/></div><div className="edit-actions"><button type="button" className="button button-secondary" onClick={()=>setEditing(null)} disabled={savingEdit}>Batal</button><button type="submit" className="button button-primary" disabled={savingEdit}>{savingEdit?'Menyimpan…':'Simpan Perubahan'}</button></div></form></section></div>}
  </section>;
}

export default function AdminPage() {
  const [authState, setAuthState] = useState('checking');
  const [authError, setAuthError] = useState('');
  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/session', { credentials: 'same-origin', cache: 'no-store' });
      const result = await response.json();
      setAuthState(result.authenticated ? 'authenticated' : 'anonymous');
    } catch {
      setAuthError('Koneksi ke server belum tersedia. Periksa konfigurasi layanan penyimpanan.');
      setAuthState('anonymous');
    }
  }, []);
  useEffect(() => { checkSession(); }, [checkSession]);

  const logout = useCallback(async () => {
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); }
    finally { setAuthState('anonymous'); }
  }, []);

  return <div className="admin-shell">
    <header className="admin-header"><a className="brand" href="/" aria-label="E-Presensi Jati Mas"><span className="brand-mark" aria-hidden="true">JM</span><span className="brand-text"><strong>E-PRESENSI</strong><span>JATI MAS</span></span></a><a className="text-link" href="/">Form Buku Tamu</a></header>
    <main className={`admin-main${authState === 'anonymous' ? ' login-main' : ''}`}>
      {authError && <ErrorNotice>{authError}</ErrorNotice>}
      {authState === 'checking' ? <div className="dashboard-state">Memeriksa sesi admin…</div> : authState === 'authenticated' ? <VisitorDashboard onLogout={logout} /> : <LoginPanel onLogin={checkSession} />}
    </main>
    <footer><span>© {new Date().getFullYear()} PKBM Jati Mas</span><span>Area Admin</span></footer>
  </div>;
}
