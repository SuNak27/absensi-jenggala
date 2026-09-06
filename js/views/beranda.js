/* Beranda: status hari ini, tombol absen, dan daftar yang sudah hadir. */

import { SESI, sesiById } from '../config.js';
import { sesiPengguna, masukGoogle, pesanGalat, segarkanProfil } from '../fb.js';
import {
  ambilAnggota, pantauAbsensiHari, catatAbsen, tautkanAnggota, ambilOverrideHari,
} from '../store.js';
import { scanSah, sisaMenitScan, hapusScan } from '../qr.js';
import {
  $, $$, esc, inisial, toast, kunciTanggal, tanggalPanjang, jam, sesiSekarang,
  kegiatanSesi, malamJumat, statusKetepatan, kosong,
} from '../util.js';

export async function render(kontainer) {
  const hariIni = kunciTanggal();
  let lepasPantau = null;
  let jamInterval = null;

  /* ---------- belum masuk ---------- */
  if (!sesiPengguna.masuk) {
    kontainer.innerHTML = tampilanTamu(hariIni);
    $('#tbl-masuk-besar').onclick = async (e) => {
      e.currentTarget.disabled = true;
      try { await masukGoogle(); } catch (err) { toast(pesanGalat(err), 'galat'); }
      e.currentTarget.disabled = false;
    };
    return;
  }

  /* ---------- sudah masuk, belum pilih nama ---------- */
  if (!sesiPengguna.anggota) {
    const daftar = await ambilAnggota();
    if (!daftar.length) {
      kontainer.innerHTML = `
        <div class="judul-hal"><h1>Data anggota masih kosong</h1></div>
        <div class="kartu">
          <p>Admin perlu mengisi daftar anggota lebih dulu lewat menu <strong>Admin → Anggota → Isi data anggota</strong>.</p>
          ${sesiPengguna.admin ? '<p><a class="btn btn-utama" href="#/admin">Buka menu Admin</a></p>' : ''}
        </div>`;
      return;
    }
    kontainer.innerHTML = tampilanPilihNama(daftar);
    $$('#pilih-nama button[data-id]').forEach((b) => {
      b.onclick = async () => {
        $$('#pilih-nama button').forEach((x) => { x.disabled = true; });
        try {
          await tautkanAnggota(b.dataset.id);
          await segarkanProfil();
          toast(`Halo, ${b.dataset.nama}!`, 'sukses');
          render(kontainer);
        } catch (err) {
          toast(pesanGalat(err), 'galat');
          $$('#pilih-nama button').forEach((x) => { x.disabled = x.dataset.terpakai === '1'; });
        }
      };
    });
    return;
  }

  /* ---------- sudah masuk & tertaut ---------- */
  const anggota = sesiPengguna.anggota;
  let override = {};
  try { override = await ambilOverrideHari(hariIni); } catch { /* jaringan bermasalah — pakai jam saja */ }

  let absensiHariIni = [];
  let sidik = null;

  gambar();

  // Perubahan kehadiran orang lain hanya menyegarkan daftar hadir, supaya
  // centang kegiatan yang sedang diisi tidak ikut hilang.
  lepasPantau = pantauAbsensiHari(hariIni, (data) => {
    const sebelum = sidikSendiri(absensiHariIni);
    absensiHariIni = data;
    if (sidikSendiri(data) !== sebelum) gambar();
    else perbaruiDaftarHadir();
  });

  jamInterval = setInterval(() => {
    const el = $('#jam-hidup');
    if (el) el.textContent = jam();
    if (hitungSidik() !== sidik) gambar();
  }, 5000);

  function sidikSendiri(data) {
    return data
      .filter((a) => a.anggotaId === anggota.id)
      .map((a) => `${a.sesi}:${a.ketepatan}`)
      .sort()
      .join(',');
  }

  function kondisiKini() {
    const { sesi, status } = sesiSekarang();
    return kondisiSesi(sesi, status, override);
  }

  function hitungSidik() {
    const k = kondisiKini();
    return `${k.sesi?.id || '-'}|${k.buka}|${k.alasan}|${scanSah()}`;
  }

  function gambar() {
    const kondisi = kondisiKini();
    sidik = hitungSidik();
    const sudah = absensiHariIni.find(
      (a) => a.anggotaId === anggota.id && kondisi.sesi && a.sesi === kondisi.sesi.id,
    );

    kontainer.innerHTML = `
      ${kartuHari(hariIni, kondisi)}
      ${sudah ? kartuSudahAbsen(sudah) : kartuAbsen(kondisi, hariIni)}
      <div class="kartu" id="kartu-hadir">${isiKartuHadir(absensiHariIni)}</div>
      ${kartuJadwal(hariIni)}`;

    pasangAksi(kondisi, hariIni);
  }

  function perbaruiDaftarHadir() {
    const el = $('#kartu-hadir');
    if (el) el.innerHTML = isiKartuHadir(absensiHariIni);
  }

  function pasangAksi(kondisi, tanggal) {
    const tbl = $('#tbl-absen');
    if (tbl) {
      tbl.onclick = async () => {
        tbl.disabled = true;
        tbl.textContent = 'Menyimpan…';
        const kegiatan = $$('#daftar-kegiatan input:checked').map((i) => i.value);
        const catatan = $('#catatan-absen')?.value || '';
        try {
          await catatAbsen({ anggota, sesiId: kondisi.sesi.id, tanggal, kegiatan, catatan, metode: 'qr' });
          hapusScan();
          toast('Kehadiran tercatat. Terima kasih!', 'sukses');
        } catch (err) {
          if (err.kode === 'sudah-absen') toast('Kamu sudah tercatat hadir di sesi ini.');
          else toast(pesanGalat(err), 'galat');
          tbl.disabled = false;
          tbl.textContent = 'Absen Sekarang';
        }
      };
    }
    const semua = $('#tbl-centang-semua');
    if (semua) {
      semua.onclick = () => {
        const kotak = $$('#daftar-kegiatan input');
        const adaYangKosong = kotak.some((k) => !k.checked);
        kotak.forEach((k) => { k.checked = adaYangKosong; });
      };
    }
  }

  return () => {
    if (lepasPantau) lepasPantau();
    if (jamInterval) clearInterval(jamInterval);
  };
}

