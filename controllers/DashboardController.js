const pool = require('../config/db');

// GET /api/dashboard
const getDashboard = async (req, res) => {
  try {
    const now          = new Date();
    const year         = now.getFullYear();
    const month        = now.getMonth() + 1;
    const prevMonth    = month === 1 ? 12 : month - 1;
    const prevYear     = month === 1 ? year - 1 : year;

    // 1. Total motor & mobil bulan ini — pakai tipe_kendaraan dari tb_transaksi langsung
    const [[motorRow]] = await pool.query(`
      SELECT COUNT(*) AS total FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND tipe_kendaraan = 'motor'
    `, [month, year]);

    const [[mobilRow]] = await pool.query(`
      SELECT COUNT(*) AS total FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND tipe_kendaraan = 'mobil'
    `, [month, year]);

    // 2. Total slot parkir dari tb_area_parkir
    const [[slotRow]] = await pool.query(`
      SELECT 
        COALESCE(SUM(terisi), 0)              AS terisi,
        COALESCE(SUM(kapasitas - terisi), 0)  AS tersedia,
        COALESCE(SUM(kapasitas), 0)           AS total
      FROM tb_area_parkir
    `);

    // 3. Bar chart: kendaraan per hari bulan ini — pakai tipe_kendaraan dari tb_transaksi
    const [barChart] = await pool.query(`
      SELECT 
        DAY(tanggal) AS hari,
        SUM(CASE WHEN tipe_kendaraan = 'motor' THEN 1 ELSE 0 END) AS motor,
        SUM(CASE WHEN tipe_kendaraan = 'mobil' THEN 1 ELSE 0 END) AS mobil
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      GROUP BY DAY(tanggal)
      ORDER BY hari
    `, [month, year]);

    // 4. Donut chart: user aktif per role
    const [userChart] = await pool.query(`
      SELECT role, COUNT(*) AS total
      FROM tb_user
      WHERE status = 'aktif'
      GROUP BY role
    `);

    // 5. Line chart: pendapatan per hari bulan ini
    const [lineChart] = await pool.query(`
      SELECT 
        DAY(tanggal) AS hari,
        COALESCE(SUM(total_bayar), 0) AS pendapatan
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND waktu_keluar IS NOT NULL
      GROUP BY DAY(tanggal)
      ORDER BY hari
    `, [month, year]);

    // 6. Saldo bulan ini & bulan lalu
    const [[saldoIniRow]] = await pool.query(`
      SELECT COALESCE(SUM(total_bayar), 0) AS total
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND waktu_keluar IS NOT NULL
    `, [month, year]);

    const [[saldoLaluRow]] = await pool.query(`
      SELECT COALESCE(SUM(total_bayar), 0) AS total
      FROM tb_transaksi
      WHERE MONTH(tanggal) = ? AND YEAR(tanggal) = ?
      AND waktu_keluar IS NOT NULL
    `, [prevMonth, prevYear]);

    const saldoIni  = Number(saldoIniRow.total);
    const saldoLalu = Number(saldoLaluRow.total);
    const persentase = saldoLalu > 0
      ? Number((((saldoIni - saldoLalu) / saldoLalu) * 100).toFixed(1))
      : 0;

    // 7. Tarif
    const [tarif] = await pool.query('SELECT * FROM tb_tarif ORDER BY id');

    return res.json({
      success: true,
      data: {
        kendaraan: {
          motor: Number(motorRow.total),
          mobil: Number(mobilRow.total),
        },
        slot: {
          terisi:   Number(slotRow.terisi),
          tersedia: Number(slotRow.tersedia),
          total:    Number(slotRow.total),
        },
        barChart,
        userChart,
        lineChart,
        saldo: {
          bulan_ini:  saldoIni,
          bulan_lalu: saldoLalu,
          persentase,
          naik: saldoIni >= saldoLalu,
        },
        tarif,
      }
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/dashboard/tarif/:id
const updateTarifDashboard = async (req, res) => {
  const { tarif_per_jam } = req.body;
  if (!tarif_per_jam) {
    return res.status(400).json({ success: false, message: 'tarif_per_jam wajib diisi' });
  }
  try {
    await pool.query('UPDATE tb_tarif SET tarif_per_jam = ? WHERE id = ?', [tarif_per_jam, req.params.id]);
    res.json({ success: true, message: 'Tarif berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getDashboard, updateTarifDashboard };