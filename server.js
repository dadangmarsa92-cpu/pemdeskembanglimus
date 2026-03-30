const express = require('express');
const initSqlJs = require('sql.js');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

let db;

// ============================================================
// DATABASE SETUP (async because sql.js uses WASM)
// ============================================================
async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('📂 Database loaded from file.');
  } else {
    db = new SQL.Database();
    console.log('🆕 New database created.');
  }

  // Create users table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('SuperUser', 'User')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create SPPD table if not exists
  db.run(`
    CREATE TABLE IF NOT EXISTS sppd (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor_surat TEXT NOT NULL,
      nama_pegawai TEXT NOT NULL,
      jabatan TEXT NOT NULL,
      acara TEXT NOT NULL,
      kendaraan TEXT NOT NULL,
      tujuan TEXT NOT NULL,
      lama_perjalanan TEXT NOT NULL,
      tanggal_berangkat TEXT NOT NULL,
      tanggal_kembali TEXT NOT NULL,
      dasar_surat TEXT,
      nomor_surat_dasar TEXT,
      nominal_rupiah TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add columns to existing sppd table
  try {
    db.run("ALTER TABLE sppd ADD COLUMN dasar_surat TEXT");
    console.log('📝 Added column: dasar_surat');
  } catch(e) {}
  try {
    db.run("ALTER TABLE sppd ADD COLUMN nomor_surat_dasar TEXT");
    console.log('📝 Added column: nomor_surat_dasar');
  } catch(e) {}
  try {
    db.run("ALTER TABLE sppd ADD COLUMN nominal_rupiah TEXT");
    console.log('📝 Added column: nominal_rupiah');
  } catch(e) {}

  // Create settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Insert default settings if not exists
  const settingsResult = db.exec("SELECT COUNT(*) as count FROM settings");
  const settingsCount = settingsResult[0].values[0][0];
  if (settingsCount === 0) {
    db.run("INSERT INTO settings (key, value) VALUES ('kode_surat', '096')");
    db.run("INSERT INTO settings (key, value) VALUES ('kode_desa', '18')");
    db.run("INSERT INTO settings (key, value) VALUES ('tahun', '" + new Date().getFullYear() + "')");
    db.run("INSERT INTO settings (key, value) VALUES ('nama_desa', 'Kembanglimus')");
    db.run("INSERT INTO settings (key, value) VALUES ('nama_kecamatan', 'Borobudur')");
    db.run("INSERT INTO settings (key, value) VALUES ('nama_kabupaten', 'Magelang')");
    db.run("INSERT INTO settings (key, value) VALUES ('kepala_desa', 'SOETJI ARIMBI')");
    console.log('✅ Default settings created.');
  }

  // Insert default users if table is empty
  const result = db.exec('SELECT COUNT(*) as count FROM users');
  const count = result[0].values[0][0];

  if (count === 0) {
    db.run("INSERT INTO users (username, password, role) VALUES ('admin', 'admin123', 'SuperUser')");
    db.run("INSERT INTO users (username, password, role) VALUES ('user', 'user123', 'User')");
    console.log('✅ Default users created: admin (SuperUser), user (User)');
  }

  // Save to file
  saveDatabase();
}

// Helper: get all settings as object
function getSettings() {
  const result = db.exec('SELECT key, value FROM settings');
  const settings = {};
  if (result.length > 0) {
    result[0].values.forEach(([key, value]) => {
      settings[key] = value;
    });
  }
  return settings;
}

// Helper: generate next SPPD number
function generateNextNomorSurat() {
  const settings = getSettings();
  const kode_surat = settings.kode_surat || '096';
  const kode_desa = settings.kode_desa || '18';
  const tahun = settings.tahun || new Date().getFullYear().toString();

  // Count existing SPPD with same year
  const countResult = db.exec(
    `SELECT COUNT(*) FROM sppd WHERE nomor_surat LIKE '%/${tahun}'`
  );
  const count = countResult.length > 0 ? countResult[0].values[0][0] : 0;
  const urutan = String(parseInt(count) + 1).padStart(3, '0');

  return `${kode_surat}/${urutan}/${kode_desa}/${tahun}`;
}

// Save database to file
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'pemdes-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
  }
}));

// ============================================================
// API ROUTES
// ============================================================

// Login
app.post('/api/login', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({
      success: false,
      message: 'Username, password, dan hak akses wajib diisi.'
    });
  }

  const stmt = db.prepare(
    'SELECT * FROM users WHERE username = ? AND password = ? AND role = ?'
  );
  stmt.bind([username, password, role]);

  let user = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    user = row;
  }
  stmt.free();

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Username, password, atau hak akses salah.'
    });
  }

  // Save session
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;

  return res.json({
    success: true,
    message: `Selamat datang, ${user.username}!`,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

// Check session
app.get('/api/session', (req, res) => {
  if (req.session.userId) {
    return res.json({
      loggedIn: true,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role
      }
    });
  }
  return res.json({ loggedIn: false });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Gagal logout.' });
    }
    res.json({ success: true, message: 'Berhasil logout.' });
  });
});

// Get all users (SuperUser only)
app.get('/api/users', (req, res) => {
  if (!req.session.userId || req.session.role !== 'SuperUser') {
    return res.status(403).json({ success: false, message: 'Akses ditolak.' });
  }

  const result = db.exec('SELECT id, username, role, created_at FROM users');
  const users = [];

  if (result.length > 0) {
    const columns = result[0].columns;
    result[0].values.forEach(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      users.push(obj);
    });
  }

  res.json({ success: true, users });
});

// ============================================================
// SETTINGS API ROUTES
// ============================================================

// Get all settings
app.get('/api/settings', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }
  const settings = getSettings();
  res.json({ success: true, settings });
});

// Update settings (SuperUser only)
app.put('/api/settings', (req, res) => {
  if (!req.session.userId || req.session.role !== 'SuperUser') {
    return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya SuperUser.' });
  }

  const allowed = ['kode_surat', 'kode_desa', 'tahun', 'nama_desa', 'nama_kecamatan', 'nama_kabupaten', 'kepala_desa'];
  const updates = req.body;

  for (const [key, value] of Object.entries(updates)) {
    if (allowed.includes(key) && value !== undefined && value !== null) {
      const existing = db.exec(`SELECT key FROM settings WHERE key = '${key}'`);
      if (existing.length > 0) {
        db.run('UPDATE settings SET value = ? WHERE key = ?', [String(value), key]);
      } else {
        db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
      }
    }
  }

  saveDatabase();
  res.json({ success: true, message: 'Pengaturan berhasil disimpan.' });
});

// Get next SPPD number
app.get('/api/sppd/next-number', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }
  const nextNumber = generateNextNomorSurat();
  res.json({ success: true, nomor: nextNumber });
});

// ============================================================
// SPPD API ROUTES
// ============================================================

// Create SPPD
app.post('/api/sppd', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const { nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah } = req.body;

  if (!nomor_surat || !nama_pegawai || !jabatan || !acara || !kendaraan || !tujuan || !lama_perjalanan || !tanggal_berangkat || !tanggal_kembali) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
  }

  db.run(
    `INSERT INTO sppd (nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah]
  );
  saveDatabase();

  // Get the last inserted id
  const lastId = db.exec('SELECT last_insert_rowid() as id');
  const id = lastId[0].values[0][0];

  res.json({ success: true, message: 'Data SPPD berhasil disimpan.', id });
});

