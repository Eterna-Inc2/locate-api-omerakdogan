// 1) Env
require('dotenv').config();

// 2) Modüller
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Joi = require('joi');
const mysql = require('mysql2/promise');

// 3) App
const app = express();
app.use(express.json());

// Basit CORS
app.use((req, res, next) => {
  const origin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
 
// 4) MySQL pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 5,
});

// 5) API key middleware
function authDevice(req, res, next) {
  const key = req.header('x-api-key');
  if (!process.env.DEVICE_API_KEY || key !== process.env.DEVICE_API_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

// 6) Doğrulama şeması
const telemetrySchema = Joi.object({
  deviceId: Joi.string().max(64).required(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  speed: Joi.number().optional(),
  heading: Joi.number().optional(),
  ts: Joi.date().iso().optional(),
});

// 7) Sağlık kontrolü
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 8) Telemetry endpoint (veritabanına yaz + herkese gönder)
app.post('/telemetry', authDevice, async (req, res) => {
  const { error, value } = telemetrySchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { deviceId, lat, lng, speed = null, heading = null } = value;
  const ts = value.ts ? new Date(value.ts) : new Date();

  // DB'ye kaydet
  await pool.execute(
    `INSERT INTO locations (device_id, lat, lng, speed, heading, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [deviceId, lat, lng, speed, heading, ts]
  );

  // WebSocket yayını
  io.emit('location', { deviceId, lat, lng, speed, heading, ts: ts.toISOString() });

  res.json({ ok: true });
});


// 9) Son konumlar (her cihaz için en güncel)
app.get('/latest', async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT t.*
    FROM locations t
    JOIN (
      SELECT device_id, MAX(created_at) AS mx
      FROM locations
      GROUP BY device_id
    ) x ON x.device_id = t.device_id AND x.mx = t.created_at
    ORDER BY t.device_id;
  `);
  res.json(rows);
});

// 10) HTTP + WebSocket
const PORT = Number(process.env.PORT || 3001);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (process.env.CORS_ORIGIN || '*').split(','),
  },
  path: '/socket.io',          // <— sabit path
  transports: ['websocket'],   // <— sadece websocket
});


// 11) WebSocket log
io.on('connection', (socket) => {
  console.log('ws connected:', socket.id);
  socket.on('disconnect', () => console.log('ws disconnected:', socket.id));
});

// 12) Başlatmadan önce MySQL bağlantı testi
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ MySQL'e bağlandı.");
    conn.release();

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ MySQL bağlantı hatası:", err.message);
    process.exit(1);
  }
})();