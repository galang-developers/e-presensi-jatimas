# E-Presensi Jati Mas

Buku tamu digital untuk PKBM Jati Mas, dibuat dengan React, Vite, Vercel Functions, server Node/Express untuk lokal, dan Google Sheets API. Frontend hanya mengirim empat isian pengunjung; server membuat nomor tanpa nol di depan, hari/tanggal, serta jam masuk berformat `HH:mm` dalam zona waktu `Asia/Jakarta`.

## Persiapan

1. Instal Node.js versi 20 atau lebih baru dari situs resmi Node.js.
2. Buka terminal pada folder proyek ini, lalu jalankan `npm install`.
3. Buat Google Cloud Project pada Google Cloud Console.
4. Aktifkan **Google Sheets API** untuk project tersebut.
5. Buat Service Account dan buat kunci JSON. Catat nilai `client_email` dan `private_key`; rahasiakan file kunci dan jangan masukkan ke Git.
6. Buat spreadsheet dengan nama **Database E-Presensi Jati Mas**. Buat worksheet **Buku Tamu** dan isikan header baris pertama tepat dalam urutan berikut:

   `Nomor | Hari/Tanggal | Jam Masuk | Nama Lengkap | Jabatan | Asal Instansi | Tujuan Kunjungan`

7. Bagikan spreadsheet kepada email Service Account dengan izin **Editor**. Spreadsheet tidak perlu dibuat publik. Ambil ID spreadsheet dari bagian URL di antara `/d/` dan `/edit`.
8. Salin `.env.example` menjadi `.env.local`, lalu isi:

   ```env
   GOOGLE_SHEETS_SPREADSHEET_ID=ID_SPREADSHEET
   GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project-id.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEETS_SHEET_NAME=Buku Tamu
   VITE_APP_URL=http://localhost:5173
   ```

   Private key boleh disimpan dengan `\n` literal seperti format environment di atas. Hanya variabel `VITE_APP_URL` yang masuk bundle browser; jangan pernah memberi prefix `VITE_` ke credential.
9. Jalankan `npm run dev`. Perintah ini menyalakan API Node/Express lokal pada port 3001 dan Vite pada port 5173. Vite meneruskan `/api/*` ke API lokal, sehingga formulir dan Google Sheets dapat diuji bersama tanpa Vercel CLI. API lokal membaca credential dari `.env.local` atau `.env` di folder proyek.
10. Kirim data dari formulir di `http://localhost:5173`, lalu periksa baris baru di worksheet.

## Deploy ke Vercel

11. Push proyek ke repository GitHub. Pastikan `.env.local` dan file kunci Service Account tidak ikut ter-commit.
12. Di Vercel, import repository sebagai proyek baru. Framework preset **Vite**; build command `npm run build` dan output directory `dist` (keduanya sudah dinyatakan di `vercel.json`).
13. Tambahkan `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEETS_SHEET_NAME` dan `VITE_APP_URL` di Project Settings → Environment Variables. Set `VITE_APP_URL` ke URL deployment publik yang benar, misalnya domain produksi Vercel yang diberikan setelah deployment pertama. Redeploy agar QR memakai nilai URL baru.
14. Deploy. Uji pengiriman di URL produksi dan periksa Google Sheets; sukses di layar hanya diberikan setelah append dan penulisan nomor selesai dikonfirmasi Google Sheets API.
15. Cetak QR dari panel aplikasi atau gunakan tombol **Unduh QR Code**. Pastikan URL publik sudah benar sebelum mencetak.

Deployment Vercel, pembuatan Cloud Project, pemberian akses Service Account, dan pengisian credential harus dilakukan oleh pemilik akun. Repository ini tidak berisi credential maupun URL deployment rekaan.

### Menjalankan hasil build dengan API lokal

Setelah `npm run build`, jalankan `npm start`. Satu server Node/Express menyajikan file dari `dist` dan endpoint `/api/visitors` pada port 3001. Atur `PORT` jika port itu sedang digunakan. `npm run preview` hanya untuk pratinjau Vite; gunakan `npm start` bila API juga diperlukan. Di Vercel, fungsi serverless tetap menangani `/api/visitors` dan tidak memerlukan server lokal.

## Format data dan penomoran

Endpoint `POST /api/visitors` hanya menerima `namaLengkap`, `jabatan`, `asalInstansi`, dan `tujuanKunjungan`. Server menolak kolom kosong, karakter kontrol, dan isian yang melebihi batas. Data ditulis dengan `valueInputOption: RAW`, sehingga input diawali `=` tidak dievaluasi sebagai formula. Tidak tersedia endpoint baca spreadsheet.

Untuk menangani permintaan bersamaan, server menambahkan satu baris `PENDING` sekaligus seluruh nilai dengan operasi append Google Sheets. API mengembalikan rentang baris yang dialokasikan; endpoint lalu menulis nomor berdasarkan indeks baris pada sel A di baris yang sama. Nomor dibuat unik untuk append serentak selama baris lama tidak dihapus, diurutkan ulang, atau disisipkan manual saat proses berjalan. Kedua panggilan Sheets bukan transaksi: kegagalan setelah append dapat meninggalkan baris `PENDING` dan endpoint melaporkan gagal; periksa sheet sebelum mengulang kasus tersebut. Untuk jaminan transaksional penuh atau penomoran independen dari perubahan sheet, gunakan database transaksional dengan counter atomik. Setelah penyimpanan, endpoint juga menerapkan latar hijau pada header dan putih pada semua sel data yang terpakai; kegagalan pemformatan tidak membatalkan kunjungan yang telah tersimpan.

Rate limit dan idempotensi di endpoint ini bersifat **best effort per instance**, karena memori fungsi Vercel tidak persisten dan tidak dibagi di antara instance. Untuk melindungi deployment dengan trafik publik dari spam secara konsisten, tambahkan provider koordinasi bersama seperti Redis/Upstash atau proteksi edge. Idempotensi mencegah retry ganda pada instance yang sama selama entri masih tersimpan.

## Troubleshooting

- **Layanan penyimpanan belum terkonfigurasi**: pastikan semua credential server diisi dan redeploy fungsi.
- **Spreadsheet tidak tersedia/tidak dapat diakses**: periksa Spreadsheet ID, nama worksheet `Buku Tamu`, Sheets API aktif, dan spreadsheet dibagikan kepada Service Account sebagai Editor.
- **Error autentikasi/403**: pastikan email dan private key berasal dari kunci Service Account yang sama. Simpan newline private key sebagai `\n` di environment Vercel.
- **QR belum tampil**: atur `VITE_APP_URL` ke URL deployment publik, lalu build/deploy ulang.
- **Aplikasi tampil tetapi pengiriman gagal saat `npm run dev`**: Vite dev server tidak menjalankan Vercel Functions. Gunakan `npx vercel dev` dengan environment lokal terkonfigurasi.
- **Baris berstatus `PENDING`**: penulisan nomor gagal setelah append; cek konfigurasi/akses Sheets, lalu rapikan baris itu secara manual sebelum pengujian ulang.
