/* Menu admin: kehadiran hari ini, kelola anggota, kontrol sesi, dan QR. */

import { SESI, ANGGOTA_AWAL, ADMIN_EMAILS } from '../config.js';
import { sesiPengguna, pesanGalat } from '../fb.js';
import {
  ambilAnggota, isiAnggotaAwal, tambahAnggota, ubahAnggota, hapusAnggota, lepasAnggota,
  tautkanAnggota, pantauUsers, ubahPeranUser,
  pantauAbsensiHari, catatAbsen, hapusAbsen,
  ambilPengaturan, simpanPengaturan, ambilOverrideHari, setOverrideSesi,
} from '../store.js';
import { alamatQr, gambarQr } from './poster.js';
import {
  $, $$, esc, inisial, toast, kunciTanggal, tanggalPanjang, kegiatanSesi, kosong, memuat,
} from '../util.js';

const EMAIL_BOOTSTRAP = ADMIN_EMAILS.map((e) => e.trim().toLowerCase());
const adminBawaan = (email) => EMAIL_BOOTSTRAP.includes(String(email || '').toLowerCase());

const TAB = [
  { id: 'hari', label: 'Hari ini' },
  { id: 'anggota', label: 'Anggota' },
  { id: 'pengguna', label: 'Pengguna' },
  { id: 'qr', label: 'QR & Keamanan' },
];

export async function render(kontainer) {
  if (!sesiPengguna.admin) {
    kontainer.innerHTML = `
      <div class="judul-hal"><h1>Khusus admin</h1></div>
      <div class="kartu">
        <p class="pesan pesan-oranye">Akun <strong>${esc(sesiPengguna.user?.email || 'ini')}</strong> bukan admin.</p>
        <p class="catatan">Tambahkan emailnya ke <code>ADMIN_EMAILS</code> di <code>js/config.js</code> dan ke daftar yang sama di <code>firestore.rules</code>, lalu masuk ulang.</p>
        <p><a class="btn" href="#/">Ke beranda</a></p>
      </div>`;
    return;
  }

  let tabAktif = 'hari';
  let lepas = null;

  kontainer.innerHTML = `
    <div class="judul-hal">
      <h1>Admin</h1>
      <p>${esc(tanggalPanjang(kunciTanggal()))}</p>
    </div>
    <div class="tab-bar" role="tablist">
      ${TAB.map((t) => `<button role="tab" data-tab="${t.id}" aria-selected="${t.id === tabAktif}">${esc(t.label)}</button>`).join('')}
    </div>
    <div id="isi-tab">${memuat()}</div>`;

  $$('[data-tab]', kontainer).forEach((b) => {
    b.onclick = () => {
      tabAktif = b.dataset.tab;
      $$('[data-tab]', kontainer).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      bukaTab();
    };
  });

  await bukaTab();

  async function bukaTab() {
    if (lepas) { try { lepas(); } catch { /* abaikan */ } lepas = null; }
    const isi = $('#isi-tab', kontainer);
    isi.innerHTML = memuat();
    try {
      if (tabAktif === 'hari') lepas = await tabHariIni(isi);
      else if (tabAktif === 'anggota') await tabAnggota(isi);
      else if (tabAktif === 'pengguna') lepas = await tabPengguna(isi);
      else await tabQr(isi);
    } catch (e) {
      isi.innerHTML = `<p class="pesan pesan-merah">${esc(pesanGalat(e))}</p>`;
    }
  }

  return () => { if (lepas) lepas(); };
}

/* ==========================================================================
   Tab: Hari ini
   ========================================================================== */

