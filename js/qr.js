/* Bukti "baru saja scan QR resmi", disimpan di sessionStorage.
   sessionStorage sengaja dipilih: hilang saat tab ditutup, jadi tiap datang ke
   lokasi orang harus scan lagi — bukan sekadar membuka bookmark. */

import { QR_BERLAKU_MENIT } from './config.js';

const KUNCI = 'jenggala.qrOk';

export function tandaiScanSah() {
  try { sessionStorage.setItem(KUNCI, String(Date.now())); } catch { /* abaikan */ }
}

export function hapusScan() {
  try { sessionStorage.removeItem(KUNCI); } catch { /* abaikan */ }
}

/** Sisa masa berlaku scan dalam menit (0 kalau tidak/ sudah kedaluwarsa). */
export function sisaMenitScan() {
  let nilai = null;
  try { nilai = sessionStorage.getItem(KUNCI); } catch { return 0; }
  if (!nilai) return 0;
  const lewat = (Date.now() - Number(nilai)) / 60000;
  const sisa = QR_BERLAKU_MENIT - lewat;
  return sisa > 0 ? Math.ceil(sisa) : 0;
}

export const scanSah = () => sisaMenitScan() > 0;

/** Ambil token dari teks hasil scan, baik berupa URL penuh maupun token polos. */
export function tokenDariTeks(teks) {
  const s = String(teks || '').trim();
  if (!s) return '';
  try {
    const url = new URL(s);
    const dariQuery = url.searchParams.get('k');
    if (dariQuery) return dariQuery;
    const hash = url.hash || '';
    const tanya = hash.indexOf('?');
    if (tanya >= 0) {
      const p = new URLSearchParams(hash.slice(tanya + 1));
      if (p.get('k')) return p.get('k');
    }
    return '';
  } catch {
    return s; // bukan URL — anggap token polos
  }
}
