const pool = require('../config/db');

// GET /api/area
const getAllArea = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tb_area_parkir ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/area
const createArea = async (req, res) => {
  const { nama_area, kapasitas } = req.body;
  if (!nama_area || !kapasitas) {
    return res.status(400).json({ success: false, message: 'nama_area dan kapasitas wajib diisi' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO tb_area_parkir (nama_area, kapasitas, terisi) VALUES (?, ?, 0)',
      [nama_area, kapasitas]
    );
    res.status(201).json({ success: true, message: 'Area berhasil ditambahkan', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/area/:id
const updateArea = async (req, res) => {
  const { nama_area, kapasitas, terisi } = req.body;
  try {
    await pool.query(
      'UPDATE tb_area_parkir SET nama_area = ?, kapasitas = ?, terisi = ? WHERE id = ?',
      [nama_area, kapasitas, terisi, req.params.id]
    );
    res.json({ success: true, message: 'Area berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/area/:id
const deleteArea = async (req, res) => {
  try {
    await pool.query('DELETE FROM tb_area_parkir WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Area berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllArea, createArea, updateArea, deleteArea };