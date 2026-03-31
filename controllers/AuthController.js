const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');
require('dotenv').config();

const ROLE_REDIRECT = {
  admin:     '/admin/dashboard',
  pengelola: '/pengelola/dashboard',
  petugas:   '/petugas/dashboard',
};

// POST /api/auth/login
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM tb_user WHERE username = ? LIMIT 1',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    const user = rows[0];

    if (user.status !== 'aktif') {
      return res.status(403).json({ success: false, message: 'Akun Anda tidak aktif, hubungi admin' });
    }

    // Support bcrypt hash & plain text
    let isMatch = false;
    if (user.password.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = password === user.password;
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, status: user.status },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      token,
      user: {
        id:       user.id,
        fullname: user.fullname,
        username: user.username,
        role:     user.role,
        phone:    user.phone,
      },
      redirect: ROLE_REDIRECT[user.role] || '/dashboard',
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, fullname, username, role, status, phone, creation_date FROM tb_user WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    return res.status(200).json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
};

module.exports = { login, me };