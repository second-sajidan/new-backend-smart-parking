const jwt = require('jsonwebtoken');
require('dotenv').config();

// Verifikasi token JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token tidak valid atau sudah expired' });
  }
};

// Cek status akun aktif
const isAktif = (req, res, next) => {
  if (req.user.status !== 'aktif') {
    return res.status(403).json({ success: false, message: 'Akun Anda tidak aktif, hubungi admin' });
  }
  next();
};

// Role-based access control
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak. Hanya ${roles.join(', ')} yang diizinkan.`,
      });
    }
    next();
  };
};

// Shortcut chains
const isAdmin     = [verifyToken, isAktif, authorizeRoles('admin')];
const isPengelola = [verifyToken, isAktif, authorizeRoles('admin', 'pengelola', 'petugas')];
const isPetugas   = [verifyToken, isAktif, authorizeRoles('admin', 'pengelola', 'petugas')];

module.exports = { verifyToken, isAktif, authorizeRoles, isAdmin, isPengelola, isPetugas };