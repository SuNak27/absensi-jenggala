/* Pemindai QR di dalam aplikasi (cadangan kalau kamera bawaan HP tidak dipakai). */

import { ambilPengaturan } from '../store.js';
import { tandaiScanSah, tokenDariTeks } from '../qr.js';
import { esc, toast, muatSkrip } from '../util.js';
import { pergiKe } from '../app.js';

const LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';

export async function render(kontainer) {
  const { qrToken } = await ambilPengaturan();
  let pemindai = null;
  let berhenti = false;

  kontainer.innerHTML = `
    <div class="judul-hal">
      <h1>Scan QR Absensi</h1>
      <p>Arahkan kamera ke QR yang dipasang di lokasi.</p>
    </div>
    <div class="kartu">
      <div id="pemindai"></div>
      <p id="pesan-pindai" class="catatan" style="margin-top:12px; text-align:center">Menyalakan kamera…</p>
      <p class="btn-baris" style="justify-content:center; margin-top:8px">
        <a class="btn" href="#/">Batal</a>
      </p>
    </div>
    <div class="kartu kartu-info">
      <h3>Kamera tidak mau menyala?</h3>
      <p class="catatan">Tutup halaman ini, lalu scan QR-nya memakai <strong>aplikasi Kamera bawaan HP</strong>. Nanti akan muncul tautan yang membuka aplikasi ini dengan sendirinya. Kamera dalam aplikasi hanya bisa jalan di halaman <code>https</code> dan setelah izin kamera diberikan.</p>
    </div>`;

  const pesan = kontainer.querySelector('#pesan-pindai');

  try {
    await muatSkrip(LIB);
  } catch {
    pesan.className = 'pesan pesan-merah';
    pesan.textContent = 'Gagal memuat pemindai. Periksa koneksi internet, atau pakai kamera bawaan HP.';
    return;
  }
  if (berhenti) return;

  const Html5Qrcode = window.Html5Qrcode;
  pemindai = new Html5Qrcode('pemindai', { verbose: false });

  const tangani = async (teks) => {
    const token = tokenDariTeks(teks);
    if (token !== qrToken) {
      pesan.className = 'pesan pesan-merah';
      pesan.textContent = 'QR ini bukan QR absensi Jenggala yang berlaku.';
      return;
    }
    berhenti = true;
    try { await pemindai.stop(); } catch { /* abaikan */ }
    tandaiScanSah();
    toast('QR terbaca. Silakan absen.', 'sukses');
    pergiKe('', true);
  };

  try {
    await pemindai.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      tangani,
      () => { /* frame tanpa QR — abaikan */ },
    );
    pesan.textContent = 'Kamera aktif. Dekatkan QR ke dalam kotak.';
  } catch (e) {
    pesan.className = 'pesan pesan-merah';
    pesan.innerHTML = `Kamera tidak bisa dibuka: ${esc(e?.message || e)}`;
  }

  return () => {
    berhenti = true;
    if (pemindai) {
      pemindai.stop().then(() => pemindai.clear()).catch(() => { /* sudah berhenti */ });
    }
  };
}
