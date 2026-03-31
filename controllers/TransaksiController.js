// const pool = require('../config/db');

// // GET /api/transaksi
// const getAllTransaksi = async (req, res) => {
//   try {
//     const { tanggal, area, page = 1, limit = 20 } = req.query;
//     const offset = (page - 1) * limit;

//     let where = 'WHERE 1=1';
//     const params = [];
//     if (tanggal) { where += ' AND t.tanggal = ?'; params.push(tanggal); }
//     if (area)    { where += ' AND t.area = ?';    params.push(area); }

//     const [rows] = await pool.query(
//       `SELECT t.*, u.fullname AS petugas_nama
//        FROM tb_transaksi t
//        LEFT JOIN tb_user u ON t.id_user = u.id
//        ${where}
//        ORDER BY t.waktu_masuk DESC
//        LIMIT ? OFFSET ?`,
//       [...params, parseInt(limit), parseInt(offset)]
//     );

//     const [[{ total }]] = await pool.query(
//       `SELECT COUNT(*) AS total FROM tb_transaksi t ${where}`, params
//     );

//     res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // GET /api/transaksi/:id
// const getTransaksiById = async (req, res) => {
//   try {
//     const [rows] = await pool.query(
//       `SELECT t.*, u.fullname AS petugas_nama
//        FROM tb_transaksi t
//        LEFT JOIN tb_user u ON t.id_user = u.id
//        WHERE t.id = ?`,
//       [req.params.id]
//     );
//     if (rows.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
//     res.json({ success: true, data: rows[0] });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // GET /api/transaksi/aktif/terbaru
// // Hanya ambil transaksi yang belum keluar (waktu_keluar IS NULL)
// const getTransaksiAktif = async (req, res) => {
//   try {
//     const [rows] = await pool.query(
//       `SELECT * FROM tb_transaksi
//        WHERE waktu_keluar IS NULL
//        ORDER BY waktu_masuk DESC
//        LIMIT 1`
//     );

//     if (rows.length === 0) {
//       return res.json({ success: true, data: null });
//     }

//     res.json({ success: true, data: rows[0] });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // POST /api/transaksi/masuk
// const kendaraanMasuk = async (req, res) => {
//   const { id_card, nama, id_kendaraan, plat_nomor, area } = req.body;
//   if (!plat_nomor || !area) {
//     return res.status(400).json({ success: false, message: 'plat_nomor dan area wajib diisi' });
//   }
//   try {
//     const [result] = await pool.query(
//       `INSERT INTO tb_transaksi (id_card, nama, id_kendaraan, plat_nomor, waktu_masuk, area, id_user, tanggal)
//        VALUES (?, ?, ?, ?, NOW(), ?, ?, CURDATE())`,
//       [id_card || null, nama || null, id_kendaraan || null, plat_nomor, area, req.user.id]
//     );
//     res.status(201).json({ success: true, message: 'Kendaraan berhasil masuk', id: result.insertId });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // PUT /api/transaksi/keluar/:id
// const kendaraanKeluar = async (req, res) => {
//   try {
//     const [rows] = await pool.query('SELECT * FROM tb_transaksi WHERE id = ?', [req.params.id]);
//     if (rows.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

//     const transaksi = rows[0];
//     if (transaksi.waktu_keluar) {
//       return res.status(400).json({ success: false, message: 'Kendaraan sudah keluar sebelumnya' });
//     }

//     const waktuMasuk  = new Date(transaksi.waktu_masuk);
//     const waktuKeluar = new Date();
//     const durasiJam   = Math.ceil((waktuKeluar - waktuMasuk) / (1000 * 60 * 60));
//     const durasi      = durasiJam < 1 ? 1 : durasiJam;

//     const tipeKendaraan = (transaksi.tipe_kendaraan || 'mobil').toLowerCase();
//     const [tarifRows] = await pool.query(
//       'SELECT tarif_per_jam FROM tb_tarif WHERE tipe_kendaraan = ? LIMIT 1',
//       [tipeKendaraan]
//     );
//     const tarifPerJam = tarifRows.length > 0 ? tarifRows[0].tarif_per_jam : 2000;
//     const totalBayar  = durasi * tarifPerJam;

//     await pool.query(
//       `UPDATE tb_transaksi SET waktu_keluar = NOW(), durasi = ?, total_bayar = ? WHERE id = ?`,
//       [durasi, totalBayar, req.params.id]
//     );

