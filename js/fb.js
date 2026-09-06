/* Inisialisasi Firebase (App, Auth, Firestore) + status pengguna. */

import { FIREBASE_CONFIG, ADMIN_EMAILS, firebaseSiap } from './config.js';

const V = '10.14.1';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;

export let app = null;
export let auth = null;
export let db = null;
export let sdk = {}; // fungsi-fungsi Firestore yang dipakai di store.js

/** Status pengguna saat ini; diisi ulang setiap perubahan login. */
export const sesiPengguna = {
  siap: false,
  user: null,       // objek Firebase Auth
  profil: null,     // dokumen users/{uid}
  anggota: null,    // dokumen anggota/{id} yang tertaut
  get masuk() { return Boolean(this.user); },
  get admin() { return this.profil?.role === 'admin'; },
};

const pendengar = new Set();
export function saatBerubah(fn) {
  pendengar.add(fn);
  if (sesiPengguna.siap) fn(sesiPengguna);
  return () => pendengar.delete(fn);
}
function siarkan() { pendengar.forEach((fn) => fn(sesiPengguna)); }

export const emailAdmin = (email) =>
  ADMIN_EMAILS.map((e) => e.trim().toLowerCase()).includes(String(email || '').toLowerCase());

let siapPromise = null;

/** Memuat SDK Firebase dan menyalakan pemantau login. Aman dipanggil berkali-kali. */
export function mulaiFirebase() {
  if (siapPromise) return siapPromise;
  siapPromise = (async () => {
    if (!firebaseSiap) {
      sesiPengguna.siap = true;
      return false;
    }

    const [appMod, authMod, fsMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);

    app = appMod.initializeApp(FIREBASE_CONFIG);

    try {
      db = fsMod.initializeFirestore(app, {
        localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }),
      });
    } catch {
      // Browser tanpa IndexedDB (mis. mode privat lama) — jalan tanpa cache offline.
      db = fsMod.getFirestore(app);
    }

    auth = authMod.getAuth(app);
    try { await authMod.setPersistence(auth, authMod.browserLocalPersistence); } catch { /* abaikan */ }

    sdk = {
      ...fsMod,
      GoogleAuthProvider: authMod.GoogleAuthProvider,
      signInWithPopup: authMod.signInWithPopup,
      signInWithRedirect: authMod.signInWithRedirect,
      getRedirectResult: authMod.getRedirectResult,
      onAuthStateChanged: authMod.onAuthStateChanged,
      signOut: authMod.signOut,
    };

    try { await authMod.getRedirectResult(auth); } catch { /* abaikan */ }

    await new Promise((selesai) => {
      let pertama = true;
      authMod.onAuthStateChanged(auth, async (user) => {
        sesiPengguna.user = user;
        sesiPengguna.profil = user ? await pastikanProfil(user) : null;
        sesiPengguna.anggota = null;
        sesiPengguna.siap = true;
        siarkan();
        if (pertama) { pertama = false; selesai(); }
      });
    });

    return true;
  })();
  return siapPromise;
}

/** Membuat/menyegarkan dokumen users/{uid}. */
async function pastikanProfil(user) {
  const ref = sdk.doc(db, 'users', user.uid);
  const snap = await sdk.getDoc(ref);
  const peranSeharusnya = emailAdmin(user.email) ? 'admin' : 'anggota';

  if (!snap.exists()) {
    const baru = {
      email: user.email || '',
      nama: user.displayName || user.email || 'Tanpa nama',
      foto: user.photoURL || '',
      role: peranSeharusnya,
      anggotaId: null,
      dibuat: sdk.serverTimestamp(),
    };
    await sdk.setDoc(ref, baru);
    return baru;
  }

  const data = snap.data();
  const perbaikan = {};
  if (user.photoURL && data.foto !== user.photoURL) perbaikan.foto = user.photoURL;
  if (user.displayName && data.nama !== user.displayName) perbaikan.nama = user.displayName;
  // Naikkan ke admin kalau emailnya ada di daftar; jangan pernah menurunkan
  // otomatis supaya perubahan peran dari menu Admin tidak tertimpa.
  if (peranSeharusnya === 'admin' && data.role !== 'admin') perbaikan.role = 'admin';

  if (Object.keys(perbaikan).length) {
    try { await sdk.updateDoc(ref, perbaikan); } catch { /* abaikan */ }
    return { ...data, ...perbaikan };
  }
  return data;
}

export async function masukGoogle() {
  await mulaiFirebase();
  const provider = new sdk.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await sdk.signInWithPopup(auth, provider);
  } catch (e) {
    const kode = e?.code || '';
    if (kode === 'auth/popup-blocked' || kode === 'auth/operation-not-supported-in-this-environment') {
      await sdk.signInWithRedirect(auth, provider);
      return;
    }
    if (kode === 'auth/popup-closed-by-user' || kode === 'auth/cancelled-popup-request') return;
    throw e;
  }
}

export async function keluar() {
  if (!auth) return;
  await sdk.signOut(auth);
}

/** Muat ulang profil + anggota tertaut dari Firestore. */
export async function segarkanProfil() {
  if (!sesiPengguna.user) return;
  const snap = await sdk.getDoc(sdk.doc(db, 'users', sesiPengguna.user.uid));
  sesiPengguna.profil = snap.exists() ? snap.data() : null;
  const id = sesiPengguna.profil?.anggotaId;
  if (id) {
    const a = await sdk.getDoc(sdk.doc(db, 'anggota', id));
    sesiPengguna.anggota = a.exists() ? { id: a.id, ...a.data() } : null;
  } else {
    sesiPengguna.anggota = null;
  }
  siarkan();
}

/** Pesan galat Firebase dalam bahasa Indonesia. */
export function pesanGalat(e) {
  const kode = e?.code || '';
  const peta = {
    'permission-denied': 'Akses ditolak oleh aturan keamanan Firestore. Cek firestore.rules dan daftar email admin.',
    'unavailable': 'Tidak ada koneksi ke server. Coba lagi setelah internet stabil.',
    'auth/popup-blocked': 'Jendela login diblokir browser. Izinkan pop-up lalu coba lagi.',
    'auth/unauthorized-domain': 'Domain ini belum diizinkan di Firebase Authentication → Settings → Authorized domains.',
    'auth/network-request-failed': 'Koneksi terputus saat login. Coba lagi.',
    'failed-precondition': 'Firestore butuh indeks tambahan, atau database belum dibuat.',
  };
  return peta[kode] || e?.message || 'Terjadi kesalahan yang tidak diketahui.';
}
