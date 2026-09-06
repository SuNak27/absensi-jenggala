/* Fungsi bantu umum: waktu, format, DOM, CSV. */

import { SESI } from './config.js';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/* ---------- teks ---------- */

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function slug(teks) {
  return String(teks)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function inisial(nama) {
  const bagian = String(nama || '?').trim().split(/\s+/);
  return ((bagian[0]?.[0] || '') + (bagian[1]?.[0] || '')).toUpperCase() || '?';
}

/* ---------- tanggal & jam (memakai waktu perangkat) ---------- */

/** Date -> "2026-09-06" */
export function kunciTanggal(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "2026-09-06" -> Date lokal (bukan UTC) */
export function dariKunci(kunci) {
  const [y, m, d] = String(kunci).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-09-06" -> "Minggu, 6 September 2026" */
export function tanggalPanjang(kunci) {
  const d = typeof kunci === 'string' ? dariKunci(kunci) : kunci;
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-09-06" -> "6 Sep" */
export function tanggalPendek(kunci) {
  const d = typeof kunci === 'string' ? dariKunci(kunci) : kunci;
  return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)}`;
}

/** "2026-09" -> "September 2026" */
export function namaBulan(kunciBulan) {
  const [y, m] = String(kunciBulan).split('-').map(Number);
  return `${BULAN[m - 1]} ${y}`;
}

export function kunciBulanIni(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Awal & akhir bulan dalam bentuk kunci tanggal. */
export function rentangBulan(kunciBulan) {
  const [y, m] = String(kunciBulan).split('-').map(Number);
  return { dari: kunciTanggal(new Date(y, m - 1, 1)), sampai: kunciTanggal(new Date(y, m, 0)) };
}

export function jam(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}.${p(d.getMinutes())}`;
}

/** "12:00" -> menit sejak tengah malam */
export function keMenit(jjmm) {
  const [h, m] = String(jjmm).split(':').map(Number);
  return h * 60 + m;
}

export function menitSekarang(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Malam Jumat = malam hari Kamis (setelah magrib), jadi sesi malam di hari Kamis.
 */
export function malamJumat(kunci, sesiId) {
  return sesiId === 'malam' && dariKunci(kunci).getDay() === 4;
}

/** Kegiatan yang berlaku untuk tanggal + sesi tertentu. */
export function kegiatanSesi(sesiId, kunci) {
  const s = SESI.find((x) => x.id === sesiId);
  if (!s) return [];
  const mj = malamJumat(kunci, sesiId);
  return s.kegiatan.filter((k) => !k.hanyaMalamJumat || mj);
}

/**
 * Sesi yang jendela absennya sedang terbuka menurut jam perangkat.
 * @returns {{sesi: object, status: 'buka'} | {sesi: object|null, status: 'sebelum'|'sesudah'|'jeda'}}
 */
export function sesiSekarang(d = new Date()) {
  const now = menitSekarang(d);
  for (const s of SESI) {
    if (now >= keMenit(s.absenMulai) && now <= keMenit(s.absenSelesai)) {
      return { sesi: s, status: 'buka' };
    }
  }
  const berikut = SESI.find((s) => now < keMenit(s.absenMulai));
  return { sesi: berikut || null, status: berikut ? 'sebelum' : 'sesudah' };
}

/** 'tepat' | 'terlambat' berdasarkan jam absen terhadap jam mulai sesi. */
export function statusKetepatan(sesi, d = new Date()) {
  if (!sesi) return 'tepat';
  return menitSekarang(d) > keMenit(sesi.mulai) + (sesi.toleransi ?? 0) ? 'terlambat' : 'tepat';
}

/* ---------- DOM ---------- */

export const $ = (sel, induk = document) => induk.querySelector(sel);
export const $$ = (sel, induk = document) => Array.from(induk.querySelectorAll(sel));

export function toast(pesan, jenis = '') {
  const wadah = document.getElementById('toast');
  if (!wadah) return;
  const el = document.createElement('div');
  el.className = 'toast' + (jenis ? ` toast-${jenis}` : '');
  el.textContent = pesan;
  wadah.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

export function memuat(teks = 'Memuat…') {
  return `<div class="muat"><div class="putar"></div>${esc(teks)}</div>`;
}

export function kosong(judul, keterangan = '') {
  return `<div class="kosong"><strong>${esc(judul)}</strong>${keterangan ? esc(keterangan) : ''}</div>`;
}

/* ---------- CSV ---------- */

export function unduhCsv(namaBerkas, baris) {
  const isi = baris
    .map((r) => r.map((sel) => {
      const s = String(sel ?? '');
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(';'))
    .join('\r\n');
  // BOM supaya Excel membaca UTF-8 dengan benar
  const blob = new Blob(['\uFEFF' + isi], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- pemuat skrip eksternal (sekali saja) ---------- */

const skripDimuat = new Map();

export function muatSkrip(src) {
  if (skripDimuat.has(src)) return skripDimuat.get(src);
  const p = new Promise((selesai, gagal) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => selesai();
    s.onerror = () => gagal(new Error(`Gagal memuat ${src}`));
    document.head.appendChild(s);
  });
  skripDimuat.set(src, p);
  return p;
}
