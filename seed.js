// Jalankan: node seed.js
// Script ini membuat user awal dengan password yang sudah di-hash

const bcrypt = require('bcryptjs');
const pool = require('./config/db');

const users = [
  { username: 'admin',     password: 'admin123',     role: 'admin' },
  { username: 'pengelola', password: 'pengelola123', role: 'pengelola' },
  { username: 'petugas',   password: 'petugas123',   role: 'petugas' },
];
async function seed() {
  try {
    for (const user of users) {
      const hash = await bcrypt.hash(user.password, 10);
      await pool.query(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password = VALUES(password)',
        [user.username, hash, user.role]
      );
      console.log(`✓ User "${user.username}" (${user.role}) berhasil dibuat`);
    }
    console.log('\nSeeding selesai!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();