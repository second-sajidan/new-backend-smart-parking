const pool = require('../config/db');

// GET /api/tarif
const getAllTarif = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tb_tarif ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/tarif/:id
const updateTarif = async (req, res) => {
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

module.exports = { getAllTarif, updateTarif };