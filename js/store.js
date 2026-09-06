/* Semua akses data ke Firestore. Tidak ada view yang menyentuh Firestore langsung. */

import { db, sdk, sesiPengguna } from './fb.js';
import { QR_TOKEN_AWAL, ANGGOTA_AWAL, sesiById } from './config.js';
import { kunciTanggal, slug, statusKetepatan, malamJumat } from './util.js';

/* ---------- pengaturan ---------- */

const refConfig = () => sdk.doc(db, 'config', 'app');

export async function ambilPengaturan() {
  const snap = await sdk.getDoc(refConfig());
  const data = snap.exists() ? snap.data() : {};
  return { qrToken: data.qrToken || QR_TOKEN_AWAL, ...data };
}

export async function simpanPengaturan(patch) {
  await sdk.setDoc(refConfig(), { ...patch, diubah: sdk.serverTimestamp() }, { merge: true });
}

/* ---------- anggota ---------- */

export async function ambilAnggota() {
  const snap = await sdk.getDocs(sdk.query(sdk.collection(db, 'anggota'), sdk.orderBy('urutan')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function pantauAnggota(cb) {
  return sdk.onSnapshot(
    sdk.query(sdk.collection(db, 'anggota'), sdk.orderBy('urutan')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}

/** Menulis daftar anggota awal. Hanya dijalankan kalau koleksi masih kosong. */
export async function isiAnggotaAwal() {
  const ada = await sdk.getDocs(sdk.query(sdk.collection(db, 'anggota'), sdk.limit(1)));
  if (!ada.empty) return 0;
  const batch = sdk.writeBatch(db);
  ANGGOTA_AWAL.forEach((a, i) => {
    batch.set(sdk.doc(db, 'anggota', slug(a.nama)), {
      nama: a.nama, gender: a.gender, aktif: true,
      urutan: (i + 1) * 10, uid: null, email: null,
    });
  });
  await batch.commit();
  return ANGGOTA_AWAL.length;
}

export async function tambahAnggota({ nama, gender }) {
  const id = slug(nama);
  const ref = sdk.doc(db, 'anggota', id);
  if ((await sdk.getDoc(ref)).exists()) throw new Error(`Anggota "${nama}" sudah ada.`);
  const semua = await ambilAnggota();
  const urutan = semua.length ? Math.max(...semua.map((a) => a.urutan || 0)) + 10 : 10;
  await sdk.setDoc(ref, { nama, gender, aktif: true, urutan, uid: null, email: null });
  return id;
}

export const ubahAnggota = (id, patch) => sdk.updateDoc(sdk.doc(db, 'anggota', id), patch);
export const hapusAnggota = (id) => sdk.deleteDoc(sdk.doc(db, 'anggota', id));

/** Mengaitkan satu akun Google ke satu nama anggota. Khusus admin. */
export async function tautkanAnggota(anggotaId, uid, email) {
  const refAnggota = sdk.doc(db, 'anggota', anggotaId);
  const snap = await sdk.getDoc(refAnggota);
  if (!snap.exists()) throw new Error('Nama tidak ditemukan.');
  const data = snap.data();
  if (data.uid && data.uid !== uid) {
    throw new Error(`"${data.nama}" sudah dipakai akun lain.`);
  }

  await sdk.updateDoc(refAnggota, { uid, email: email || '' });
  await sdk.updateDoc(sdk.doc(db, 'users', uid), { anggotaId });
}

/** Melepas kaitan akun dari sebuah nama (dipakai admin). */
export async function lepasAnggota(anggotaId, uid) {
  await sdk.updateDoc(sdk.doc(db, 'anggota', anggotaId), { uid: null, email: null });
  if (uid) {
    try { await sdk.updateDoc(sdk.doc(db, 'users', uid), { anggotaId: null }); } catch { /* abaikan */ }
  }
}

/* ---------- pengguna (akun Google yang pernah login) ---------- */

export async function ambilUsers() {
  const snap = await sdk.getDocs(sdk.query(sdk.collection(db, 'users'), sdk.orderBy('nama')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function pantauUsers(cb) {
  return sdk.onSnapshot(
    sdk.query(sdk.collection(db, 'users'), sdk.orderBy('nama')),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
  );
}

export const ubahPeranUser = (uid, role) => sdk.updateDoc(sdk.doc(db, 'users', uid), { role });

/* ---------- sesi (buka/tutup manual oleh admin) ---------- */

const kunciSesi = (tanggal, sesiId) => `${tanggal}_${sesiId}`;

export async function ambilOverrideSesi(tanggal, sesiId) {
  const snap = await sdk.getDoc(sdk.doc(db, 'sesi', kunciSesi(tanggal, sesiId)));
  return snap.exists() ? snap.data().override || null : null;
}

/** Override semua sesi untuk satu tanggal: { siang: 'buka'|'tutup'|null, ... } */
export async function ambilOverrideHari(tanggal) {
  const snap = await sdk.getDocs(
    sdk.query(sdk.collection(db, 'sesi'), sdk.where('tanggal', '==', tanggal)),
  );
  const hasil = {};
  snap.docs.forEach((d) => { hasil[d.data().sesi] = d.data().override || null; });
  return hasil;
}

export async function setOverrideSesi(tanggal, sesiId, override) {
  await sdk.setDoc(sdk.doc(db, 'sesi', kunciSesi(tanggal, sesiId)), {
    tanggal, sesi: sesiId, override,
    oleh: sesiPengguna.user?.email || '',
    diubah: sdk.serverTimestamp(),
  }, { merge: true });
}

/* ---------- absensi ---------- */

export const idAbsensi = (tanggal, sesiId, anggotaId) => `${tanggal}_${sesiId}_${anggotaId}`;

/**
 * Mencatat kehadiran. Satu anggota hanya punya satu catatan per sesi per hari
 * (dijamin oleh ID dokumen), jadi scan dua kali tidak menggandakan data.
 */
export async function catatAbsen({ anggota, sesiId, tanggal = kunciTanggal(), kegiatan = [], catatan = '', metode = 'qr' }) {
  const sesi = sesiById(sesiId);
  const id = idAbsensi(tanggal, sesiId, anggota.id);
  const ref = sdk.doc(db, 'absensi', id);

  if ((await sdk.getDoc(ref)).exists()) {
    const e = new Error('Sudah tercatat hadir untuk sesi ini.');
    e.kode = 'sudah-absen';
    throw e;
  }

  const data = {
    tanggal,
    sesi: sesiId,
    anggotaId: anggota.id,
    nama: anggota.nama,
    gender: anggota.gender || '',
    // Untuk absen manual, catatan tetap milik anggota bersangkutan; siapa yang
    // menuliskannya tersimpan terpisah di dicatatOleh.
    uid: metode === 'manual' ? (anggota.uid || null) : (sesiPengguna.user?.uid || null),
    email: metode === 'manual' ? (anggota.email || '') : (sesiPengguna.user?.email || ''),
    kegiatan,
    catatan: catatan.trim(),
    metode,
    ketepatan: metode === 'manual' ? 'tepat' : statusKetepatan(sesi),
    malamJumat: malamJumat(tanggal, sesiId),
    waktu: sdk.serverTimestamp(),
    jamLokal: new Date().toTimeString().slice(0, 5),
    dicatatOleh: sesiPengguna.user?.email || '',
  };
  await sdk.setDoc(ref, data);
  return { id, ...data };
}

export const hapusAbsen = (id) => sdk.deleteDoc(sdk.doc(db, 'absensi', id));

export function pantauAbsensiHari(tanggal, cb) {
  return sdk.onSnapshot(
    sdk.query(sdk.collection(db, 'absensi'), sdk.where('tanggal', '==', tanggal)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([]),
  );
}

export async function ambilAbsensiRentang(dari, sampai) {
  const q = sdk.query(
    sdk.collection(db, 'absensi'),
    sdk.where('tanggal', '>=', dari),
    sdk.where('tanggal', '<=', sampai),
    sdk.orderBy('tanggal', 'asc'),
  );
  const snap = await sdk.getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