/* ==========================================================================
   Penentu kondisi
   ========================================================================== */

/**
 * Menggabungkan jam perangkat dengan override admin.
 * @returns {{sesi: object|null, buka: boolean, alasan: string}}
 */
function kondisiSesi(sesiJam, statusJam, override) {
  // Admin membuka sesi secara manual di luar jam.
  const dibukaManual = SESI.find((s) => override[s.id] === 'buka');
  if (dibukaManual && (!sesiJam || override[sesiJam.id] === 'tutup' || statusJam !== 'buka')) {
    return { sesi: dibukaManual, buka: true, alasan: 'dibuka-admin' };
  }
  if (!sesiJam) return { sesi: null, buka: false, alasan: 'selesai' };
  if (statusJam !== 'buka') return { sesi: sesiJam, buka: false, alasan: 'belum-mulai' };
  if (override[sesiJam.id] === 'tutup') return { sesi: sesiJam, buka: false, alasan: 'ditutup-admin' };
  return { sesi: sesiJam, buka: true, alasan: 'jadwal' };
}

/* ==========================================================================
   Potongan tampilan
   ========================================================================== */

function kartuHari(tanggal, kondisi) {
  const { sesi, buka, alasan } = kondisi;
  let lencana;
  if (buka) {
    lencana = `<span class="lencana lencana-hijau"><span class="titik"></span>${esc(sesi.nama)} berlangsung</span>`;
  } else if (alasan === 'belum-mulai') {
    lencana = `<span class="lencana lencana-oranye">${esc(sesi.nama)} mulai ${esc(sesi.absenMulai.replace(':', '.'))}</span>`;
  } else if (alasan === 'ditutup-admin') {
    lencana = '<span class="lencana lencana-merah">Sesi ditutup admin</span>';
  } else {
    lencana = '<span class="lencana">Di luar jam absen</span>';
  }

  return `
    <div class="kartu kartu-aksen">
      <div class="kartu-kepala">
        <div>
          <p class="catatan" style="margin:0">${esc(tanggalPanjang(tanggal))}</p>
          <div class="jam-besar" id="jam-hidup">${esc(jam())}</div>
        </div>
        <div>${lencana}</div>
      </div>
      ${malamJumat(tanggal, 'malam')
        ? '<p class="pesan pesan-oranye" style="margin:10px 0 0">Malam ini <strong>malam Jumat</strong> — ada pembacaan istigosah rutinan di sesi malam.</p>'
        : ''}
    </div>`;
}