async function tabHariIni(wadah) {
  const hariIni = kunciTanggal();
  const [anggota, override] = await Promise.all([ambilAnggota(), ambilOverrideHari(hariIni)]);
  let absensi = [];

  const lepas = pantauAbsensiHari(hariIni, (data) => { absensi = data; gambar(); });

  function gambar() {
    const hadirIds = new Set(absensi.map((a) => `${a.sesi}_${a.anggotaId}`));

    wadah.innerHTML = `
      <div class="kartu">
        <h2>Kontrol sesi</h2>
        <p class="catatan">Sesi buka otomatis sesuai jam. Pakai tombol ini kalau perlu membuka di luar jadwal atau menutup lebih awal.</p>
        ${SESI.map((s) => {
          const o = override[s.id] || null;
          const label = o === 'buka' ? 'Dibuka manual' : o === 'tutup' ? 'Ditutup manual' : 'Ikut jadwal';
          const kelas = o === 'buka' ? 'lencana-hijau' : o === 'tutup' ? 'lencana-merah' : '';
          return `
            <div class="kartu-kepala" style="margin:14px 0 0; padding-top:12px; border-top:1px solid var(--line)">
              <div>
                <strong>${esc(s.nama)}</strong>
                <span class="catatan"> &middot; ${esc(s.mulai.replace(':', '.'))}–${esc(s.selesai.replace(':', '.'))}</span>
                <br><span class="lencana ${kelas}">${esc(label)}</span>
              </div>
              <div class="btn-baris">
                <button class="btn btn-kecil" data-sesi="${s.id}" data-nilai="buka" ${o === 'buka' ? 'disabled' : ''}>Buka</button>
                <button class="btn btn-kecil" data-sesi="${s.id}" data-nilai="tutup" ${o === 'tutup' ? 'disabled' : ''}>Tutup</button>
                <button class="btn btn-kecil" data-sesi="${s.id}" data-nilai="" ${!o ? 'disabled' : ''}>Ikut jadwal</button>
              </div>
            </div>`;
        }).join('')}
      </div>

      <div class="kartu">
        <div class="kartu-kepala">
          <h2>Absen manual</h2>
          <span class="catatan">untuk yang HP-nya bermasalah</span>
        </div>
        <div class="baris-form">
          <div class="bidang">
            <label for="m-sesi">Sesi</label>
            <select id="m-sesi">${SESI.map((s) => `<option value="${s.id}">${esc(s.nama)}</option>`).join('')}</select>
          </div>
          <div class="bidang">
            <label for="m-anggota">Anggota</label>
            <select id="m-anggota"></select>
          </div>
          <button class="btn btn-hijau" id="m-simpan" type="button">Catat hadir</button>
        </div>
        <p class="catatan" style="margin-top:8px">Semua kegiatan sesi tersebut ikut dicentang, dan catatan ditandai sebagai input admin.</p>
      </div>

      <div class="kartu">
        <div class="kartu-kepala">
          <h2>Kehadiran hari ini</h2>
          <span class="lencana">${absensi.length} catatan</span>
        </div>
        ${absensi.length ? `
          <div class="tabel-gulir">
            <table>
              <thead>
                <tr><th>Nama</th><th>Sesi</th><th>Jam</th><th>Status</th><th>Cara</th><th>Kegiatan</th><th></th></tr>
              </thead>
              <tbody>
                ${[...absensi]
                  .sort((a, b) => a.sesi.localeCompare(b.sesi) || (a.jamLokal || '').localeCompare(b.jamLokal || ''))
                  .map((a) => `
                    <tr>
                      <td><strong>${esc(a.nama)}</strong></td>
                      <td>${esc(SESI.find((s) => s.id === a.sesi)?.nama || a.sesi)}</td>
                      <td>${esc((a.jamLokal || '').replace(':', '.'))}</td>
                      <td>${a.ketepatan === 'terlambat'
                        ? '<span class="lencana lencana-oranye">Telat</span>'
                        : '<span class="lencana lencana-hijau">Tepat</span>'}</td>
                      <td>${a.metode === 'manual' ? 'Manual' : 'Scan QR'}</td>
                      <td>${(a.kegiatan || []).length} / ${kegiatanSesi(a.sesi, a.tanggal).length}</td>
                      <td><button class="btn btn-kecil btn-bahaya" data-hapus="${esc(a.id)}" data-nama="${esc(a.nama)}">Hapus</button></td>
                    </tr>`).join('')}
              </tbody>
            </table>
          </div>` : kosong('Belum ada kehadiran hari ini')}
      </div>`;

    // isi pilihan anggota (yang belum hadir di sesi terpilih)
    const pilihSesi = $('#m-sesi', wadah);
    const pilihAnggota = $('#m-anggota', wadah);
    const isiPilihan = () => {
      const s = pilihSesi.value;
      const tersedia = anggota.filter((a) => a.aktif !== false && !hadirIds.has(`${s}_${a.id}`));
      pilihAnggota.innerHTML = tersedia.length
        ? tersedia.map((a) => `<option value="${esc(a.id)}">${esc(a.nama)}</option>`).join('')
        : '<option value="">— semua sudah hadir —</option>';
    };
    pilihSesi.onchange = isiPilihan;
    isiPilihan();

    $('#m-simpan', wadah).onclick = async (e) => {
      const id = pilihAnggota.value;
      if (!id) return;
      const orang = anggota.find((a) => a.id === id);
      e.target.disabled = true;
      try {
        const sesiId = pilihSesi.value;
        await catatAbsen({
          anggota: orang,
          sesiId,
          tanggal: hariIni,
          kegiatan: kegiatanSesi(sesiId, hariIni).map((k) => k.id),
          catatan: 'Dicatat manual oleh admin',
          metode: 'manual',
        });
        toast(`${orang.nama} dicatat hadir.`, 'sukses');
      } catch (err) {
        toast(err.kode === 'sudah-absen' ? 'Sudah tercatat hadir.' : pesanGalat(err), 'galat');
      }
      e.target.disabled = false;
    };

    $$('[data-sesi]', wadah).forEach((b) => {
      b.onclick = async () => {
        const nilai = b.dataset.nilai || null;
        try {
          await setOverrideSesi(hariIni, b.dataset.sesi, nilai);
          override[b.dataset.sesi] = nilai;
          toast('Status sesi diperbarui.', 'sukses');
          gambar();
        } catch (err) { toast(pesanGalat(err), 'galat'); }
      };
    });

    $$('[data-hapus]', wadah).forEach((b) => {
      b.onclick = async () => {
        if (!confirm(`Hapus catatan kehadiran ${b.dataset.nama}?`)) return;
        try {
          await hapusAbsen(b.dataset.hapus);
          toast('Catatan dihapus.');
        } catch (err) { toast(pesanGalat(err), 'galat'); }
      };
    });
  }

  return lepas;
}

