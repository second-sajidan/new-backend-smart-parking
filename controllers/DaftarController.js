const pool = require('../config/db');
const {
  triggerModeDaftar,
  getPendingUID,
  clearPendingUID,
} = require('../services/mqttService');

// ── POST /daftar/scan ─────────────────────────────────────────────
// Publish {daftar:1} ke ESP32 lewat MQTT, clear UID lama dulu
const mulaiScan = async (req, res) => {
  try {
    clearPendingUID();
    triggerModeDaftar();
    return res.json({ success: true, message: 'Scanner aktif, silakan tap kartu' });
  } catch (err) {
    console.error('[DaftarController] mulaiScan error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /daftar/pending ───────────────────────────────────────────
// Dipolling frontend setiap 2 detik, return UID kalau sudah ada
const getPending = (req, res) => {
  const pending = getPendingUID();
  if (pending) {
    return res.json({ success: true, data: pending }); // { uid }
  }
  return res.json({ success: true, data: null });
};

// ── POST /daftar/simpan ───────────────────────────────────────────
// Petugas submit form → simpan kartu + kendaraan ke DB
const simpanKartu = async (req, res) => {
  const { uid, nama_pemilik, tipe_kendaraan, plat_nomor, warna } = req.body;

  if (!uid || !nama_pemilik || !tipe_kendaraan || !plat_nomor) {
    return res.status(400).json({
      success: false,
      message: 'uid, nama_pemilik, tipe_kendaraan, dan plat_nomor wajib diisi',
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Cek UID sudah terdaftar
    const [existingUid] = await conn.query(
      'SELECT id FROM tb_kartu WHERE uid = ? LIMIT 1',
      [uid]
    );
    if (existingUid.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Kartu dengan UID ini sudah terdaftar' });
    }

    // Cek plat nomor sudah terdaftar
    const [existingPlat] = await conn.query(
      'SELECT id FROM tb_kendaraan WHERE plat_nomor = ? LIMIT 1',
      [plat_nomor]
    );
    if (existingPlat.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Plat nomor sudah terdaftar' });
    }

    // Insert kendaraan
    const [kendaraanResult] = await conn.query(
      `INSERT INTO tb_kendaraan (nama_pemilik, tipe_kendaraan, plat_nomor, warna)
       VALUES (?, ?, ?, ?)`,
      [nama_pemilik, tipe_kendaraan.toLowerCase(), plat_nomor.toUpperCase(), warna ?? null]
    );
    const id_kendaraan = kendaraanResult.insertId;

    // Insert kartu
    await conn.query(
      `INSERT INTO tb_kartu (uid, id_kendaraan, nama_pemilik, aktif)
       VALUES (?, ?, ?, 1)`,
      [uid, id_kendaraan, nama_pemilik]
    );

    await conn.commit();
    clearPendingUID();

    console.log(`[DaftarController] ✓ Kartu terdaftar: ${uid} | ${plat_nomor} | ${nama_pemilik}`);
    return res.status(201).json({
      success: true,
      message: 'Kartu berhasil didaftarkan',
      data: { uid, id_kendaraan, nama_pemilik, tipe_kendaraan, plat_nomor },
    });
  } catch (err) {
    await conn.rollback();
    console.error('[DaftarController] simpanKartu error:', err.message);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan: ' + err.message });
  } finally {
    conn.release();
  }
};

// ── GET /daftar ───────────────────────────────────────────────────
// List semua kartu terdaftar
const getSemuaKartu = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT k.id, k.uid, k.nama_pemilik, k.aktif,
              kd.tipe_kendaraan, kd.plat_nomor, kd.warna, kd.id AS id_kendaraan
       FROM tb_kartu k
       LEFT JOIN tb_kendaraan kd ON k.id_kendaraan = kd.id
       ORDER BY k.id DESC`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[DaftarController] getSemuaKartu error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /daftar/:id ────────────────────────────────────────────
// Hapus kartu + kendaraan terkait
const hapusKartu = async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [kartu] = await conn.query(
      'SELECT id_kendaraan FROM tb_kartu WHERE id = ? LIMIT 1',
      [id]
    );
    if (kartu.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Kartu tidak ditemukan' });
    }

    const id_kendaraan = kartu[0].id_kendaraan;
    await conn.query('DELETE FROM tb_kartu WHERE id = ?', [id]);
    if (id_kendaraan) {
      await conn.query('DELETE FROM tb_kendaraan WHERE id = ?', [id_kendaraan]);
    }

    await conn.commit();
    return res.json({ success: true, message: 'Kartu berhasil dihapus' });
  } catch (err) {
    await conn.rollback();
    console.error('[DaftarController] hapusKartu error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
};

module.exports = { mulaiScan, getPending, simpanKartu, getSemuaKartu, hapusKartu };