// Get all SPPD
app.get('/api/sppd', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const result = db.exec('SELECT * FROM sppd ORDER BY id DESC');
  const items = [];

  if (result.length > 0) {
    const columns = result[0].columns;
    result[0].values.forEach(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      items.push(obj);
    });
  }

  res.json({ success: true, data: items });
});

// Get single SPPD by ID
app.get('/api/sppd/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const stmt = db.prepare('SELECT * FROM sppd WHERE id = ?');
  stmt.bind([parseInt(req.params.id)]);

  let item = null;
  if (stmt.step()) {
    item = stmt.getAsObject();
  }
  stmt.free();

  if (!item) {
    return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
  }

  res.json({ success: true, data: item });
});

// Delete SPPD
app.delete('/api/sppd/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  db.run('DELETE FROM sppd WHERE id = ?', [parseInt(req.params.id)]);
  saveDatabase();

  res.json({ success: true, message: 'Data SPPD berhasil dihapus.' });
});

// Update SPPD
app.put('/api/sppd/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const { nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah } = req.body;

  if (!nomor_surat || !nama_pegawai || !jabatan || !acara || !kendaraan || !tujuan || !lama_perjalanan || !tanggal_berangkat || !tanggal_kembali) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
  }

  // Check if exists
  const existing = db.exec(`SELECT id FROM sppd WHERE id = ${parseInt(req.params.id)}`);
  if (!existing.length) {
    return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
  }

  db.run(
    `UPDATE sppd SET nomor_surat=?, nama_pegawai=?, jabatan=?, acara=?, kendaraan=?, tujuan=?, lama_perjalanan=?, tanggal_berangkat=?, tanggal_kembali=?, dasar_surat=?, nomor_surat_dasar=?, nominal_rupiah=? WHERE id=?`,
    [nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah, parseInt(req.params.id)]
  );
  saveDatabase();

  res.json({ success: true, message: 'Data SPPD berhasil diperbarui.' });
});


// Get stats count
app.get('/api/stats', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const sppdCount = db.exec('SELECT COUNT(*) FROM sppd');

  res.json({
    success: true,
    stats: {
      sppd: sppdCount[0].values[0][0],
      rab: 0,
      permohonan: 0,
      sk: 0
    }
  });
});

// ============================================================
// START SERVER
// ============================================================
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   🏛️  Pelayanan Pemerintah Desa - Server    ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║   🌐 http://localhost:${PORT}                  ║`);
    console.log('║   📂 Database: database.sqlite               ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  });
}).catch(err => {
  console.error('❌ Failed to initialize database:', err);
  process.exit(1);
});
