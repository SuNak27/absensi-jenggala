<p align="center">
  <img src="assets/logo-lockup.png" alt="Jenggala — Jejaring Jaga Alam" width="420">
</p>

# Absensi Jenggala

Aplikasi absensi kegiatan Jenggala. Anggota masuk dengan akun Google (ditautkan
admin ke namanya), scan satu QR yang dicetak dan dipasang di lokasi, mencentang
kegiatan yang dikerjakan, lalu kehadirannya tercatat. Admin punya rekap, ekspor,
dan poster QR siap cetak.

Tanpa server sendiri: seluruhnya berkas statis (HTML/CSS/JS), datanya di
Firebase (Authentication + Firestore).

---

## Isi

- [Cara kerjanya](#cara-kerjanya)
- [Fitur](#fitur)
- [Menjalankan di komputer](#menjalankan-di-komputer)
- [Menghubungkan ke Firebase](#menghubungkan-ke-firebase)
- [Deploy ke Vercel](#deploy-ke-vercel)
- [Pemakaian sehari-hari](#pemakaian-sehari-hari)
- [Struktur berkas](#struktur-berkas)
- [Model data](#model-data)
- [Soal keamanan — apa adanya](#soal-keamanan--apa-adanya)

---

## Cara kerjanya

```
QR dicetak & dipasang di lokasi
        |
        v
[ anggota scan pakai kamera HP ]
        |
        v  membuka  https://…/#/absen?k=KODE
   kode dicocokkan dengan kode di Firestore
        |
        +-- tidak cocok --> "QR tidak dikenali"
        |
        v  cocok
   bukti scan disimpan (berlaku 15 menit, hilang saat tab ditutup)
        |
        v
   masuk dengan Google  ->  menunggu admin menautkan ke nama (sekali saja)
        |
        v
   centang kegiatan  ->  [ Absen Sekarang ]
        |
        v
   Firestore: absensi/{tanggal}_{sesi}_{nama}
        |
        v
   Rekap, matriks kehadiran, ekspor CSV
```

Satu anggota hanya bisa punya satu catatan per sesi per hari — dijamin oleh ID
dokumennya, jadi scan berulang tidak menggandakan data.

## Fitur

**Untuk anggota**

- Scan QR lewat kamera bawaan HP, atau pemindai di dalam aplikasi.
- Login Google; admin menautkan akun ke nama sekali saja, seterusnya langsung
  dikenali — anggota tidak memilih namanya sendiri.
- Daftar kegiatan menyesuaikan sesi. Istigosah otomatis muncul hanya pada
  sesi malam hari Kamis (malam Jumat).
- Penanda **tepat waktu / terlambat** otomatis (toleransi 15 menit).
- Daftar siapa saja yang sudah hadir hari ini, ikut ter-update langsung.
- Riwayat kehadiran sendiri per bulan di halaman Profil.

**Untuk admin**

- Menu **Pengguna**: menautkan akun Google yang baru login ke satu nama
  anggota, dan menjadikan/mencabut admin untuk akun mana pun — semuanya
  begitu akun itu pernah menekan "Masuk dengan Google" sekali, tanpa perlu
  tahu emailnya dari awal.
- Poster QR siap cetak (A4), lengkap dengan logo, langkah scan, dan jadwal.
- Ganti kode QR kapan saja — cetakan lama langsung tidak berlaku.
- Buka/tutup sesi manual di luar jadwal.
- Absen manual untuk yang HP-nya bermasalah.
- Kelola anggota: tambah, nonaktifkan, hapus, lepas kaitan akun Google.
- Rekap: ringkasan angka, batang kehadiran per anggota, matriks tanggal.
- Ekspor CSV (rekap ringkas dan rincian per catatan) serta cetak.

**Lain-lain**

- Tampilan mobile-first — dirancang untuk dipakai dari HP di lokasi kegiatan,
  dengan bar navigasi di bawah layar supaya gampang dijangkau ibu jari; layar
  lebih besar mendapat tata letak yang lebih lega.
- Tema mengikuti warna logo Jenggala; ada mode gelap otomatis untuk sesi malam.
- Bisa dipasang ke layar utama HP (PWA).
- Tetap jalan saat sinyal putus-putus — Firestore menyimpan cache lokal dan
  mengirimkan datanya begitu koneksi kembali.

## Menjalankan di komputer

Aplikasinya memakai ES modules, jadi tidak bisa dibuka lewat `file://` —
butuh server lokal. Tidak ada proses build sama sekali.

```powershell
# dari dalam folder proyek
npx serve .
# lalu buka http://localhost:3000
```

Alternatif tanpa Node:

```powershell
python -m http.server 3000
```

Sebelum Firebase diisi, aplikasi menampilkan halaman panduan setup. Halaman
`#/qr` sudah bisa dibuka dan dicetak sejak awal.

## Menghubungkan ke Firebase

Langkah lengkapnya ada di **[PANDUAN-FIREBASE.md](PANDUAN-FIREBASE.md)**.
Ringkasnya:

1. Buat project di [Firebase Console](https://console.firebase.google.com).
2. **Authentication → Sign-in method → Google**: aktifkan.
3. **Firestore Database**: buat, mode production.
4. Tambah **Web app**, salin `firebaseConfig`.
5. Tempel ke `FIREBASE_CONFIG` di [`js/config.js`](js/config.js), lalu isi
   `ADMIN_EMAILS` dengan email Google-mu.
6. Salin isi [`firestore.rules`](firestore.rules) ke tab **Rules** Firestore,
   **ganti email admin di dalamnya**, tekan Publish.
7. Masuk ke aplikasi → **Admin → Anggota → Isi data anggota**.
8. Untuk admin kedua yang emailnya belum diketahui dari awal (mis. Neng Hani):
   minta dia login sekali lewat "Masuk dengan Google", lalu di
   **Admin → Pengguna** tautkan akunnya ke namanya dan tekan **Jadikan admin**.
   Tidak perlu menyentuh `ADMIN_EMAILS` atau `firestore.rules` untuk ini.

> Nilai di `firebaseConfig` memang publik dan aman berada di kode frontend.
> Yang menjaga data adalah `firestore.rules`, bukan kerahasiaan nilai itu.

## Deploy ke Vercel

Repo ini berkas statis, jadi tidak perlu setelan build apa pun.

1. Push ke GitHub.
2. Vercel → **Add New → Project** → pilih repo ini.
3. Framework Preset: **Other**. Build Command dan Output Directory dikosongkan.
4. Deploy.
5. Salin domain hasil deploy, lalu daftarkan di Firebase Console →
   **Authentication → Settings → Authorized domains**. Tanpa langkah ini login
   Google akan ditolak.
6. Buka `#/qr` di domain itu, cetak posternya. QR memuat alamat lengkapnya,
   jadi **cetak QR setelah domain final** — kalau domain berubah, cetak ulang.

`vercel.json` sudah mengatur header cache dan izin kamera (`camera=(self)`)
yang dibutuhkan pemindai QR di dalam aplikasi.

## Pemakaian sehari-hari

| Situasi | Yang dilakukan |
|---|---|
| Anggota baru pertama kali login | Admin → **Pengguna** → tautkan akunnya ke namanya |
| Ada yang salah tertaut | Admin → **Pengguna** (ganti pilihan nama) atau Admin → Anggota → **Lepas akun** |
| Kegiatan mulai di luar jadwal | Admin → Hari ini → **Buka** pada sesi terkait |
| Kegiatan batal | Admin → Hari ini → **Tutup** |
| Ada yang HP-nya mati | Admin → Hari ini → **Absen manual** |
| QR terlanjur difoto orang | Admin → QR & Keamanan → **Acak** → **Simpan kode** → cetak ulang poster |
| Ada anggota baru | Admin → Anggota → **Tambah** |
| Anggota berhenti | Admin → Anggota → **Nonaktifkan** (riwayatnya tetap ada) |
| Perlu admin kedua | Admin → **Pengguna** → **Jadikan admin** pada akun yang sudah pernah login |
| Laporan bulanan | Rekap → **Bulan lalu** → **Unduh rekap (CSV)** |

Jadwal dan daftar kegiatan diubah di [`js/config.js`](js/config.js) pada
konstanta `SESI`, lalu deploy ulang.

### Dua admin: Alfad dan Neng Hani

- **Alfad** — admin pemantau. Emailnya terdaftar di `ADMIN_EMAILS` sehingga
  otomatis jadi admin sejak login pertama. Tidak ditautkan ke nama anggota
  mana pun, jadi beranda menampilkannya sebagai "admin pemantau" (bukan alur
  absen) — dia hanya memantau, mengelola, dan mencetak QR, tidak ikut absen.
- **Neng Hani** — admin sekaligus anggota aktif. Setelah dia login sekali,
  Alfad menautkan akunnya ke nama "Neng Hani" di Admin → Pengguna (supaya
  bisa absen seperti anggota lain) dan menekan **Jadikan admin** di baris yang
  sama (supaya juga bisa memantau/mengelola).

## Struktur berkas

```
index.html                 kerangka halaman (header, nav, footer)
manifest.webmanifest       agar bisa dipasang ke layar utama HP
vercel.json                header cache + izin kamera
firestore.rules            aturan keamanan — SALIN KE FIREBASE CONSOLE

css/app.css                seluruh tampilan; palet diambil dari logo

js/config.js               SATU-SATUNYA berkas yang perlu diubah
js/fb.js                   inisialisasi Firebase + status login
js/store.js                semua akses Firestore
js/qr.js                   bukti scan QR (sessionStorage)
js/util.js                 tanggal, jam, sesi, CSV
js/app.js                  router hash + navigasi

js/views/beranda.js        status hari ini + tombol absen
js/views/gerbang.js        pemeriksa QR (#/absen?k=…)
js/views/pindai.js         pemindai kamera dalam aplikasi
js/views/rekap.js          rekap, matriks, ekspor
js/views/admin.js          kontrol sesi, anggota, pengguna, kode QR
js/views/poster.js         poster QR siap cetak
js/views/profil.js         akun + riwayat sendiri

assets/                    logo hasil potong dari Logo.jpg
Logo.jpg                   berkas logo asli
```

## Model data

| Koleksi | ID dokumen | Isi |
|---|---|---|
| `anggota` | `fiqi`, `neng-hani`, … | `nama`, `gender`, `aktif`, `urutan`, `uid`, `email` |
| `users` | UID Firebase Auth | `email`, `nama`, `foto`, `role`, `anggotaId` |
| `absensi` | `2026-09-06_siang_fiqi` | `tanggal`, `sesi`, `anggotaId`, `nama`, `gender`, `uid`, `kegiatan[]`, `catatan`, `metode`, `ketepatan`, `malamJumat`, `waktu`, `jamLokal`, `dicatatOleh` |
| `sesi` | `2026-09-06_malam` | `override` (`buka` / `tutup` / `null`), `oleh`, `diubah` |
| `config` | `app` | `qrToken`, `diubah` |

Semua kueri rekap hanya memakai satu rentang pada `tanggal`, jadi **tidak butuh
composite index** — filter sesi dan kelompok dikerjakan di sisi aplikasi.

## Soal keamanan — apa adanya

Yang dijamin oleh `firestore.rules` (dicek di server, tidak bisa diakali):

- Hanya pengguna yang sudah login yang bisa membaca data.
- Seseorang hanya bisa mencatat kehadiran **atas nama yang tertaut ke akunnya**.
- ID dokumen wajib cocok dengan isinya, sehingga tidak bisa menulis catatan
  untuk tanggal atau orang lain.
- Catatan yang sudah masuk tidak bisa diubah atau dihapus kecuali oleh admin.
- Hanya admin yang bisa mengubah daftar anggota, kode QR, status sesi, serta
  menautkan akun ke nama atau mengubah peran admin — anggota **tidak bisa**
  menautkan namanya sendiri, hanya admin yang melakukannya lewat Admin →
  Pengguna.

Yang **tidak** dijamin: keharusan scan QR itu sendiri. Bukti scan disimpan di
browser, sementara Firestore tidak bisa memverifikasi bahwa QR fisik benar-benar
dibaca. Artinya orang yang paham teknis dan sudah tahu kodenya masih bisa absen
dari rumah. Untuk menutup celah itu sepenuhnya dibutuhkan backend (mis. Cloud
Functions dengan token berputar).

Dalam praktiknya pengaman yang tersedia sudah proporsional: kode QR bisa diganti
sewaktu-waktu, admin bisa menutup sesi, jam absen dibatasi, dan seluruh
kehadiran terlihat oleh semua anggota di beranda — kalau ada nama yang tercatat
padahal orangnya tidak datang, langsung ketahuan.

---

Copyright © 2026 Alfad Sabil Haq
