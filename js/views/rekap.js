/* Rekap kehadiran: ringkasan angka, batang per anggota, matriks tanggal, ekspor. */

import { SESI, sesiById } from '../config.js';
import { ambilAnggota, ambilAbsensiRentang } from '../store.js';
import {
  $, $$, esc, kunciTanggal, tanggalPanjang, tanggalPendek,
  rentangBulan, kunciBulanIni, unduhCsv, kosong, memuat, toast,
} from '../util.js';

/** Huruf singkat untuk kolom matriks: siang -> S, malam -> M. */
const hurufSesi = (id) => String(id).charAt(0).toUpperCase();

export async function render(kontainer) {
  const bulanIni = rentangBulan(kunciBulanIni());
  const saring = {
    dari: bulanIni.dari,
    sampai: kunciTanggal(),
    sesi: 'semua',
    gender: 'semua',
  };

  kontainer.innerHTML = `
    <div class="judul-hal">
      <h1>Rekap Kehadiran</h1>
      <p>Ringkasan absensi kegiatan Jenggala.</p>
    </div>
    <div class="kartu kartu-rapat cetak-sembunyi">
      <div class="baris-form">
        <div class="bidang">
          <label for="f-dari">Dari tanggal</label>
          <input type="date" id="f-dari" value="${saring.dari}" max="${kunciTanggal()}">
        </div>
        <div class="bidang">
          <label for="f-sampai">Sampai tanggal</label>
          <input type="date" id="f-sampai" value="${saring.sampai}" max="${kunciTanggal()}">
        </div>
        <div class="bidang">
          <label for="f-sesi">Sesi</label>
          <select id="f-sesi">
            <option value="semua">Semua sesi</option>
            ${SESI.map((s) => `<option value="${esc(s.id)}">${esc(s.nama)}</option>`).join('')}
          </select>
        </div>
        <div class="bidang">
          <label for="f-gender">Kelompok</label>
          <select id="f-gender">
            <option value="semua">Semua</option>
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </div>
      </div>
      <div class="btn-baris" style="margin-top:10px">
        <button class="btn btn-kecil" data-cepat="bulan-ini" type="button">Bulan ini</button>
        <button class="btn btn-kecil" data-cepat="bulan-lalu" type="button">Bulan lalu</button>
        <button class="btn btn-kecil" data-cepat="30-hari" type="button">30 hari terakhir</button>
      </div>
    </div>
    <div id="hasil">${memuat()}</div>`;

  const hasil = $('#hasil', kontainer);

  $$('#f-dari, #f-sampai, #f-sesi, #f-gender', kontainer).forEach((el) => {
    el.onchange = () => {
      saring.dari = $('#f-dari').value;
      saring.sampai = $('#f-sampai').value;
      saring.sesi = $('#f-sesi').value;
      saring.gender = $('#f-gender').value;
      muat();
    };
  });

  $$('[data-cepat]', kontainer).forEach((b) => {
    b.onclick = () => {
      const kini = new Date();
      if (b.dataset.cepat === 'bulan-ini') {
        const r = rentangBulan(kunciBulanIni());
        saring.dari = r.dari; saring.sampai = kunciTanggal();
      } else if (b.dataset.cepat === 'bulan-lalu') {
        const l = new Date(kini.getFullYear(), kini.getMonth() - 1, 1);
        const r = rentangBulan(`${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, '0')}`);
        saring.dari = r.dari; saring.sampai = r.sampai;
      } else {
        const l = new Date(kini); l.setDate(l.getDate() - 29);
        saring.dari = kunciTanggal(l); saring.sampai = kunciTanggal();
      }
      $('#f-dari').value = saring.dari;
      $('#f-sampai').value = saring.sampai;
      muat();
    };
  });

  await muat();

  async function muat() {
    if (saring.dari > saring.sampai) {
      hasil.innerHTML = '<p class="pesan pesan-oranye">Tanggal “dari” melewati tanggal “sampai”.</p>';
      return;
    }
    hasil.innerHTML = memuat('Mengambil data…');
    const [anggota, absensi] = await Promise.all([
      ambilAnggota(),
      ambilAbsensiRentang(saring.dari, saring.sampai),
    ]);
    gambar(hasil, anggota, absensi, saring);
  }
}

