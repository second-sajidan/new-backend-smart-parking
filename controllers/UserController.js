const bcrypt = require('bcryptjs');
const pool   = require('../config/db');

// GET /api/users
const getAllUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, fullname, username, role, status, phone, creation_date FROM tb_user ORDER BY id'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, fullname, username, role, status, phone, creation_date FROM tb_user WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/users
const createUser = async (req, res) => {
  const { fullname, username, password, role, phone } = req.body;
  if (!fullname || !username || !password || !role) {
    return res.status(400).json({ success: false, message: 'fullname, username, password, role wajib diisi' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO tb_user (fullname, username, password, role, status, phone, creation_date)
       VALUES (?, ?, ?, ?, 'aktif', ?, CURDATE())`,
      [fullname, username, hash, role, phone || null]
    );
    res.status(201).json({ success: true, message: 'User berhasil dibuat', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Username sudah digunakan' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/users/:id
const updateUser = async (req, res) => {
  const { fullname, username, password, role, status, phone } = req.body;
  try {
    const fields = [];
    const params = [];

    if (fullname)  { fields.push('fullname = ?');  params.push(fullname); }
    if (username)  { fields.push('username = ?');  params.push(username); }
    if (role)      { fields.push('role = ?');      params.push(role); }
    if (status)    { fields.push('status = ?');    params.push(status); }
    if (phone)     { fields.push('phone = ?');     params.push(phone); }
    if (password)  {
      const hash = await bcrypt.hash(password, 10);
      fields.push('password = ?');
      params.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' });
    }

    params.push(req.params.id);
    await pool.query(`UPDATE tb_user SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/users/:id
const deleteUser = async (req, res) => {
  try {
    await pool.query('DELETE FROM tb_user WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser };