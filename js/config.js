/* ==========================================================================
   Konfigurasi Absensi Jenggala
   Satu-satunya file yang perlu kamu ubah untuk menghubungkan aplikasi ke
   Firebase, menentukan admin, dan mengatur jadwal / kegiatan / anggota.
   ========================================================================== */

/**
 * 1. FIREBASE
 *    Firebase Console -> Project settings -> Your apps -> Web app -> Config.
 *    Salin nilainya ke bawah ini. Nilai-nilai ini memang publik (aman ada di
 *    kode frontend); yang mengamankan data adalah firestore.rules.
 *    Langkah lengkap ada di PANDUAN-FIREBASE.md
 */
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC4BsLUNZO92WBRm_2lK_ogr5BYKUZ9g9o",
  authDomain: "absensi-jenggala.firebaseapp.com",
  projectId: "absensi-jenggala",
  storageBucket: "absensi-jenggala.firebasestorage.app",
  messagingSenderId: "642611142144",
  appId: "1:642611142144:web:1047ef57f189d17565c2e5",
  measurementId: "G-87LTBC1JD6"
};

/**
 * 2. ADMIN
 *    Email Google yang boleh membuka menu Admin (cetak QR, kelola anggota,
 *    absen manual, hapus data). Daftar yang sama HARUS ditulis juga di
 *    firestore.rules supaya benar-benar berlaku di sisi server.
 */
export const ADMIN_EMAILS = [
  'alfadsabilhaq@gmail.com',
];

/**
 * 3. QR
 *    Kode rahasia yang ditanam di dalam QR cetak. Boleh diganti kapan saja
 *    dari menu Admin -> QR (QR lama otomatis tidak berlaku, tinggal cetak ulang).
 *    Nilai di bawah dipakai kalau di Firestore belum ada.
 */
export const QR_TOKEN_AWAL = 'jenggala-2026';

/** Berapa menit hasil scan QR masih berlaku untuk menekan tombol Absen. */
export const QR_BERLAKU_MENIT = 15;

/**
 * 4. JADWAL & KEGIATAN
 *    mulai/selesai  = jam kegiatan yang tampil di aplikasi
 *    absenMulai/absenSelesai = rentang jam tombol Absen aktif
 *    toleransi      = menit setelah jam mulai sebelum dihitung "terlambat"
 */
export const SESI = [
  {
    id: 'siang',
    nama: 'Sesi Siang',
    mulai: '12:00',
    selesai: '16:00',
    absenMulai: '11:00',
    absenSelesai: '16:30',
    toleransi: 15,
    kegiatan: [
      { id: 'sg1', nama: 'Membalik jemuran sampah organik' },
      { id: 'sg2', nama: 'Menerima sampah dan memilah' },
      { id: 'sg3', nama: 'Menyiram tanaman' },
      { id: 'sg4', nama: 'Menyapu' },
    ],
  },
  {
    id: 'malam',
    nama: 'Sesi Malam',
    mulai: '19:00',
    selesai: '22:00',
    absenMulai: '18:00',
    absenSelesai: '22:30',
    toleransi: 15,
    kegiatan: [
      { id: 'ml1', nama: 'Menyiapkan tempat jemuran sampah organik' },
      { id: 'ml2', nama: 'Merapikan dan meletakkan sampah organik ke tempat jemuran yang disiapkan' },
      { id: 'ml3', nama: 'Memilah sampah organik dan non organik' },
      { id: 'ml4', nama: 'Menyapu' },
      { id: 'ml5', nama: 'Pembacaan istigosah rutinan', hanyaMalamJumat: true },
      { id: 'ml6', nama: 'Packing pakan dan kompos' },
    ],
  },
];

/**
 * 5. ANGGOTA AWAL
 *    Dipakai sekali saja oleh tombol "Isi data anggota" di menu Admin.
 *    Setelah itu pengelolaan anggota dilakukan lewat aplikasi, bukan file ini.
 */
export const ANGGOTA_AWAL = [
  { nama: 'Fiqi', gender: 'L' },
  { nama: 'Riyan', gender: 'L' },
  { nama: 'Hambali', gender: 'L' },
  { nama: 'Dani', gender: 'L' },
  { nama: 'Wildan', gender: 'L' },
  { nama: 'Yahya', gender: 'L' },
  { nama: 'Jefri', gender: 'L' },
  { nama: 'Baihaqi', gender: 'L' },
  { nama: 'Cebonk', gender: 'L' },
  { nama: 'Roni', gender: 'L' },
  { nama: 'Anni', gender: 'P' },
  { nama: 'Ilvi', gender: 'P' },
  { nama: 'Cung', gender: 'P' },
  { nama: 'Anik', gender: 'P' },
  { nama: 'Adiba', gender: 'P' },
  { nama: 'Neng Hani', gender: 'P' },
  { nama: 'Merry', gender: 'P' },
];

export const APP_NAMA = 'Absensi Jenggala';
export const HAK_CIPTA = 'Copyright © 2026 Alfad Sabil Haq';

/** true kalau FIREBASE_CONFIG sudah diisi. */
export const firebaseSiap = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

export const sesiById = (id) => SESI.find((s) => s.id === id) || null;
