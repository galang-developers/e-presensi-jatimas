export function printVisitorCertificate(visitor) {
  const params = new URLSearchParams({
    nama: visitor.namaLengkap || '',
    lahir: visitor.tempatTanggalLahir || '',
    instansi: visitor.asalInstansi || '',
    jabatan: visitor.jabatan || '',
    nomor: visitor.nomor || '',
    photoId: visitor.id || '',
  });
  const popup = window.open('about:blank', '_blank');
  if (!popup) throw new Error('Popup cetak diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.');
  popup.opener = null;
  popup.location.replace(`/api/admin/certificate?${params.toString()}`);
}