function kartuAbsen(kondisi, tanggal) {
  const { sesi, buka, alasan } = kondisi;

  if (!buka) {
    const pesan = {
      'belum-mulai': `Absen sesi ini dibuka mulai pukul ${sesi?.absenMulai.replace(':', '.')}.`,
      'ditutup-admin': 'Admin menutup sesi ini. Hubungi admin kalau kamu memang hadir.',
      'selesai': 'Kegiatan hari ini sudah selesai. Sampai jumpa besok!',
    }[alasan] || 'Belum waktunya absen.';
    return `
      <div class="kartu">
        <h2>Belum bisa absen</h2>
        <p class="catatan">${esc(pesan)}</p>
      </div>`;
  }

  if (!scanSah()) {
    return `
      <div class="kartu">
        <h2>Scan QR dulu</h2>
        <p class="catatan">Arahkan kamera ke QR Absensi Jenggala yang dipasang di lokasi. Kehadiran hanya bisa dicatat setelah QR terbaca.</p>
        <p class="btn-baris" style="margin-top:14px">
          <a class="btn btn-utama btn-besar" href="#/scan">Buka Kamera &amp; Scan QR</a>
        </p>
      </div>`;
  }

  const daftar = kegiatanSesi(sesi.id, tanggal);
  const terlambat = statusKetepatan(sesi) === 'terlambat';

  return `
    <div class="kartu">
      <div class="kartu-kepala">
        <h2>${esc(sesi.nama)} &middot; ${esc(sesi.mulai.replace(':', '.'))}–${esc(sesi.selesai.replace(':', '.'))}</h2>
        <span class="lencana lencana-hijau"><span class="titik"></span>QR sah &middot; ${sisaMenitScan()} mnt</span>
      </div>
      ${terlambat ? '<p class="pesan pesan-oranye">Sudah lewat jam mulai — kehadiranmu dicatat sebagai <strong>terlambat</strong>.</p>' : ''}

      <div class="kartu-kepala" style="margin-bottom:2px">
        <h3>Kegiatan yang dikerjakan</h3>
        <button class="btn btn-kecil" id="tbl-centang-semua" type="button">Centang semua</button>
      </div>
      <p class="catatan" style="margin-bottom:6px">Hilangkan centang untuk kegiatan yang tidak kamu kerjakan.</p>
      <ul class="kegiatan" id="daftar-kegiatan">
        ${daftar.map((k) => `
          <li>
            <label>
              <input type="checkbox" value="${esc(k.id)}" checked>
              <span>${esc(k.nama)}${k.hanyaMalamJumat ? '<span class="khusus">Khusus malam Jumat</span>' : ''}</span>
            </label>
          </li>`).join('')}
      </ul>

      <div class="bidang">
        <label for="catatan-absen">Catatan (opsional)</label>
        <textarea id="catatan-absen" placeholder="Misal: datang telat karena hujan"></textarea>
      </div>

      <button class="btn btn-utama btn-besar" id="tbl-absen" type="button">Absen Sekarang</button>
    </div>`;
}

function kartuSudahAbsen(a) {
  const sesi = sesiById(a.sesi);
  const daftar = kegiatanSesi(a.sesi, a.tanggal);
  const dikerjakan = daftar.filter((k) => (a.kegiatan || []).includes(k.id));
  return `
    <div class="kartu kartu-sukses">
      <div class="kartu-kepala">
        <h2 style="color:var(--hijau-tua)">Kehadiran tercatat</h2>
        <span class="lencana ${a.ketepatan === 'terlambat' ? 'lencana-oranye' : 'lencana-hijau'}">
          ${a.ketepatan === 'terlambat' ? 'Terlambat' : 'Tepat waktu'}
        </span>
      </div>
      <p style="margin-bottom:10px">
        <strong>${esc(sesi?.nama || a.sesi)}</strong> &middot; pukul ${esc((a.jamLokal || '').replace(':', '.'))}
      </p>
      ${dikerjakan.length ? `
        <p class="catatan" style="margin-bottom:4px">Kegiatan yang dicatat:</p>
        <ul style="margin:0 0 6px; padding-left:20px; font-size:.9rem">
          ${dikerjakan.map((k) => `<li>${esc(k.nama)}</li>`).join('')}
        </ul>` : '<p class="catatan">Tidak ada kegiatan yang dicentang.</p>'}
      ${a.catatan ? `<p class="catatan">Catatan: ${esc(a.catatan)}</p>` : ''}
    </div>`;
}

