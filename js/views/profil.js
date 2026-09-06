/* Profil: akun Google, nama yang tertaut, dan ringkasan kehadiran sendiri. */

import { SESI } from '../config.js';
import { sesiPengguna, keluar, pesanGalat, segarkanProfil } from '../fb.js';
import { ambilAbsensiRentang, lepasAnggota } from '../store.js';
import { hapusScan } from '../qr.js';
import {
  $, esc, inisial, toast, kunciTanggal, kunciBulanIni, namaBulan, rentangBulan,
  tanggalPanjang, kosong,
} from '../util.js';
import { pergiKe } from '../app.js';

export async function render(kontainer) {
  if (!sesiPengguna.masuk) { pergiKe('', true); return; }

  const user = sesiPengguna.user;
  const anggota = sesiPengguna.anggota;
  const bulan = kunciBulanIni();
  const { dari } = rentangBulan(bulan);

  let riwayat = [];
  if (anggota) {
    try {
      const semua = await ambilAbsensiRentang(dari, kunciTanggal());
      riwayat = semua
        .filter((r) => r.anggotaId === anggota.id)
        .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (b.jamLokal || '').localeCompare(a.jamLokal || ''));
    } catch { /* tampilkan profil walau riwayat gagal dimuat */ }
  }

  kontainer.innerHTML = `
    <div class="judul-hal"><h1>Profil</h1></div>

    <div class="kartu">
      <div style="display:flex; gap:14px; align-items:center">
        <span class="avatar" style="width:52px;height:52px;font-size:1rem">
          ${user.photoURL
            ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">`
            : esc(inisial(anggota?.nama || user.displayName || user.email))}
        </span>
        <div style="min-width:0">
          <h2 style="margin:0">${esc(anggota?.nama || user.displayName || 'Tanpa nama')}</h2>
          <p class="catatan" style="margin:0; word-break:break-all">${esc(user.email || '')}</p>
          <p style="margin:6px 0 0">
            ${sesiPengguna.admin ? '<span class="lencana lencana-oranye">Admin</span> ' : ''}
            ${anggota
              ? `<span class="lencana lencana-hijau">${anggota.gender === 'P' ? 'Perempuan' : 'Laki-laki'}</span>`
              : '<span class="lencana">Belum pilih nama</span>'}
          </p>
        </div>
      </div>

      <div class="btn-baris" style="margin-top:16px">
        ${anggota ? '<button class="btn" id="tbl-ganti-nama" type="button">Ganti nama yang tertaut</button>' : ''}
        <button class="btn btn-bahaya" id="tbl-keluar" type="button">Keluar</button>
      </div>
    </div>

    ${anggota ? `
      <div class="kartu">
        <div class="kartu-kepala">
          <h2>Kehadiranmu — ${esc(namaBulan(bulan))}</h2>
          <span class="lencana">${riwayat.length} sesi</span>
        </div>
        <dl class="statistik" style="margin-bottom:0">
          ${SESI.map((s) => `
            <div class="stat">
              <dt>${esc(s.nama)}</dt>
              <dd>${riwayat.filter((r) => r.sesi === s.id).length}</dd>
            </div>`).join('')}
          <div class="stat">
            <dt>Terlambat</dt>
            <dd>${riwayat.filter((r) => r.ketepatan === 'terlambat').length}</dd>
          </div>
        </dl>
      </div>

      <div class="kartu">
        <h2>Riwayat bulan ini</h2>
        ${riwayat.length ? `
          <ul class="hadir-daftar">
            ${riwayat.map((r) => `
              <li>
                <span class="hadir-nama">
                  ${esc(tanggalPanjang(r.tanggal))}
                  <br><span class="catatan">${esc(SESI.find((s) => s.id === r.sesi)?.nama || r.sesi)} &middot; ${(r.kegiatan || []).length} kegiatan</span>
                </span>
                ${r.ketepatan === 'terlambat' ? '<span class="lencana lencana-oranye">Telat</span>' : ''}
                <span class="hadir-jam">${esc((r.jamLokal || '').replace(':', '.'))}</span>
              </li>`).join('')}
          </ul>` : kosong('Belum ada kehadiran bulan ini')}
      </div>` : `
      <div class="kartu">
        <p class="pesan pesan-oranye">Kamu belum memilih nama, jadi kehadiran belum bisa dicatat.</p>
        <p><a class="btn btn-utama" href="#/">Pilih nama sekarang</a></p>
      </div>`}`;

  $('#tbl-keluar', kontainer).onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      await keluar();
      hapusScan();
      pergiKe('');
    } catch (err) {
      toast(pesanGalat(err), 'galat');
      e.currentTarget.disabled = false;
    }
  };

  const ganti = $('#tbl-ganti-nama', kontainer);
  if (ganti) {
    ganti.onclick = async () => {
      if (!confirm(`Lepas kaitan akunmu dari nama "${anggota.nama}"?\n\nSetelah ini kamu diminta memilih nama lagi. Riwayat kehadiran yang sudah tercatat tetap aman.`)) return;
      ganti.disabled = true;
      try {
        await lepasAnggota(anggota.id, user.uid);
        await segarkanProfil();
        toast('Silakan pilih namamu lagi.');
        pergiKe('');
      } catch (err) { toast(pesanGalat(err), 'galat'); ganti.disabled = false; }
    };
  }
}
