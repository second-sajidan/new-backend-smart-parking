const express = require('express');
const router  = express.Router();

const { login, me }                                                    = require('../controllers/AuthController');
const { getAllUsers, getUserById, createUser, updateUser, deleteUser } = require('../controllers/UserController');
const { getAllKendaraan, getKendaraanById, getKendaraanByRfid,
        createKendaraan, updateKendaraan, deleteKendaraan }            = require('../controllers/KendaraanController');
const { getAllTransaksi, getTransaksiById, getTransaksiAktif,
        kendaraanMasuk, kendaraanKeluar,
        getPendingKeluarAPI, konfirmasiBayar, rekapHarian }            = require('../controllers/TransaksiController');
const { getAllArea, createArea, updateArea, deleteArea }               = require('../controllers/AreaController');
const { getAllTarif, updateTarif }                                     = require('../controllers/TarifController');
const { getDashboard, updateTarifDashboard }                          = require('../controllers/DashboardController');
const { getPendapatan }                                               = require('../controllers/PendapatanController');
const { mulaiScan, getPending, simpanKartu,
        getSemuaKartu, hapusKartu }                                   = require('../controllers/DaftarController');
const { verifyToken, isAdmin, isPengelola, isPetugas }                = require('../middleware/auth');

// ── AUTH ──────────────────────────────────────────────────────────
router.post('/auth/login', login);
router.get ('/auth/me',    verifyToken, me);

// ── DASHBOARD ─────────────────────────────────────────────────────
router.get('/dashboard',           ...isPetugas, getDashboard);
router.put('/dashboard/tarif/:id', ...isPetugas, updateTarifDashboard);

// ── PENDAPATAN ────────────────────────────────────────────────────
router.get('/pendapatan', ...isPengelola, getPendapatan);

// ── USER MANAGEMENT (admin only) ─────────────────────────────────
router.get   ('/users',     ...isAdmin, getAllUsers);
router.get   ('/users/:id', ...isAdmin, getUserById);
router.post  ('/users',     ...isAdmin, createUser);
router.put   ('/users/:id', ...isAdmin, updateUser);
router.delete('/users/:id', ...isAdmin, deleteUser);

// ── KENDARAAN ─────────────────────────────────────────────────────
router.get   ('/kendaraan',               ...isPengelola, getAllKendaraan);
router.get   ('/kendaraan/:id',           ...isPengelola, getKendaraanById);
router.get   ('/kendaraan/rfid/:id_rfid', ...isPengelola,   getKendaraanByRfid);
router.post  ('/kendaraan',               ...isPengelola, createKendaraan);
router.put   ('/kendaraan/:id',           ...isPengelola, updateKendaraan);
router.delete('/kendaraan/:id',           ...isPengelola,     deleteKendaraan);

// ── TRANSAKSI ─────────────────────────────────────────────────────
router.get ('/transaksi',                    ...isPetugas,   getAllTransaksi);
router.get ('/transaksi/rekap/harian',       ...isPengelola, rekapHarian);
router.get ('/transaksi/aktif/terbaru',      ...isPetugas,   getTransaksiAktif);
router.get ('/transaksi/pending-keluar',     ...isPetugas,   getPendingKeluarAPI);
router.put ('/transaksi/konfirmasi/:id_card',...isPetugas,   konfirmasiBayar);
router.get ('/transaksi/:id',                ...isPetugas,   getTransaksiById);
router.post('/transaksi/masuk',              ...isPetugas,   kendaraanMasuk);
router.put ('/transaksi/keluar/:id',         ...isPetugas,   kendaraanKeluar);

// ── AREA PARKIR ───────────────────────────────────────────────────
router.get   ('/area',     ...isPetugas,   getAllArea);
router.post  ('/area',     ...isPengelola, createArea);
router.put   ('/area/:id', ...isPengelola, updateArea);
router.delete('/area/:id', ...isAdmin,     deleteArea);

// ── TARIF ─────────────────────────────────────────────────────────
router.get('/tarif',     ...isPetugas,   getAllTarif);
router.put('/tarif/:id', ...isPengelola, updateTarif);

// ── DAFTAR KARTU ──────────────────────────────────────────────────
router.post  ('/daftar/scan',    ...isPetugas, mulaiScan);    // trigger ESP32 scan
router.get   ('/daftar/pending', ...isPetugas, getPending);   // polling UID dari memory
router.post  ('/daftar/simpan',  ...isPetugas, simpanKartu);  // simpan kartu + kendaraan ke DB
router.get   ('/daftar',         ...isPetugas, getSemuaKartu);// list semua kartu
router.delete('/daftar/:id',     ...isAdmin,   hapusKartu);   // hapus kartu + kendaraan

module.exports = router;