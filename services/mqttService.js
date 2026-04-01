const mqtt = require('mqtt');
const pool = require('../config/db');

const BROKER  = 'mqtts://d76c79eda9fe4d37971d86d00d00c2a9.s1.eu.hivemq.cloud:8883';
const OPTIONS = {
  username: 'sajidan',
  password: 'Sajidan3528',
  clientId: `backend-smartparking-${Math.random().toString(16).slice(2, 8)}`,
  clean:    true,
  reconnectPeriod: 5000,
};

const TOPIC_MASUK          = 'petugas/dashboard/masuk';
const TOPIC_KELUAR         = 'petugas/dashboard/keluar';
const TOPIC_DAFTAR         = 'petugas/dashboard/daftar';
const TOPIC_UID            = 'petugas/dashboard/rfid';
const TOPIC_PALANG_MASUK   = 'petugas/dashboard/palang/masuk';
const TOPIC_PALANG_KELUAR  = 'petugas/dashboard/palang/keluar';
const TOPIC_MSG_MASUK      = 'petugas/dashboard/masuk/message';
const TOPIC_MSG_KELUAR     = 'petugas/dashboard/keluar/message';

const toMysqlDatetime = (isoString) => {
  if (!isoString || isoString === '-') return null;
  return new Date(isoString).toISOString().slice(0, 19).replace('T', ' ');
};

const hitungDurasi = (waktuMasuk, waktuKeluar) => {
  const ms  = new Date(waktuKeluar).getTime() - new Date(waktuMasuk).getTime();
  const jam = ms / (1000 * 60 * 60);
  return Math.max(1, Math.ceil(jam));
};

// ── In-memory store untuk pending keluar ─────────────────────────
const pendingKeluar = {};
const getPendingKeluar   = () => pendingKeluar;
const clearPendingKeluar = (id_card) => { delete pendingKeluar[id_card]; };

// ── In-memory store untuk UID hasil scan daftar ───────────────────
let pendingUID = null;
const getPendingUID   = () => pendingUID;
const clearPendingUID = () => { pendingUID = null; };

// ── MQTT client instance ──────────────────────────────────────────
let mqttClientInstance = null;

// ── Helper publish palang masuk ───────────────────────────────────
const publishPalangMasukBuka = () => {
  if (!mqttClientInstance || !mqttClientInstance.connected) return;
  mqttClientInstance.publish(
    TOPIC_PALANG_MASUK,
    JSON.stringify({ buka: 1 }),
    { qos: 1 },
    (err) => {
      if (err) console.error('[MQTT] Gagal publish buka palang masuk:', err.message);
      else     console.log('[MQTT] Palang masuk dibuka');
    }
  );
};

const publishPalangMasukTutup = () => {
  if (!mqttClientInstance || !mqttClientInstance.connected) return;
  mqttClientInstance.publish(
    TOPIC_PALANG_MASUK,
    JSON.stringify({ tutup: 1 }),
    { qos: 1 },
    (err) => {
      if (err) console.error('[MQTT] Gagal publish tutup palang masuk:', err.message);
      else     console.log('[MQTT] Palang masuk ditutup');
    }
  );
};

// ── Helper publish palang keluar ──────────────────────────────────
const publishPalangKeluarBuka = () => {
  if (!mqttClientInstance || !mqttClientInstance.connected) return;
  mqttClientInstance.publish(
    TOPIC_PALANG_KELUAR,
    JSON.stringify({ buka: 1 }),
    { qos: 1 },
    (err) => {
      if (err) console.error('[MQTT] Gagal publish buka palang keluar:', err.message);
      else     console.log('[MQTT] Palang keluar dibuka');
    }
  );
};

const publishPalangKeluarTutup = () => {
  if (!mqttClientInstance || !mqttClientInstance.connected) return;
  mqttClientInstance.publish(
    TOPIC_PALANG_KELUAR,
    JSON.stringify({ tutup: 1 }),
    { qos: 1 },
    (err) => {
      if (err) console.error('[MQTT] Gagal publish tutup palang keluar:', err.message);
      else     console.log('[MQTT] Palang keluar ditutup');
    }
  );
};

