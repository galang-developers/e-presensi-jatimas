export const limits = {
  namaLengkap: 120,
  jabatan: 100,
  asalInstansi: 150,
  tujuanKunjungan: 1000,
};

export function validateVisitor(values) {
  const errors = {};
  for (const [key, max] of Object.entries(limits)) {
    const value = typeof values?.[key] === 'string' ? values[key].trim() : '';
    if (!value) errors[key] = 'Bagian ini wajib diisi.';
    else if (value.length > max) errors[key] = `Maksimal ${max} karakter.`;
  }
  return errors;
}
