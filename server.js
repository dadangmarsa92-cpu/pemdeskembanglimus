const express = require('express');
const initSqlJs = require('sql.js');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
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
