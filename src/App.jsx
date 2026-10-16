import { useState } from 'react';
import VisitorForm from './components/VisitorForm.jsx';
import SuccessMessage from './components/SuccessMessage.jsx';
import AdminPage from './components/AdminPage.jsx';

export default function App() {
  const [submitted, setSubmitted] = useState(false);
  if (window.location.pathname.replace(/\/$/, '') === '/admin') return <AdminPage />;
  return (
    <div className="page-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="E-Presensi Jati Mas">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M16 10.2C12.7 7.9 8.7 7.1 4.5 8.2v15.3c4.2-1.1 8.2-.3 11.5 2 3.3-2.3 7.3-3.1 11.5-2V8.2c-4.2-1.1-8.2-.3-11.5 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M16 10.5v15M8 12.5c2.1-.2 4 .2 5.7 1.1M24 12.5c-2.1-.2-4 .2-5.7 1.1" stroke="#C9E6D8" strokeWidth="1.5" strokeLinecap="round"/></svg></span>
          <span className="brand-text"><strong>E-PRESENSI</strong><span>JATI MAS</span></span>
        </a>
        <div className="header-caption">Pusat Kegiatan Belajar Masyarakat</div>
      </header>
      <main>
        <section className="welcome-banner">
          <div className="welcome-copy"><div className="eyebrow light-eyebrow">PKBM JATI MAS</div><h1>Selamat datang di<br className="desktop-break" /> PKBM Jati Mas</h1><p>Selamat datang di PKBM Jati Mas. Silakan isi buku tamu digital sebelum melakukan kunjungan.</p></div>
          <div className="welcome-decoration" aria-hidden="true"><span /><span /><span /></div>
        </section>
        <div className="content-grid">
          <div className="main-content">{submitted ? <SuccessMessage onAgain={() => setSubmitted(false)} /> : <VisitorForm onSuccess={() => setSubmitted(true)} />}</div>
        </div>
      </main>
      <footer><span>© {new Date().getFullYear()} PKBM Jati Mas</span></footer>
    </div>
  );
}
