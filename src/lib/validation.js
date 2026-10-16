export const limits = {
  namaLengkap: 120,
  tempatTanggalLahir: 150,
  jabatan: 100,
  asalInstansi: 150,
  tujuanKunjungan: 1000,
};

export function validateVisitor(values) {
  const errors = {};
  for (const key of ['namaLengkap', 'tempatTanggalLahir', 'jabatan', 'asalInstansi']) {
    const value = typeof values?.[key] === 'string' ? values[key].trim() : '';
    if (!value) errors[key] = 'Bagian ini wajib diisi.';
    else if (value.length > limits[key]) errors[key] = `Maksimal ${limits[key]} karakter.`;
  }
  const tujuan = typeof values?.tujuanKunjungan === 'string' ? values.tujuanKunjungan.trim() : '';
  if (tujuan.length > limits.tujuanKunjungan) errors.tujuanKunjungan = `Maksimal ${limits.tujuanKunjungan} karakter.`;
  if (typeof values?.selfieDataUrl !== 'string' || !values.selfieDataUrl) errors.selfieDataUrl = 'Selfie wajib diambil sebelum menyimpan.';
  return errors;
}
