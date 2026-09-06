/* Poster QR siap cetak. Bisa dibuka walau Firebase belum diatur. */

import { firebaseSiap, QR_TOKEN_AWAL, SESI, HAK_CIPTA } from '../config.js';
import { ambilPengaturan } from '../store.js';
import { esc, toast } from '../util.js';

const LIB = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm';

/** Alamat lengkap yang ditanam di QR. */
export function alamatQr(token) {
  const dasar = location.href.split('#')[0];
  return `${dasar}#/absen?k=${encodeURIComponent(token)}`;
}

let pustakaQr = null;

export async function gambarQr(canvas, teks, ukuran = 320) {
  if (!pustakaQr) {
    const mod = await import(/* @vite-ignore */ LIB);
    pustakaQr = mod.default || mod;
  }
  await pustakaQr.toCanvas(canvas, teks, {
    width: ukuran,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1E2114', light: '#FFFFFF' },
  });
}

export async function render(kontainer) {
  let token = QR_TOKEN_AWAL;
  if (firebaseSiap) {
    try { ({ qrToken: token } = await ambilPengaturan()); } catch { /* pakai token bawaan */ }
  }
  const alamat = alamatQr(token);

  kontainer.innerHTML = `
    <div class="judul-hal cetak-sembunyi">
      <h1>QR untuk dicetak</h1>
      <p>Cetak, laminasi, lalu pasang di lokasi kegiatan.</p>
    </div>

    <div class="btn-baris cetak-sembunyi" style="margin-bottom:16px">
      <button class="btn btn-utama" id="tbl-cetak" type="button">Cetak poster</button>
      <button class="btn" id="tbl-unduh" type="button">Unduh QR (PNG)</button>
      <button class="btn" id="tbl-salin" type="button">Salin tautan</button>
    </div>

    <div class="poster" id="poster">
      <img class="poster-logo" src="assets/logo-stacked.png" alt="Jenggala — Jejaring Jaga Alam">
      <h2>ABSENSI JENGGALA</h2>
      <p class="poster-sub">Scan untuk mencatat kehadiranmu</p>
      <div class="qr-cetak"><canvas id="kanvas-qr"></canvas></div>
      <ol>
        <li>Buka kamera HP, arahkan ke QR di atas.</li>
        <li>Ketuk tautan yang muncul.</li>
        <li>Masuk dengan Google, centang kegiatan, tekan <strong>Absen Sekarang</strong>.</li>
      </ol>
      <div class="poster-jadwal">
        ${SESI.map((s) => `
          <div><b>${esc(s.nama)}</b>${esc(s.mulai.replace(':', '.'))} – ${esc(s.selesai.replace(':', '.'))}</div>
        `).join('')}
      </div>
      <p class="poster-kaki">${esc(HAK_CIPTA)}</p>
    </div>

    <div class="kartu kartu-info cetak-sembunyi" style="margin-top:16px">
      <h3>Isi QR</h3>
      <p class="catatan" style="word-break:break-all">${esc(alamat)}</p>
      <p class="catatan">Pastikan aplikasi sudah online di alamat itu sebelum QR dicetak. Kalau nanti dipindah domain, cetak ulang QR-nya.</p>
    </div>`;

  const kanvas = kontainer.querySelector('#kanvas-qr');
  try {
    await gambarQr(kanvas, alamat, 360);
  } catch {
    kanvas.replaceWith(Object.assign(document.createElement('p'), {
      className: 'pesan pesan-merah',
      textContent: 'Gagal memuat pembuat QR. Periksa koneksi internet lalu muat ulang halaman.',
    }));
    return;
  }

  kontainer.querySelector('#tbl-cetak').onclick = () => window.print();

  kontainer.querySelector('#tbl-unduh').onclick = () => {
    const a = document.createElement('a');
    a.href = kanvas.toDataURL('image/png');
    a.download = 'qr-absensi-jenggala.png';
    a.click();
  };

  kontainer.querySelector('#tbl-salin').onclick = async () => {
    try {
      await navigator.clipboard.writeText(alamat);
      toast('Tautan disalin.', 'sukses');
    } catch {
      toast('Browser menolak menyalin. Salin manual dari kotak "Isi QR".');
    }
  };
}