// ── Handler Masuk ─────────────────────────────────────────────────
// Payload dari ESP32: { id_rfid, area }
const handleMasuk = async (payload) => {
  const { id_rfid, area } = payload;

  if (!id_rfid || !area) {
    console.warn('[MQTT Masuk] id_rfid atau area kosong, skip.');
    return;
  }

  try {
    // 1. Lookup ke tb_kendaraan berdasarkan id_rfid
    const [kendaraanRows] = await pool.query(
      'SELECT * FROM tb_kendaraan WHERE id_rfid = ? LIMIT 1',
      [id_rfid]
    );

    if (kendaraanRows.length === 0) {
      console.warn(`[MQTT Masuk] RFID ${id_rfid} tidak terdaftar di tb_kendaraan, skip.`);
      return;
    }

    const kendaraan = kendaraanRows[0];

    // 2. Cek apakah kendaraan masih aktif di dalam (belum keluar)
    const [aktif] = await pool.query(
      'SELECT id FROM tb_transaksi WHERE id_card = ? AND waktu_keluar IS NULL LIMIT 1',
      [id_rfid]
    );

    if (aktif.length > 0) {
      console.warn(`[MQTT Masuk] ${kendaraan.plat_nomor} masih aktif di dalam, skip.`);
      return;
    }

    // 3. Insert ke tb_transaksi, waktu_keluar NULL
    await pool.query(
      `INSERT INTO tb_transaksi
       (id_card, nama, id_kendaraan, tipe_kendaraan, plat_nomor, waktu_masuk, waktu_keluar, area, id_user, tanggal)
       VALUES (?, ?, ?, ?, ?, NOW(), NULL, ?, NULL, CURDATE())`,
      [
        id_rfid,
        kendaraan.nama_pemilik,
        kendaraan.id,
        kendaraan.tipe_kendaraan,
        kendaraan.plat_nomor,
        area,
      ]
    );

    console.log(`[MQTT Masuk] ✓ INSERT ${kendaraan.plat_nomor} | ${kendaraan.nama_pemilik} | Tipe: ${kendaraan.tipe_kendaraan} | Area: ${area}`);

    // 4. Publish pesan selamat datang
    if (mqttClientInstance && mqttClientInstance.connected) {
      mqttClientInstance.publish(
        TOPIC_MSG_MASUK,
        JSON.stringify({ message: `${kendaraan.nama_pemilik}` }),
        { qos: 1 },
        (err) => {
          if (err) console.error('[MQTT Masuk] Gagal publish message masuk:', err.message);
          else     console.log(`[MQTT Masuk] Message terkirim → Selamat datang, ${kendaraan.nama_pemilik}`);
        }
      );
    }

    // 5. Publish buka palang masuk
    publishPalangMasukBuka();

    // 6. Auto tutup palang masuk setelah 5 detik
    setTimeout(() => {
      publishPalangMasukTutup();
    }, 5000);

  } catch (err) {
    console.error('[MQTT Masuk] Error insert:', err.message);
  }
};

// ── Handler Keluar ────────────────────────────────────────────────
// Payload dari ESP32: { id_rfid }
const handleKeluar = async (payload) => {
  const { id_rfid } = payload;

  if (!id_rfid) {
    console.warn('[MQTT Keluar] id_rfid kosong, skip.');
    return;
  }

  try {
    // Cari transaksi aktif berdasarkan id_card (id_rfid)
    const [rows] = await pool.query(
      `SELECT * FROM tb_transaksi
       WHERE id_card = ? AND waktu_keluar IS NULL
       ORDER BY waktu_masuk DESC LIMIT 1`,
      [id_rfid]
    );

    if (rows.length === 0) {
      console.warn(`[MQTT Keluar] Tidak ada transaksi aktif untuk RFID: ${id_rfid}`);
      return;
    }

    const transaksi   = rows[0];
    const waktuKeluar = new Date();
    const durasi      = hitungDurasi(transaksi.waktu_masuk, waktuKeluar);
    const tipe        = (transaksi.tipe_kendaraan || 'mobil').toLowerCase();

    const [tarifRows] = await pool.query(
      'SELECT tarif_per_jam FROM tb_tarif WHERE jenis_kendaraan = ? LIMIT 1',
      [tipe]
    );
    const tarifPerJam = tarifRows.length > 0 ? tarifRows[0].tarif_per_jam : 2000;
    const totalBayar  = durasi * tarifPerJam;

    // Simpan ke pending, menunggu konfirmasi petugas
    pendingKeluar[id_rfid] = {
      id_transaksi:   transaksi.id,
      id_card:        id_rfid,
      nama:           transaksi.nama,
      plat_nomor:     transaksi.plat_nomor,
      tipe_kendaraan: transaksi.tipe_kendaraan,
      waktu_masuk:    transaksi.waktu_masuk,
      waktu_keluar:   waktuKeluar.toISOString().slice(0, 19),
      durasi,
      total_bayar:    totalBayar,
      tanggal:        transaksi.tanggal,
      area:           transaksi.area,
    };

    console.log(`[MQTT Keluar] ✓ Pending: ${transaksi.plat_nomor} | Durasi: ${durasi} jam | Total: Rp ${totalBayar.toLocaleString('id-ID')}`);

    // Publish pesan selamat jalan
    if (mqttClientInstance && mqttClientInstance.connected) {
      mqttClientInstance.publish(
        TOPIC_MSG_KELUAR,
        JSON.stringify({ 
          message: `${transaksi.nama}`,
          total_bayar: totalBayar,
          durasi: durasi,
        }),
        { qos: 1 },
        (err) => {
          if (err) console.error('[MQTT Keluar] Gagal publish message keluar:', err.message);
          else     console.log(`[MQTT Keluar] Message terkirim → Selamat jalan, ${transaksi.nama} | Total: Rp ${totalBayar.toLocaleString('id-ID')}`);
        }
      );
    }

  } catch (err) {
    console.error('[MQTT Keluar] Error:', err.message);
  }
};

