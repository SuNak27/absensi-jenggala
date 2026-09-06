/* Kerangka aplikasi: router hash, navigasi, dan kartu akun. */

import { firebaseSiap, APP_NAMA } from './config.js';
import { mulaiFirebase, sesiPengguna, saatBerubah, masukGoogle, pesanGalat } from './fb.js';
import { $, esc, inisial, toast, memuat } from './util.js';

const RUTE = {
  '': () => import('./views/beranda.js'),
  'absen': () => import('./views/gerbang.js'),
  'scan': () => import('./views/pindai.js'),
  'rekap': () => import('./views/rekap.js'),
  'admin': () => import('./views/admin.js'),
  'qr': () => import('./views/poster.js'),
  'profil': () => import('./views/profil.js'),
};

const konten = $('#konten');
let bersihkan = null;
let rutePernahDirender = false;

/* ---------- pembacaan hash ---------- */

function bacaHash() {
  const mentah = location.hash.replace(/^#\/?/, '');
  const [jalur, tanya] = mentah.split('?');
  return {
    jalur: (jalur || '').replace(/\/+$/, ''),
    params: new URLSearchParams(tanya || ''),
  };
}

export function pergiKe(jalur, ganti = false) {
  const target = `#/${jalur}`;
  if (location.hash === target) { render(); return; }
  if (ganti) location.replace(target); else location.hash = target;
}

/* ---------- navigasi ---------- */

function gambarNav() {
  const { jalur } = bacaHash();
  const item = [
    { id: '', label: 'Beranda' },
    { id: 'rekap', label: 'Rekap' },
  ];
  if (sesiPengguna.admin) {
    item.push({ id: 'admin', label: 'Admin' });
    item.push({ id: 'qr', label: 'QR Cetak' });
  }
  $('#nav-slot').innerHTML = item.map((m) => {
    const aktif = m.id === jalur || (m.id === '' && jalur === 'absen');
    return `<a href="#/${m.id}"${aktif ? ' aria-current="page"' : ''}>${esc(m.label)}</a>`;
  }).join('');
}

function gambarAkun() {
  const slot = $('#akun-slot');
  if (!firebaseSiap) { slot.innerHTML = ''; return; }

  if (!sesiPengguna.masuk) {
    slot.innerHTML = '<button class="btn btn-kecil" id="tbl-masuk">Masuk dengan Google</button>';
    $('#tbl-masuk').onclick = async (e) => {
      e.target.disabled = true;
      try { await masukGoogle(); } catch (err) { toast(pesanGalat(err), 'galat'); }
      e.target.disabled = false;
    };
    return;
  }

  const p = sesiPengguna.profil || {};
  const nama = sesiPengguna.anggota?.nama || p.nama || sesiPengguna.user.email;
  const foto = p.foto || sesiPengguna.user.photoURL;
  slot.innerHTML = `
    <a class="akun-chip" href="#/profil" title="Buka profil">
      ${foto
        ? `<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer" width="28" height="28">`
        : `<span class="akun-avatar">${esc(inisial(nama))}</span>`}
      <span>${esc(nama)}</span>
    </a>`;
}

/* ---------- render ---------- */

async function render() {
  const { jalur, params } = bacaHash();
  const modul = RUTE[jalur];

  if (bersihkan) { try { bersihkan(); } catch { /* abaikan */ } bersihkan = null; }

  if (!modul) {
    konten.innerHTML = `
      <div class="kartu">
        <h1>Halaman tidak ditemukan</h1>
        <p class="catatan">Alamat <code>${esc(location.hash)}</code> tidak dikenali.</p>
        <p><a class="btn" href="#/">Kembali ke beranda</a></p>
      </div>`;
    gambarNav();
    return;
  }

  // Halaman poster QR tetap bisa dibuka walau Firebase belum diatur.
  if (!firebaseSiap && jalur !== 'qr') {
    konten.innerHTML = tampilanSetup();
    gambarNav();
    return;
  }

  konten.innerHTML = memuat();
  gambarNav();

  try {
    const m = await modul();
    if (bacaHash().jalur !== jalur) return; // pengguna sudah pindah halaman
    bersihkan = (await m.render(konten, params)) || null;
  } catch (e) {
    console.error(e);
    konten.innerHTML = `
      <div class="kartu">
        <h1>Gagal membuka halaman</h1>
        <p class="pesan pesan-merah">${esc(pesanGalat(e))}</p>
        <p class="btn-baris">
          <button class="btn" onclick="location.reload()">Muat ulang</button>
          <a class="btn" href="#/">Ke beranda</a>
        </p>
      </div>`;
  }

  if (rutePernahDirender) konten.focus({ preventScroll: true });
  rutePernahDirender = true;
  if (jalur) window.scrollTo({ top: 0 });
}

function tampilanSetup() {
  return `
    <div class="judul-hal">
      <h1>${esc(APP_NAMA)} belum terhubung</h1>
      <p>Tinggal satu langkah: tempel konfigurasi Firebase.</p>
    </div>
    <div class="kartu">
      <h2>Yang perlu dilakukan</h2>
      <ol>
        <li>Buat project di <a href="https://console.firebase.google.com" target="_blank" rel="noopener">Firebase Console</a>.</li>
        <li>Aktifkan <strong>Authentication → Sign-in method → Google</strong>.</li>
        <li>Buat <strong>Firestore Database</strong> (mode production).</li>
        <li>Tambahkan <strong>Web app</strong>, salin objek <code>firebaseConfig</code>.</li>
        <li>Tempel ke <code>js/config.js</code> pada <code>FIREBASE_CONFIG</code>, lalu isi <code>ADMIN_EMAILS</code> dengan email Google-mu.</li>
        <li>Salin isi <code>firestore.rules</code> ke tab <strong>Rules</strong> Firestore, ganti email admin di dalamnya, lalu Publish.</li>
      </ol>
      <p class="catatan">Panduan lengkap dengan tangkapan langkahnya ada di berkas <code>PANDUAN-FIREBASE.md</code>.</p>
    </div>
    <div class="kartu kartu-info">
      <h3>Sementara itu</h3>
      <p class="catatan">Halaman <a href="#/qr">QR Cetak</a> sudah bisa dibuka sekarang untuk melihat dan mencetak posternya.</p>
    </div>`;
}

/* ---------- mulai ---------- */

async function mulai() {
  window.addEventListener('hashchange', render);
  gambarAkun();

  try {
    await mulaiFirebase();
  } catch (e) {
    console.error(e);
    toast(pesanGalat(e), 'galat');
  }

  saatBerubah(() => { gambarAkun(); gambarNav(); });

  // Render ulang halaman aktif kalau login, tautan nama, atau peran berubah —
  // termasuk saat admin menautkan/menaikkan peran akun ini dari perangkat lain
  // sementara halaman ini sedang terbuka (fb.js memantaunya secara langsung).
  const sidikSesi = (s) => `${s.user?.uid || ''}|${s.profil?.anggotaId || ''}|${s.profil?.role || ''}`;
  let sidikTerakhir = sidikSesi(sesiPengguna);
  saatBerubah((s) => {
    const sidikBaru = sidikSesi(s);
    if (sidikBaru === sidikTerakhir) return;
    sidikTerakhir = sidikBaru;
    render();
  });

  render();
}

mulai();
