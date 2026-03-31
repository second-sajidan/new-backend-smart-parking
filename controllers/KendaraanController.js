const pool = require('../config/db');

// GET /api/kendaraan
const getAllKendaraan = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tb_kendaraan ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/kendaraan/:id
const getKendaraanById = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tb_kendaraan WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Kendaraan tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/kendaraan/rfid/:id_rfid
const getKendaraanByRfid = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tb_kendaraan WHERE id_rfid = ?', [req.params.id_rfid]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'Kendaraan tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/kendaraan
const createKendaraan = async (req, res) => {
  const { id_rfid, plat_nomor, nama_pemilik, warna_mobil, tipe_kendaraan } = req.body;
  if (!id_rfid || !plat_nomor || !tipe_kendaraan) {
    return res.status(400).json({ success: false, message: 'id_rfid, plat_nomor, tipe_kendaraan wajib diisi' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO tb_kendaraan (id_rfid, plat_nomor, nama_pemilik, warna_mobil, tipe_kendaraan) VALUES (?, ?, ?, ?, ?)',
      [id_rfid, plat_nomor, nama_pemilik || null, warna_mobil || null, tipe_kendaraan]
    );
    res.status(201).json({ success: true, message: 'Kendaraan berhasil ditambahkan', id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/kendaraan/:id
const updateKendaraan = async (req, res) => {
  const { id_rfid, plat_nomor, nama_pemilik, warna_mobil, tipe_kendaraan } = req.body;
  try {
    await pool.query(
      'UPDATE tb_kendaraan SET id_rfid = ?, plat_nomor = ?, nama_pemilik = ?, warna_mobil = ?, tipe_kendaraan = ? WHERE id = ?',
      [id_rfid, plat_nomor, nama_pemilik || null, warna_mobil || null, tipe_kendaraan, req.params.id]
    );
    res.json({ success: true, message: 'Kendaraan berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/kendaraan/:id
const deleteKendaraan = async (req, res) => {
  try {
    await pool.query('DELETE FROM tb_kendaraan WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Kendaraan berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllKendaraan, getKendaraanById, getKendaraanByRfid, createKendaraan, updateKendaraan, deleteKendaraan };