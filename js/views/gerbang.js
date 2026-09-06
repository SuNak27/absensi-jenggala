/* Halaman tujuan QR: #/absen?k=TOKEN
   Memeriksa token lalu melempar ke beranda dalam keadaan "sudah scan". */

import { ambilPengaturan } from '../store.js';
import { tandaiScanSah } from '../qr.js';
import { esc } from '../util.js';
import { pergiKe } from '../app.js';

export async function render(kontainer, params) {
  const token = (params.get('k') || '').trim();
  const { qrToken } = await ambilPengaturan();

  if (token && token === qrToken) {
    tandaiScanSah();
    pergiKe('', true);
    return;
  }

  kontainer.innerHTML = `
    <div class="judul-hal">
      <h1>QR tidak dikenali</h1>
      <p>Kode di dalam QR ini tidak cocok dengan QR resmi Jenggala.</p>
    </div>
    <div class="kartu">
      <p class="pesan pesan-merah">
        ${token
          ? `Kode terbaca: <strong>${esc(token)}</strong>`
          : 'QR tidak memuat kode absensi sama sekali.'}
      </p>
      <p>Kemungkinan penyebabnya:</p>
      <ul>
        <li>QR yang dipakai adalah cetakan lama — admin sudah mengganti kodenya.</li>
        <li>Yang di-scan bukan QR absensi Jenggala.</li>
      </ul>
      <p class="btn-baris">
        <a class="btn btn-utama" href="#/scan">Scan ulang</a>
        <a class="btn" href="#/">Ke beranda</a>
      </p>
    </div>`;
}
