const pool = require('../config/db');

// GET /api/pendapatan?bulan=2&tahun=2026
const getPendapatan = async (req, res) => {
  try {
    const now       = new Date();
    const bulan     = parseInt(req.query.bulan)  || (now.getMonth() + 1);
    const tahun     = parseInt(req.query.tahun)  || now.getFullYear();
    const prevBulan = bulan === 1 ? 12 : bulan - 1;
    const prevTahun = bulan === 1 ? tahun - 1 : tahun;

    // 1. Total pendapatan bulan ini
    const [[totalRow]] = await pool.query(`
      SELECT COALESCE(SUM(total_bayar), 0) AS total
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND waktu_keluar IS NOT NULL
    `, [bulan, tahun]);

    // 2. Total pendapatan bulan lalu (untuk persentase)
    const [[prevRow]] = await pool.query(`
      SELECT COALESCE(SUM(total_bayar), 0) AS total
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND waktu_keluar IS NOT NULL
    `, [prevBulan, prevTahun]);

    const totalBulanIni  = Number(totalRow.total);
    const totalBulanLalu = Number(prevRow.total);
    const persentase     = totalBulanLalu > 0
      ? Number((((totalBulanIni - totalBulanLalu) / totalBulanLalu) * 100).toFixed(1))
      : 0;
    const naik = totalBulanIni >= totalBulanLalu;

    // 3. Pendapatan motor bulan ini
    const [[motorPendRow]] = await pool.query(`
      SELECT COALESCE(SUM(total_bayar), 0) AS total
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND tipe_kendaraan = 'motor'
      AND waktu_keluar IS NOT NULL
    `, [bulan, tahun]);

    // 4. Pendapatan mobil bulan ini
    const [[mobilPendRow]] = await pool.query(`
      SELECT COALESCE(SUM(total_bayar), 0) AS total
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND tipe_kendaraan = 'mobil'
      AND waktu_keluar IS NOT NULL
    `, [bulan, tahun]);

    // 5. Total kendaraan motor & mobil bulan ini
    const [[motorCountRow]] = await pool.query(`
      SELECT COUNT(*) AS total FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND tipe_kendaraan = 'motor'
    `, [bulan, tahun]);

    const [[mobilCountRow]] = await pool.query(`
      SELECT COUNT(*) AS total FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND tipe_kendaraan = 'mobil'
    `, [bulan, tahun]);

    // 6. Line chart: pendapatan per hari
    const [lineChart] = await pool.query(`
      SELECT
        DAY(tanggal) AS hari,
        COALESCE(SUM(total_bayar), 0) AS pendapatan
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND waktu_keluar IS NOT NULL
      GROUP BY DAY(tanggal)
      ORDER BY hari
    `, [bulan, tahun]);

    // 7. Bar chart: kendaraan per hari (motor + mobil)
    const [barChart] = await pool.query(`
      SELECT
        DAY(tanggal) AS hari,
        SUM(CASE WHEN tipe_kendaraan = 'motor' THEN 1 ELSE 0 END) AS motor,
        SUM(CASE WHEN tipe_kendaraan = 'mobil' THEN 1 ELSE 0 END) AS mobil
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      GROUP BY DAY(tanggal)
      ORDER BY hari
    `, [bulan, tahun]);

    // 8. Data ekspor: semua transaksi bulan ini
    const [eksporData] = await pool.query(`
      SELECT
        t.id,
        t.plat_nomor,
        t.tipe_kendaraan,
        t.nama,
        t.area,
        t.waktu_masuk,
        t.waktu_keluar,
        t.durasi,
        t.total_bayar,
        t.tanggal,
        u.fullname AS petugas
      FROM tb_transaksi t
      LEFT JOIN tb_user u ON t.id_user = u.id
      WHERE MONTH(t.tanggal) = ? AND YEAR(t.tanggal) = ?
      ORDER BY t.waktu_masuk DESC
    `, [bulan, tahun]);

    return res.json({
      success: true,
      bulan,
      tahun,
      data: {
        ringkasan: {
          total_pendapatan: totalBulanIni,
          pendapatan_lalu:  totalBulanLalu,
          persentase,
          naik,
          pendapatan_motor: Number(motorPendRow.total),
          pendapatan_mobil: Number(mobilPendRow.total),
        },
        kendaraan: {
          motor: Number(motorCountRow.total),
          mobil: Number(mobilCountRow.total),
        },
        lineChart,
        barChart,
        eksporData,
      }
    });

  } catch (err) {
    console.error('Pendapatan error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getPendapatan };