function isiKartuHadir(absensi) {
  const urut = [...absensi].sort((a, b) => (a.jamLokal || '').localeCompare(b.jamLokal || ''));
  const perSesi = SESI.map((s) => ({ sesi: s, isi: urut.filter((a) => a.sesi === s.id) })).filter((g) => g.isi.length);

  return `
      <div class="kartu-kepala">
        <h2>Sudah hadir hari ini</h2>
        <span class="lencana">${absensi.length} catatan</span>
      </div>
      ${perSesi.length ? perSesi.map((g) => `
        <h3 style="margin:14px 0 2px; font-size:.82rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted)">
          ${esc(g.sesi.nama)} &middot; ${g.isi.length} orang
        </h3>
        <ul class="hadir-daftar">
          ${g.isi.map((a) => `
            <li>
              <span class="avatar ${a.gender === 'P' ? 'avatar-p' : ''}">${esc(inisial(a.nama))}</span>
              <span class="hadir-nama">${esc(a.nama)}</span>
              ${a.ketepatan === 'terlambat' ? '<span class="lencana lencana-oranye">Telat</span>' : ''}
              <span class="hadir-jam">${esc((a.jamLokal || '').replace(':', '.'))}</span>
            </li>`).join('')}
        </ul>`).join('')
        : kosong('Belum ada yang absen hari ini', 'Jadilah yang pertama.')}`;
}

function kartuJadwal(tanggal) {
  return `
    <div class="kartu kartu-info">
      <h2>Jadwal kegiatan</h2>
      ${SESI.map((s) => `
        <h3 style="margin:14px 0 6px">${esc(s.nama)} &middot; ${esc(s.mulai.replace(':', '.'))}–${esc(s.selesai.replace(':', '.'))}</h3>
        <ol style="margin:0; padding-left:20px; font-size:.9rem; color:var(--ink-2)">
          ${kegiatanSesi(s.id, tanggal).map((k) => `<li>${esc(k.nama)}</li>`).join('')}
        </ol>`).join('')}
    </div>`;
}

function tampilanTamu(tanggal) {
  const { sesi, status } = sesiSekarang();
  return `
    <div class="judul-hal">
      <h1>Selamat datang</h1>
      <p>${esc(tanggalPanjang(tanggal))}</p>
    </div>
    <div class="kartu kartu-aksen">
      <h2>Masuk untuk mencatat kehadiran</h2>
      <p class="catatan">Pakai akun Google-mu. Cukup sekali pilih nama, seterusnya langsung dikenali.</p>
      <p class="btn-baris" style="margin-top:14px">
        <button class="btn btn-utama btn-besar" id="tbl-masuk-besar" type="button">Masuk dengan Google</button>
      </p>
    </div>
    <div class="kartu">
      <h2>Cara absen</h2>
      <ol style="margin:0; padding-left:20px">
        <li>Scan QR Absensi Jenggala yang dipasang di lokasi.</li>
        <li>Masuk dengan akun Google dan pilih namamu (sekali saja).</li>
        <li>Centang kegiatan yang dikerjakan, tekan <strong>Absen Sekarang</strong>.</li>
      </ol>
    </div>
    ${status === 'buka' && sesi
      ? `<p class="pesan pesan-hijau"><strong>${esc(sesi.nama)}</strong> sedang berlangsung (${esc(sesi.mulai.replace(':', '.'))}–${esc(sesi.selesai.replace(':', '.'))}).</p>`
      : ''}
    ${kartuJadwal(tanggal)}`;
}

function tampilanPilihNama(daftar) {
  const uid = sesiPengguna.user.uid;
  const grup = [
    { judul: 'Laki-laki', isi: daftar.filter((a) => a.gender === 'L' && a.aktif !== false) },
    { judul: 'Perempuan', isi: daftar.filter((a) => a.gender === 'P' && a.aktif !== false) },
  ].filter((g) => g.isi.length);

  return `
    <div class="judul-hal">
      <h1>Yang mana namamu?</h1>
      <p>Pilih sekali saja — akun Google-mu akan terhubung ke nama ini.</p>
    </div>
    <div class="kartu" id="pilih-nama">
      ${grup.map((g) => `
        <h3 style="margin:6px 0 8px; font-size:.82rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted)">${esc(g.judul)}</h3>
        <div class="pilih-nama" style="margin-bottom:18px">
          ${g.isi.map((a) => {
            const terpakai = Boolean(a.uid) && a.uid !== uid;
            return `
              <button type="button" data-id="${esc(a.id)}" data-nama="${esc(a.nama)}"
                      data-terpakai="${terpakai ? 1 : 0}" ${terpakai ? 'disabled' : ''}>
                ${esc(a.nama)}
                ${terpakai ? '<span class="sub">sudah dipakai</span>' : ''}
              </button>`;
          }).join('')}
        </div>`).join('')}
      <p class="catatan">Namamu tidak ada atau salah pilih? Hubungi admin untuk memperbaikinya.</p>
    </div>`;
}
