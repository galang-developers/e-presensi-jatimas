export default function SuccessMessage({ onAgain }) {
  return (
    <section className="success-card" role="status" aria-live="polite">
      <div className="success-mark" aria-hidden="true">✓</div>
      <h2>Terima kasih telah berkunjung</h2>
      <p>Terima kasih telah berkunjung ke PKBM Jati Mas. Data buku tamu Anda berhasil disimpan.</p>
      <button className="button button-primary" type="button" onClick={onAgain}>Isi Buku Tamu Lagi</button>
    </section>
  );
}