//     res.json({ success: true, message: 'Kendaraan berhasil keluar', data: { durasi, tarif_per_jam: tarifPerJam, total_bayar: totalBayar } });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // GET /api/transaksi/rekap/harian
// const rekapHarian = async (req, res) => {
//   try {
//     const tgl = req.query.tanggal || new Date().toISOString().split('T')[0];
//     const [rows] = await pool.query(
//       `SELECT area, COUNT(*) AS total_kendaraan, SUM(total_bayar) AS total_pendapatan
//        FROM tb_transaksi WHERE tanggal = ? GROUP BY area`,
//       [tgl]
//     );
//     res.json({ success: true, tanggal: tgl, data: rows });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // GET /api/transaksi/pending-keluar
// const getPendingKeluarAPI = (req, res) => {
//   const { getPendingKeluar } = require('../services/mqttService');
//   const pending = getPendingKeluar();
//   const list    = Object.values(pending);

//   if (list.length === 0) {
//     return res.json({ success: true, data: null });
//   }

//   list.sort((a, b) => new Date(b.waktu_keluar) - new Date(a.waktu_keluar));
//   res.json({ success: true, data: list[0] });
// };

// // PUT /api/transaksi/konfirmasi/:id_card
// const konfirmasiBayar = async (req, res) => {
//   const { getPendingKeluar, clearPendingKeluar } = require('../services/mqttService');
//   const pending = getPendingKeluar();
//   const data    = pending[req.params.id_card];

//   if (!data) {
//     return res.status(404).json({
//       success: false,
//       message: 'Tidak ada data keluar pending untuk id_card ini. Pastikan kendaraan sudah tap RFID keluar.',
//     });
//   }

//   try {
//     const id_user = req.body?.id_user ?? null;

//     await pool.query(
//       `UPDATE tb_transaksi
//        SET waktu_keluar = ?, durasi = ?, total_bayar = ?, id_user = ?
//        WHERE id = ?`,
//       [
//         new Date(data.waktu_keluar).toISOString().slice(0, 19).replace('T', ' '),
//         data.durasi,
//         data.total_bayar,
//         id_user,
//         data.id_transaksi,
//       ]
//     );

//     clearPendingKeluar(req.params.id_card);

//     res.json({
//       success: true,
//       message: 'Pembayaran berhasil dikonfirmasi',
//       data: {
//         id:          data.id_transaksi,
//         durasi:      data.durasi,
//         total_bayar: data.total_bayar,
//       },
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// module.exports = {
//   getAllTransaksi, getTransaksiById, getTransaksiAktif,
//   kendaraanMasuk, kendaraanKeluar,
//   getPendingKeluarAPI, konfirmasiBayar,
//   rekapHarian,
// };

const pool = require('../config/db');