/* ==========================================================================
   Tab: Anggota
   ========================================================================== */

async function tabAnggota(wadah) {
  const daftar = await ambilAnggota();

  wadah.innerHTML = `
    ${daftar.length ? '' : `
      <div class="kartu kartu-aksen">
        <h2>Daftar anggota masih kosong</h2>
        <p class="catatan">Isi otomatis dengan ${ANGGOTA_AWAL.length} nama dari <code>js/config.js</code>.</p>
        <p><button class="btn btn-utama" id="tbl-isi-awal" type="button">Isi data anggota</button></p>
      </div>`}

    <div class="kartu">
      <h2>Tambah anggota</h2>
      <div class="baris-form">
        <div class="bidang">
          <label for="a-nama">Nama</label>
          <input type="text" id="a-nama" placeholder="Nama panggilan" autocomplete="off">
        </div>
        <div class="bidang" style="flex:0 1 150px">
          <label for="a-gender">Kelompok</label>
          <select id="a-gender"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
        </div>
        <button class="btn btn-hijau" id="a-simpan" type="button">Tambah</button>
      </div>
    </div>

    <div class="kartu">
      <div class="kartu-kepala">
        <h2>Daftar anggota</h2>
        <span class="lencana">${daftar.length} orang</span>
      </div>
      ${daftar.length ? `
        <div class="tabel-gulir">
          <table>
            <thead><tr><th>Nama</th><th>Kelompok</th><th>Akun Google</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${daftar.map((a) => `
                <tr>
                  <td>
                    <span class="avatar ${a.gender === 'P' ? 'avatar-p' : ''}" style="display:inline-grid;vertical-align:middle;width:26px;height:26px;font-size:.7rem">${esc(inisial(a.nama))}</span>
                    <strong style="margin-left:6px">${esc(a.nama)}</strong>
                  </td>
                  <td>${a.gender === 'P' ? 'Perempuan' : 'Laki-laki'}</td>
                  <td>${a.email
                    ? `<span title="${esc(a.email)}">${esc(a.email)}</span>`
                    : '<span class="catatan">belum tertaut</span>'}</td>
                  <td>${a.aktif === false
                    ? '<span class="lencana">Nonaktif</span>'
                    : '<span class="lencana lencana-hijau">Aktif</span>'}</td>
                  <td>
                    <div class="btn-baris">
                      ${a.uid ? `<button class="btn btn-kecil" data-lepas="${esc(a.id)}" data-uid="${esc(a.uid)}" data-nama="${esc(a.nama)}">Lepas akun</button>` : ''}
                      <button class="btn btn-kecil" data-aktif="${esc(a.id)}" data-nilai="${a.aktif === false ? 1 : 0}">${a.aktif === false ? 'Aktifkan' : 'Nonaktifkan'}</button>
                      <button class="btn btn-kecil btn-bahaya" data-hapus-anggota="${esc(a.id)}" data-nama="${esc(a.nama)}">Hapus</button>
                    </div>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="catatan" style="margin-top:10px">
          Menautkan nama ke akun Google dilakukan lewat tab <strong>Pengguna</strong>.
          <strong>Lepas akun</strong> di sini melepas kaitan yang sudah ada (mis. salah tautkan).
          <strong>Nonaktifkan</strong> menyembunyikan nama dari daftar absen tanpa menghapus riwayatnya.
        </p>` : ''}
    </div>`;

  const isiAwal = $('#tbl-isi-awal', wadah);
  if (isiAwal) {
    isiAwal.onclick = async () => {
      isiAwal.disabled = true;
      try {
        const n = await isiAnggotaAwal();
        toast(n ? `${n} anggota ditambahkan.` : 'Data anggota sudah ada.', 'sukses');
        tabAnggota(wadah);
      } catch (err) { toast(pesanGalat(err), 'galat'); isiAwal.disabled = false; }
    };
  }

  $('#a-simpan', wadah).onclick = async () => {
    const nama = $('#a-nama', wadah).value.trim();
    if (!nama) { toast('Nama masih kosong.'); return; }
    try {
      await tambahAnggota({ nama, gender: $('#a-gender', wadah).value });
      toast(`${nama} ditambahkan.`, 'sukses');
      tabAnggota(wadah);
    } catch (err) { toast(err.message || pesanGalat(err), 'galat'); }
  };

  $$('[data-lepas]', wadah).forEach((b) => {
    b.onclick = async () => {
      if (!confirm(`Lepas akun Google dari nama ${b.dataset.nama}?`)) return;
      try {
        await lepasAnggota(b.dataset.lepas, b.dataset.uid);
        toast('Akun dilepas.');
        tabAnggota(wadah);
      } catch (err) { toast(pesanGalat(err), 'galat'); }
    };
  });

  $$('[data-aktif]', wadah).forEach((b) => {
    b.onclick = async () => {
      try {
        await ubahAnggota(b.dataset.aktif, { aktif: b.dataset.nilai === '1' });
        tabAnggota(wadah);
      } catch (err) { toast(pesanGalat(err), 'galat'); }
    };
  });

  $$('[data-hapus-anggota]', wadah).forEach((b) => {
    b.onclick = async () => {
      if (!confirm(`Hapus ${b.dataset.nama} dari daftar anggota?\n\nRiwayat kehadiran yang sudah tercatat tidak ikut terhapus.`)) return;
      try {
        await hapusAnggota(b.dataset.hapusAnggota);
        toast('Anggota dihapus.');
        tabAnggota(wadah);
      } catch (err) { toast(pesanGalat(err), 'galat'); }
    };
  });
}

/* ==========================================================================
   Tab: Pengguna — tautkan akun Google ke nama, kelola peran admin
   ========================================================================== */

async function tabPengguna(wadah) {
  const anggota = await ambilAnggota();
  let users = [];

  const lepas = pantauUsers((data) => { users = data; gambar(); });

  function gambar() {
    wadah.innerHTML = `
      <div class="kartu kartu-info">
        <p class="catatan">
          Akun yang pernah menekan <strong>Masuk dengan Google</strong> muncul di sini secara otomatis.
          Tautkan ke nama supaya bisa absen, dan jadikan admin kalau perlu memantau/mengelola.
        </p>
      </div>
      <div class="kartu">
        <div class="kartu-kepala">
          <h2>Akun Google</h2>
          <span class="lencana">${users.length} pernah login</span>
        </div>
        ${users.length ? `
          <div class="tabel-gulir">
            <table>
              <thead><tr><th>Akun</th><th>Peran</th><th>Ditautkan ke</th><th></th></tr></thead>
              <tbody>
                ${users.map((u) => baris(u)).join('')}
              </tbody>
            </table>
          </div>` : kosong('Belum ada yang login', 'Minta anggota membuka aplikasi dan menekan "Masuk dengan Google".')}
      </div>`;

    pasang();
  }

  function baris(u) {
    const bawaan = adminBawaan(u.email);
    const anggotaSaatIni = anggota.find((a) => a.id === u.anggotaId) || anggota.find((a) => a.uid === u.id);
    const opsi = anggota.filter((a) => !a.uid || a.uid === u.id);

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap:8px; min-width:180px">
            <span class="avatar" style="width:26px;height:26px;font-size:.7rem">
              ${u.foto ? `<img src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer">` : esc(inisial(u.nama || u.email))}
            </span>
            <div style="min-width:0">
              <strong>${esc(u.nama || 'Tanpa nama')}</strong>
              <br><span class="catatan" style="word-break:break-all">${esc(u.email || '')}</span>
            </div>
          </div>
        </td>
        <td>
          ${u.role === 'admin' ? '<span class="lencana lencana-oranye">Admin</span>' : '<span class="lencana">Anggota</span>'}
          ${bawaan ? '<br><span class="catatan">tetap admin (config)</span>' : ''}
        </td>
        <td>
          <select data-taut="${esc(u.id)}" data-email="${esc(u.email || '')}" data-lama="${esc(anggotaSaatIni?.id || '')}" style="min-width:150px">
            <option value="">— Tidak ditautkan —</option>
            ${opsi.map((a) => `
              <option value="${esc(a.id)}" ${anggotaSaatIni?.id === a.id ? 'selected' : ''}>
                ${esc(a.nama)}${a.aktif === false ? ' (nonaktif)' : ''}
              </option>`).join('')}
          </select>
        </td>
        <td>
          <button class="btn btn-kecil" data-peran="${esc(u.id)}" data-nilai="${u.role === 'admin' ? 'anggota' : 'admin'}"
                  ${bawaan ? 'disabled title="Admin ini terdaftar tetap di js/config.js"' : ''}>
            ${u.role === 'admin' ? 'Cabut admin' : 'Jadikan admin'}
          </button>
        </td>
      </tr>`;
  }

  function pasang() {
    $$('[data-taut]', wadah).forEach((sel) => {
      sel.onchange = async () => {
        const uid = sel.dataset.taut;
        const email = sel.dataset.email;
        const lama = sel.dataset.lama;
        const baru = sel.value;
        sel.disabled = true;
        try {
          if (lama && lama !== baru) await lepasAnggota(lama, uid);
          if (baru) await tautkanAnggota(baru, uid, email);
          toast('Tautan diperbarui.', 'sukses');
        } catch (err) {
          toast(pesanGalat(err), 'galat');
        }
        sel.disabled = false;
      };
    });

    $$('[data-peran]', wadah).forEach((b) => {
      b.onclick = async () => {
        const uid = b.dataset.peran;
        const nilai = b.dataset.nilai;
        const diriSendiri = uid === sesiPengguna.user?.uid;
        if (nilai === 'anggota' && diriSendiri
            && !confirm('Cabut peran admin dari akunmu sendiri?\n\nMenu Admin akan langsung hilang dari akun ini. Minta admin lain menjadikanmu admin lagi kalau berubah pikiran.')) {
          return;
        }
        b.disabled = true;
        try {
          await ubahPeranUser(uid, nilai);
          toast(nilai === 'admin' ? 'Sekarang admin.' : 'Peran admin dicabut.', 'sukses');
        } catch (err) {
          toast(pesanGalat(err), 'galat');
          b.disabled = false;
        }
      };
    });
  }

  return lepas;
}

/* ==========================================================================
   Tab: QR & Keamanan
   ========================================================================== */

async function tabQr(wadah) {
  const { qrToken } = await ambilPengaturan();

  wadah.innerHTML = `
    <div class="kartu">
      <div class="kartu-kepala">
        <h2>QR yang berlaku sekarang</h2>
        <a class="btn btn-kecil" href="#/qr">Buka halaman cetak</a>
      </div>
      <div style="display:flex; gap:18px; flex-wrap:wrap; align-items:flex-start">
        <div class="qr-kotak" style="flex:0 0 auto"><canvas id="qr-admin"></canvas></div>
        <div style="flex:1 1 240px; min-width:220px">
          <p class="catatan" style="margin-bottom:4px">Kode di dalam QR</p>
          <p style="font-family:var(--mono); word-break:break-all"><strong>${esc(qrToken)}</strong></p>
          <p class="catatan">Absen hanya bisa dilakukan dalam beberapa menit setelah QR ini dibaca, dan hanya oleh akun yang sudah tertaut ke sebuah nama.</p>
        </div>
      </div>
    </div>

    <div class="kartu">
      <h2>Ganti kode QR</h2>
      <p class="catatan">Pakai ini kalau QR-nya terlanjur difoto orang lain. Begitu kode diganti, <strong>semua cetakan lama langsung tidak berlaku</strong> dan poster harus dicetak ulang.</p>
      <div class="baris-form" style="margin-top:12px">
        <div class="bidang">
          <label for="q-token">Kode baru</label>
          <input type="text" id="q-token" value="${esc(qrToken)}" autocomplete="off">
        </div>
        <button class="btn" id="q-acak" type="button">Acak</button>
        <button class="btn btn-utama" id="q-simpan" type="button">Simpan kode</button>
      </div>
    </div>`;

  try {
    await gambarQr($('#qr-admin', wadah), alamatQr(qrToken), 220);
  } catch { /* tanpa internet gambar QR tidak muncul; kodenya tetap terbaca */ }

  $('#q-acak', wadah).onclick = () => {
    const acak = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map((n) => n.toString(36)).join('').slice(0, 10);
    $('#q-token', wadah).value = `jenggala-${acak}`;
  };

  $('#q-simpan', wadah).onclick = async (e) => {
    const baru = $('#q-token', wadah).value.trim();
    if (!baru) { toast('Kode tidak boleh kosong.'); return; }
    if (baru === qrToken) { toast('Kode tidak berubah.'); return; }
    if (!confirm('Ganti kode QR?\n\nSemua QR yang sudah dicetak akan berhenti berlaku dan harus dicetak ulang.')) return;
    e.target.disabled = true;
    try {
      await simpanPengaturan({ qrToken: baru });
      toast('Kode QR diganti. Cetak ulang posternya.', 'sukses');
      tabQr(wadah);
    } catch (err) { toast(pesanGalat(err), 'galat'); e.target.disabled = false; }
  };
}
