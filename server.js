const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const routes            = require('./routes/index');
const { startMqttService } = require('./services/mqttService'); // ← tambah ini

const app = express();

app.use(cors({ origin: '*', credentials: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ success: true, message: '✅ Server sukes! Berjalan di https://backend-parking-nine.vercel.app' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route tidak ditemukan' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // console.log(`✅ Server sukes! Berjalan di https://backend-smart-parking-iot-production.up.railway.app`);
  startMqttService(); // ← tambah ini, dijalankan setelah server ready
});