/* ==========================================================================
   Hitung + gambar
   ========================================================================== */

function gambar(wadah, semuaAnggota, semuaAbsensi, saring) {
  const anggota = semuaAnggota.filter(
    (a) => a.aktif !== false && (saring.gender === 'semua' || a.gender === saring.gender),
  );
  const idAnggota = new Set(anggota.map((a) => a.id));
  const absensi = semuaAbsensi.filter(
    (r) => (saring.sesi === 'semua' || r.sesi === saring.sesi) && idAnggota.has(r.anggotaId),
  );

  if (!anggota.length) {
    wadah.innerHTML = kosong('Tidak ada anggota pada filter ini');
    return;
  }

  const tanggal = [...new Set(absensi.map((r) => r.tanggal))].sort();
  const sesiBerjalan = new Set(absensi.map((r) => `${r.tanggal}_${r.sesi}`)).size;
  const terlambat = absensi.filter((r) => r.ketepatan === 'terlambat').length;

  const perAnggota = anggota.map((a) => {
    const milik = absensi.filter((r) => r.anggotaId === a.id);
    return {
      ...a,
      total: milik.length,
      siang: milik.filter((r) => r.sesi === 'siang').length,
      malam: milik.filter((r) => r.sesi === 'malam').length,
      terlambat: milik.filter((r) => r.ketepatan === 'terlambat').length,
      perTanggal: milik.reduce((akum, r) => {
        (akum[r.tanggal] ||= []).push(r.sesi);
        return akum;
      }, {}),
    };
  });

  const urutBatang = [...perAnggota].sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama));
  const maks = Math.max(1, ...perAnggota.map((p) => p.total));
  const rata = perAnggota.length
    ? (absensi.length / perAnggota.length).toFixed(1).replace('.', ',')
    : '0';
  const juara = urutBatang[0];

  wadah.innerHTML = `
    <p class="catatan cetak-sembunyi" style="margin-bottom:12px">
      ${esc(tanggalPanjang(saring.dari))} &ndash; ${esc(tanggalPanjang(saring.sampai))}
      ${saring.sesi !== 'semua' ? `&middot; ${esc(sesiById(saring.sesi)?.nama || saring.sesi)}` : ''}
    </p>

    <dl class="statistik">
      <div class="stat">
        <dt>Total kehadiran</dt>
        <dd>${absensi.length}</dd>
        <div class="stat-sub">${terlambat} tercatat terlambat</div>
      </div>
      <div class="stat">
        <dt>Sesi berjalan</dt>
        <dd>${sesiBerjalan}</dd>
        <div class="stat-sub">${tanggal.length} hari ada kegiatan</div>
      </div>
      <div class="stat">
        <dt>Rata-rata per orang</dt>
        <dd>${esc(rata)}</dd>
        <div class="stat-sub">dari ${perAnggota.length} anggota</div>
      </div>
      <div class="stat">
        <dt>Paling rajin</dt>
        <dd class="stat-nama">${esc(juara && juara.total ? juara.nama : '—')}</dd>
        <div class="stat-sub">${juara && juara.total ? `${juara.total} kehadiran` : 'belum ada data'}</div>
      </div>
    </dl>

    ${absensi.length ? `
      <div class="kartu">
        <div class="kartu-kepala">
          <h2>Kehadiran per anggota</h2>
          <span class="catatan">jumlah sesi dihadiri</span>
        </div>
        <ul class="batang-daftar">
          ${urutBatang.map((p) => `
            <li class="batang-baris" title="${esc(p.nama)} — siang ${p.siang}, malam ${p.malam}${p.terlambat ? `, terlambat ${p.terlambat}` : ''}">
              <span class="batang-nama">${esc(p.nama)}</span>
              <span class="batang-jalur">
                <span class="batang-isi" style="width:${Math.round((p.total / maks) * 100)}%"></span>
              </span>
              <span class="batang-nilai">${p.total}</span>
            </li>`).join('')}
        </ul>
      </div>

      <div class="kartu">
        <div class="kartu-kepala">
          <h2>Matriks kehadiran</h2>
          <span class="catatan">S = sesi siang &middot; M = sesi malam</span>
        </div>
        <div class="tabel-gulir">
          <table>
            <thead>
              <tr>
                <th class="kolom-nama">Nama</th>
                ${tanggal.map((t) => `<th class="angka" title="${esc(tanggalPanjang(t))}">${esc(tanggalPendek(t))}</th>`).join('')}
                <th class="angka">Total</th>
              </tr>
            </thead>
            <tbody>
              ${perAnggota.map((p) => `
                <tr>
                  <td class="kolom-nama">${esc(p.nama)}</td>
                  ${tanggal.map((t) => {
                    const s = p.perTanggal[t];
                    if (!s) return '<td class="sel-kosong">·</td>';
                    const label = SESI.filter((x) => s.includes(x.id)).map((x) => hurufSesi(x.id)).join('');
                    return `<td class="sel-hadir">${esc(label)}</td>`;
                  }).join('')}
                  <td class="angka"><strong>${p.total}</strong></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="btn-baris cetak-sembunyi">
        <button class="btn" id="tbl-csv-rekap" type="button">Unduh rekap (CSV)</button>
        <button class="btn" id="tbl-csv-rinci" type="button">Unduh rincian (CSV)</button>
        <button class="btn" id="tbl-cetak-rekap" type="button">Cetak</button>
      </div>
    ` : kosong('Belum ada kehadiran pada rentang ini', 'Coba ubah tanggal atau filter di atas.')}`;

  if (!absensi.length) return;

  $('#tbl-cetak-rekap', wadah).onclick = () => window.print();

  $('#tbl-csv-rekap', wadah).onclick = () => {
    const baris = [
      ['Rekap Kehadiran Jenggala'],
      ['Rentang', `${saring.dari} s/d ${saring.sampai}`],
      ['Sesi', saring.sesi === 'semua' ? 'Semua' : sesiById(saring.sesi)?.nama || saring.sesi],
      [],
      ['Nama', 'Kelompok', ...tanggal, 'Siang', 'Malam', 'Terlambat', 'Total'],
      ...perAnggota.map((p) => [
        p.nama,
        p.gender === 'P' ? 'Perempuan' : 'Laki-laki',
        ...tanggal.map((t) => {
          const s = p.perTanggal[t];
          return s ? SESI.filter((x) => s.includes(x.id)).map((x) => hurufSesi(x.id)).join('') : '';
        }),
        p.siang, p.malam, p.terlambat, p.total,
      ]),
    ];
    unduhCsv(`rekap-jenggala-${saring.dari}_${saring.sampai}.csv`, baris);
    toast('Berkas rekap diunduh.', 'sukses');
  };

  $('#tbl-csv-rinci', wadah).onclick = () => {
    const urut = [...absensi].sort(
      (a, b) => a.tanggal.localeCompare(b.tanggal) || (a.jamLokal || '').localeCompare(b.jamLokal || ''),
    );
    const baris = [
      ['Tanggal', 'Sesi', 'Nama', 'Kelompok', 'Jam', 'Ketepatan', 'Cara', 'Jumlah kegiatan', 'Kegiatan', 'Catatan'],
      ...urut.map((r) => {
        const daftar = sesiById(r.sesi)?.kegiatan || [];
        const nama = (r.kegiatan || []).map((id) => daftar.find((k) => k.id === id)?.nama || id);
        return [
          r.tanggal,
          sesiById(r.sesi)?.nama || r.sesi,
          r.nama,
          r.gender === 'P' ? 'Perempuan' : 'Laki-laki',
          (r.jamLokal || '').replace(':', '.'),
          r.ketepatan === 'terlambat' ? 'Terlambat' : 'Tepat waktu',
          r.metode === 'manual' ? 'Manual admin' : 'Scan QR',
          nama.length,
          nama.join(' | '),
          r.catatan || '',
        ];
      }),
    ];
    unduhCsv(`rincian-jenggala-${saring.dari}_${saring.sampai}.csv`, baris);
    toast('Berkas rincian diunduh.', 'sukses');
  };
}
