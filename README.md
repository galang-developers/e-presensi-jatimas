# E-Presensi Jati Mas

Buku tamu digital PKBM Jati Mas. Pengunjung mengisi nama, tempat dan tanggal lahir, jabatan, instansi, tujuan kunjungan, serta selfie melalui kamera atau unggah foto. Pengelola masuk ke `/admin` untuk melihat kunjungan, mencetak sertifikat memakai template `sertif.html`, dan mengunduh rekap Excel.

Google Sheets, Google Drive, QR Code, dan tanda tangan digital sudah dihapus. Data kunjungan disimpan di PostgreSQL (Neon melalui Vercel Marketplace), sementara foto selfie berada di Vercel Blob dengan akses private. Penyimpanan browser dan filesystem sementara Vercel tidak digunakan sebagai database. Vercel menyediakan integrasi marketplace untuk database Postgres dan Vercel Blob untuk file saat aplikasi berjalan ([Vercel Storage](https://vercel.com/docs/storage), [Vercel Blob private storage](https://vercel.com/docs/vercel-blob/private-storage)).

## Setup lokal

1. Instal Node.js versi 20 atau lebih baru.
2. Jalankan `npm install` dari folder proyek.
3. Buat database Neon PostgreSQL melalui Vercel Marketplace atau Neon Console, lalu salin connection string pooled ke `DATABASE_URL`.
4. Di Vercel, buat Vercel Blob store dengan akses **Private** dan hubungkan ke proyek. Salin `BLOB_READ_WRITE_TOKEN` dari pengaturan Blob untuk pengembangan lokal.
5. Salin `.env.example` menjadi `.env.local`, isi `DATABASE_URL` dan `BLOB_READ_WRITE_TOKEN`, lalu tentukan `ADMIN_USERNAME`, `ADMIN_PASSWORD`, dan `ADMIN_SESSION_SECRET`. Buat session secret acak minimal 32 karakter, misalnya dengan `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Gunakan password unik yang panjang.
6. Jalankan `npm run dev`. Form tersedia di `http://localhost:5173`; backend lokal berjalan di port 3001. Kedua server memakai database dan Blob yang sama dari environment.
7. Kirim satu data percobaan, periksa data pada tabel `visitor_records` di Neon, kemudian buka `/admin` dan coba lihat selfie serta unduh Excel. Kolom tempat/tanggal lahir ditambahkan otomatis ke tabel lama saat request berikutnya.

Tabel `visitor_records` dibuat otomatis oleh backend ketika request pertama diterima. ID internal PostgreSQL tetap unik dan tidak digunakan ulang. Nomor urut yang ditampilkan dihitung dari catatan yang masih ada berdasarkan waktu masuk, sehingga nomor menjadi rapat kembali setelah penghapusan dan kembali mulai dari 1 ketika semua catatan sudah dihapus. Nomor tampilan dapat berubah setelah penghapusan; gunakan ID internal hanya untuk referensi teknis. Waktu dibuat oleh database, lalu ditampilkan dalam zona waktu `Asia/Jakarta`.

## Deploy ke Vercel

1. Push project ke GitHub, lalu import repository ke Vercel. Build command `npm run build`, output directory `dist`.
2. Dari tab **Storage** project di Vercel, buat koneksi Neon/Postgres dan buat Blob store dengan akses **Private**. Integrasi akan menambahkan environment variable database dan Blob ke project. Bila nama koneksi database bukan `DATABASE_URL`, backend juga mengenali `POSTGRES_URL` dan `POSTGRES_PRISMA_URL`.
3. Di **Project Settings → Environment Variables**, isi `ADMIN_USERNAME`, `ADMIN_PASSWORD`, dan `ADMIN_SESSION_SECRET` untuk Production, Preview, atau Development sesuai kebutuhan. Jangan awali credential dengan `VITE_`; credential tersebut hanya dibaca server.
4. Deploy atau redeploy setelah environment siap. Uji halaman form dan `/admin` pada domain produksi.
5. Akun Vercel/Neon, pembuatan Blob store, dan konfigurasi variabel lingkungan harus dilakukan oleh pemilik akun. Data berada di resource database dan Blob yang terhubung, bukan di penyimpanan filesystem sementara fungsi Vercel.

## Fitur dan keamanan

- Endpoint publik hanya menerima kiriman `POST /api/visitors`. Endpoint baca daftar, ekspor, foto, dan login admin terpisah; data dan foto hanya dapat diakses dengan cookie sesi admin yang HttpOnly, Secure di production, dan SameSite Strict.
- Username, password, dan secret sesi disimpan sebagai environment variables server. Akun admin tidak disimpan dalam tabel database. Untuk mengganti akses admin, ubah variabel Vercel lalu redeploy.
- Selfie dapat diambil langsung lewat kamera atau dipilih melalui unggah foto, dikecilkan di browser, divalidasi lagi di server, lalu diunggah ke Blob private. Akses kamera memerlukan HTTPS pada deployment (atau localhost saat pengembangan). Endpoint foto memeriksa sesi admin sebelum mengirim file.
- Ekspor mengunduh file Excel `.xls` berisi Nomor, Hari/Tanggal, Jam Masuk, Nama Lengkap, Tempat/Tanggal Lahir, Jabatan, Asal Instansi, dan Tujuan Kunjungan. Path selfie dan foto tidak disertakan.
- Tombol **Cetak Sertifikat** membuka file `sertif.html` yang diberikan tanpa mengubah desainnya, menyembunyikan panel pengaturannya, lalu mengisi data pengunjung terpilih pada nama, tempat/tanggal lahir, instansi, jabatan, nomor buku tamu, serta foto selfie. Template dan aset disajikan lewat endpoint yang memerlukan login admin.
- Rate limit login dan form berjalan best-effort per instance. Untuk pencegahan spam yang konsisten pada trafik besar, tambahkan rate limiter terdistribusi.
- Tidak ada endpoint untuk menghapus catatan dari dashboard. Untuk pengelolaan retensi dan penghapusan, gunakan console database dan Blob sesuai kebijakan lembaga.

## API

- `POST /api/visitors`: menerima nama, tempat/tanggal lahir, jabatan, instansi, tujuan (opsional), selfie JPEG, dan kunci idempotensi. Waktu serta nomor dibuat server/database.
- `GET /api/admin/session`, `POST /api/admin/login`, `POST /api/admin/logout`: status dan sesi admin.
- `GET /api/visitors`: daftar kunjungan untuk admin yang login.
- `GET /api/visitor-photo?id=...`: selfie privat untuk admin yang login.
- `GET /api/visitors-export`: file Excel tanpa selfie.

## Troubleshooting

- **Database belum dikonfigurasi**: hubungkan Neon/Postgres dan isi `DATABASE_URL` atau `POSTGRES_URL` pada environment deployment, lalu redeploy.
- **Database gagal terhubung**: periksa connection string, SSL, dan akses database. Gunakan connection string pooled yang diberikan provider untuk fungsi serverless.
- **Selfie gagal diunggah/dibuka**: pastikan Blob store sudah dibuat sebagai **Private**, token `BLOB_READ_WRITE_TOKEN` terhubung ke project, dan environment lokal memakai token yang valid.
- **Login admin belum dikonfigurasi**: isi `ADMIN_USERNAME`, `ADMIN_PASSWORD`, dan `ADMIN_SESSION_SECRET` (minimal 32 karakter), lalu redeploy.
- **Lupa password**: ganti `ADMIN_PASSWORD` di environment Vercel dan redeploy.
- **Request foto terlalu besar**: form mengompres foto otomatis. Ambil ulang foto bila perangkat masih menghasilkan file terlalu besar.
- **`vite` tidak dikenali**: jalankan `npm install` dari folder project.

Dashboard admin menyediakan tombol edit untuk data identitas/kunjungan serta hapus untuk catatan dan selfie terkait. Akses /admin tidak ditautkan pada halaman pengunjung; URL tersebut hanya diketahui pengelola.