// ── Handler UID kartu baru ────────────────────────────────────────
const handleUID = (payload) => {
  const { uid } = payload;
  if (!uid) { console.warn('[MQTT UID] uid kosong, skip.'); return; }

  pendingUID = { uid };
  console.log('[MQTT UID] UID diterima, simpan ke memory:', uid);
};

// ── Publish trigger mode daftar ke ESP32 ─────────────────────────
const triggerModeDaftar = () => {
  if (!mqttClientInstance || !mqttClientInstance.connected) {
    throw new Error('MQTT client belum terhubung');
  }
  const payload = JSON.stringify({ daftar: 1 });
  mqttClientInstance.publish(TOPIC_DAFTAR, payload, { qos: 1, retain: true }, (err) => {
    if (err) { console.error('[MQTT] Gagal publish daftar:', err.message); return; }
    console.log('[MQTT] Mode daftar dipublish ke ESP32');
    setTimeout(() => {
      mqttClientInstance.publish(TOPIC_DAFTAR, '', { qos: 1, retain: true });
      console.log('[MQTT] Retained daftar dibersihkan');
    }, 35000);
  });
};

// ── Start ─────────────────────────────────────────────────────────
const startMqttService = () => {
  const client = mqtt.connect(BROKER, OPTIONS);
  mqttClientInstance = client;

  client.on('connect', () => {
    console.log('[MQTT] Terhubung ke HiveMQ Cloud');
    client.subscribe(
      [TOPIC_MASUK, TOPIC_KELUAR, TOPIC_UID],
      { qos: 1 },
      (err) => {
        if (err) console.error('[MQTT] Subscribe error:', err);
        else     console.log(`[MQTT] Subscribe: ${TOPIC_MASUK}, ${TOPIC_KELUAR}, ${TOPIC_UID}`);
      }
    );
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`[MQTT] Pesan masuk → ${topic}:`, payload);
      if      (topic === TOPIC_MASUK)  await handleMasuk(payload);
      else if (topic === TOPIC_KELUAR) await handleKeluar(payload);
      else if (topic === TOPIC_UID)    handleUID(payload);
    } catch (err) {
      console.error('[MQTT] Gagal parse message:', err.message);
    }
  });

  client.on('error',      (err) => console.error('[MQTT] Error:', err.message));
  client.on('reconnect',  ()    => console.log('[MQTT] Mencoba reconnect...'));
  client.on('offline',    ()    => console.warn('[MQTT] Client offline'));
  client.on('disconnect', ()    => console.warn('[MQTT] Disconnected'));

  return client;
};

module.exports = {
  startMqttService,
  getPendingKeluar,      clearPendingKeluar,
  getPendingUID,         clearPendingUID,
  triggerModeDaftar,
  publishPalangMasukBuka,  publishPalangMasukTutup,
  publishPalangKeluarBuka, publishPalangKeluarTutup,
};