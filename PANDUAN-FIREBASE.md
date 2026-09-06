# Panduan Firebase — Absensi Jenggala

Panduan langkah demi langkah menghubungkan aplikasi ke Firebase. Gratis untuk
pemakaian sebesar Jenggala (paket Spark cukup jauh).

Perkiraan waktu: 15 menit.

---

## 1. Buat project

1. Buka <https://console.firebase.google.com> dan masuk dengan akun Google.
2. **Add project** → nama: `absensi-jenggala` → **Continue**.
3. Google Analytics boleh dimatikan (tidak dipakai) → **Create project**.

## 2. Aktifkan login Google

1. Menu kiri → **Build → Authentication** → **Get started**.
2. Tab **Sign-in method** → pilih **Google** → geser **Enable**.
3. Isi *Project public-facing name* (mis. `Absensi Jenggala`) dan
   *Project support email* (pilih emailmu) → **Save**.

## 3. Buat database

1. Menu kiri → **Build → Firestore Database** → **Create database**.
2. Pilih lokasi **asia-southeast2 (Jakarta)** — paling dekat, paling cepat.
   Lokasi **tidak bisa diubah** setelah dibuat.
3. Pilih **Start in production mode** → **Create**.

   Mode production berarti semua akses ditolak dulu. Itu benar — aturannya
   dipasang di langkah 6.

## 4. Daftarkan aplikasi web

1. Klik ikon gerigi (⚙) di kiri atas → **Project settings**.
2. Gulir ke **Your apps** → klik ikon web **`</>`**.
3. App nickname: `Absensi Jenggala` → **Register app**.
   *Firebase Hosting tidak perlu dicentang — kita pakai Vercel.*
4. Akan muncul potongan kode seperti ini:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy………",
     authDomain: "absensi-jenggala.firebaseapp.com",
     projectId: "absensi-jenggala",
     storageBucket: "absensi-jenggala.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef123456"
   };
   ```

   Biarkan halaman ini terbuka.

## 5. Tempel ke `js/config.js`

Buka `js/config.js`, salin nilainya satu per satu:

```js
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSy………',
  authDomain: 'absensi-jenggala.firebaseapp.com',
  projectId: 'absensi-jenggala',
  storageBucket: 'absensi-jenggala.firebasestorage.app',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef123456',
};

export const ADMIN_EMAILS = [
  'emailkamu@gmail.com',        // <- email Google yang kamu pakai login
];
```

> Nilai `firebaseConfig` **memang publik** dan aman berada di kode frontend —
> semua aplikasi web Firebase begitu. Yang menjaga data adalah aturan keamanan
> di langkah berikutnya.

## 6. Pasang aturan keamanan

Langkah paling penting. Tanpa ini, aplikasi tidak akan bisa membaca apa pun.

1. Buka `firestore.rules` di proyek ini.
2. Cari bagian ini dan **ganti dengan email yang sama** seperti di
   `ADMIN_EMAILS`:

   ```
   function emailAdmin() {
     return masuk() && request.auth.token.email in [
       'ganti-dengan-email-admin@gmail.com'
     ];
   }
   ```

   Kalau adminnya lebih dari satu:

   ```
       return masuk() && request.auth.token.email in [
         'emailkamu@gmail.com',
         'adminlain@gmail.com'
       ];
   ```

3. Salin **seluruh isi** `firestore.rules`.
4. Firebase Console → **Firestore Database** → tab **Rules** → hapus isinya,
   tempel yang baru → **Publish**.

## 7. Izinkan domainnya

Firebase hanya melayani login dari domain yang terdaftar.

**Authentication → Settings → Authorized domains → Add domain**

Tambahkan:

- `localhost` — biasanya sudah ada; ini untuk mencoba di komputer.
- Domain Vercel-mu, misalnya `absensi-jenggala.vercel.app`.
- Domain sendiri, kalau nanti dipasang.

Kalau langkah ini terlewat, saat login akan muncul galat
`auth/unauthorized-domain`.

## 8. Coba jalankan

```powershell
npx serve .
```

Buka <http://localhost:3000>, tekan **Masuk dengan Google**.

Karena emailmu ada di `ADMIN_EMAILS`, menu **Admin** akan muncul.

## 9. Isi data anggota

**Admin → Anggota → Isi data anggota**

17 nama dari `js/config.js` akan dimasukkan sekali jalan. Tombol ini tidak
berbuat apa-apa kalau data anggota sudah ada, jadi aman ditekan dua kali.

## 10. Tautkan anggota & tambah admin kedua

**Admin → Pengguna**

Setiap anggota perlu login sekali lewat "Masuk dengan Google" — akunnya lalu
muncul otomatis di tab ini. Tautkan ke namanya masing-masing supaya bisa
absen; anggota **tidak bisa menautkan namanya sendiri**, harus lewat sini.

Kalau ada admin kedua yang emailnya belum kamu ketahui dari awal: minta dia
login sekali, tautkan ke namanya (kalau dia juga ikut absen), lalu tekan
**Jadikan admin** di baris akunnya. Tidak perlu menyentuh `ADMIN_EMAILS` atau
`firestore.rules` untuk ini.

## 11. Cetak QR

**QR Cetak → Cetak poster**

Cetak *setelah* aplikasi online di domain finalnya, karena QR memuat alamat
lengkap. Kalau domain berubah, QR harus dicetak ulang.

---

## Kalau bermasalah

| Yang muncul | Sebabnya | Cara memperbaiki |
|---|---|---|
| `auth/unauthorized-domain` | Domain belum didaftarkan | Langkah 7 |
| `Missing or insufficient permissions` | Rules belum di-Publish, atau email admin belum diganti | Langkah 6 |
| Menu Admin tidak muncul | Email tidak cocok dengan `ADMIN_EMAILS` | Cek ejaannya, lalu keluar dan masuk lagi |
| Jendela login langsung tertutup | Pop-up diblokir browser | Izinkan pop-up untuk domain ini |
| Layar putih, konsol bilang CORS / module | Dibuka lewat `file://` | Harus lewat server: `npx serve .` |
| `The query requires an index` | Struktur kueri berubah | Klik tautan di pesan galatnya; Firebase membuatkan indeksnya |

## Biaya

Paket gratis Firebase (Spark) memberi 50.000 baca dan 20.000 tulis per hari.

Perkiraan Jenggala: 17 orang × 2 sesi = 34 tulis per hari, ditambah beberapa
ratus baca. Kurang dari 1% kuota harian — tidak akan sampai berbayar.

---

Copyright © 2026 Alfad Sabil Haq