// GET /api/transaksi
const getAllTransaksi = async (req, res) => {
  try {
    const { tanggal, area, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (tanggal) { where += ' AND t.tanggal = ?'; params.push(tanggal); }
    if (area)    { where += ' AND t.area = ?';    params.push(area); }

    const [rows] = await pool.query(
      `SELECT t.*, u.fullname AS petugas_nama
       FROM tb_transaksi t
       LEFT JOIN tb_user u ON t.id_user = u.id
       ${where}
       ORDER BY t.waktu_masuk DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tb_transaksi t ${where}`, params
    );

    res.json({ success: true, data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/transaksi/:id
const getTransaksiById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, u.fullname AS petugas_nama
       FROM tb_transaksi t
       LEFT JOIN tb_user u ON t.id_user = u.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/transaksi/aktif/terbaru
// Hanya ambil transaksi yang belum keluar (waktu_keluar IS NULL)
const getTransaksiAktif = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM tb_transaksi
       WHERE waktu_keluar IS NULL
       ORDER BY waktu_masuk DESC
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/transaksi/masuk
const kendaraanMasuk = async (req, res) => {
  const { id_card, nama, id_kendaraan, plat_nomor, area } = req.body;
  if (!plat_nomor || !area) {
    return res.status(400).json({ success: false, message: 'plat_nomor dan area wajib diisi' });
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO tb_transaksi (id_card, nama, id_kendaraan, plat_nomor, waktu_masuk, area, id_user, tanggal)
       VALUES (?, ?, ?, ?, NOW(), ?, ?, CURDATE())`,
      [id_card || null, nama || null, id_kendaraan || null, plat_nomor, area, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Kendaraan berhasil masuk', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/transaksi/keluar/:id
const kendaraanKeluar = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tb_transaksi WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });

    const transaksi = rows[0];
    if (transaksi.waktu_keluar) {
      return res.status(400).json({ success: false, message: 'Kendaraan sudah keluar sebelumnya' });
    }

    const waktuMasuk  = new Date(transaksi.waktu_masuk);
    const waktuKeluar = new Date();
    const durasiJam   = Math.ceil((waktuKeluar - waktuMasuk) / (1000 * 60 * 60));
    const durasi      = durasiJam < 1 ? 1 : durasiJam;

    const tipeKendaraan = (transaksi.tipe_kendaraan || 'mobil').toLowerCase();
    const [tarifRows] = await pool.query(
      'SELECT tarif_per_jam FROM tb_tarif WHERE tipe_kendaraan = ? LIMIT 1',
      [tipeKendaraan]
    );
    const tarifPerJam = tarifRows.length > 0 ? tarifRows[0].tarif_per_jam : 2000;
    const totalBayar  = durasi * tarifPerJam;

    await pool.query(
      `UPDATE tb_transaksi SET waktu_keluar = NOW(), durasi = ?, total_bayar = ? WHERE id = ?`,
      [durasi, totalBayar, req.params.id]
    );

    res.json({ success: true, message: 'Kendaraan berhasil keluar', data: { durasi, tarif_per_jam: tarifPerJam, total_bayar: totalBayar } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/transaksi/rekap/harian
const rekapHarian = async (req, res) => {
  try {
    const tgl = req.query.tanggal || new Date().toISOString().split('T')[0];
    const [rows] = await pool.query(
      `SELECT area, COUNT(*) AS total_kendaraan, SUM(total_bayar) AS total_pendapatan
       FROM tb_transaksi WHERE tanggal = ? GROUP BY area`,
      [tgl]
    );
    res.json({ success: true, tanggal: tgl, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/transaksi/pending-keluar
const getPendingKeluarAPI = (req, res) => {
  const { getPendingKeluar } = require('../services/mqttService');
  const pending = getPendingKeluar();
  const list    = Object.values(pending);

  if (list.length === 0) {
    return res.json({ success: true, data: null });
  }

  list.sort((a, b) => new Date(b.waktu_keluar) - new Date(a.waktu_keluar));
  res.json({ success: true, data: list[0] });
};

// PUT /api/transaksi/konfirmasi/:id_card
const konfirmasiBayar = async (req, res) => {
  const {
    getPendingKeluar,
    clearPendingKeluar,
    publishPalangKeluarBuka,
    publishPalangKeluarTutup,
  } = require('../services/mqttService');

  const pending = getPendingKeluar();
  const data    = pending[req.params.id_card];

  if (!data) {
    return res.status(404).json({
      success: false,
      message: 'Tidak ada data keluar pending untuk id_card ini. Pastikan kendaraan sudah tap RFID keluar.',
    });
  }

  try {
    const id_user = req.body?.id_user ?? null;

    await pool.query(
      `UPDATE tb_transaksi
       SET waktu_keluar = ?, durasi = ?, total_bayar = ?, id_user = ?
       WHERE id = ?`,
      [
        new Date(data.waktu_keluar).toISOString().slice(0, 19).replace('T', ' '),
        data.durasi,
        data.total_bayar,
        id_user,
        data.id_transaksi,
      ]
    );

    clearPendingKeluar(req.params.id_card);

    // Publish buka palang keluar setelah konfirmasi bayar
    publishPalangKeluarBuka();
    console.log('[Konfirmasi] Palang keluar dibuka');

    // Auto tutup palang keluar setelah 5 detik
    setTimeout(() => {
      publishPalangKeluarTutup();
      console.log('[Konfirmasi] Palang keluar ditutup otomatis (5 detik)');
    }, 5000);

    res.json({
      success: true,
      message: 'Pembayaran berhasil dikonfirmasi',
      data: {
        id:          data.id_transaksi,
        durasi:      data.durasi,
        total_bayar: data.total_bayar,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllTransaksi, getTransaksiById, getTransaksiAktif,
  kendaraanMasuk, kendaraanKeluar,
  getPendingKeluarAPI, konfirmasiBayar,
  rekapHarian,
};