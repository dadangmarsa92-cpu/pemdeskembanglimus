const express = require('express');
const initSqlJs = require('sql.js');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

let db;

// ============================================================
// DATABASE SETUP (async because sql.js uses WASM)
// ============================================================
async function initDatabase() {
  try {
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

    console.log('📝 Initializing tables...');
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('SuperUser', 'User')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS sppd (id INTEGER PRIMARY KEY AUTOINCREMENT, nomor_surat TEXT NOT NULL, nama_pegawai TEXT NOT NULL, jabatan TEXT NOT NULL, acara TEXT NOT NULL, kendaraan TEXT NOT NULL, tujuan TEXT NOT NULL, lama_perjalanan TEXT NOT NULL, tanggal_berangkat TEXT NOT NULL, tanggal_kembali TEXT NOT NULL, dasar_surat TEXT, nomor_surat_dasar TEXT, nominal_rupiah TEXT, file_base64 TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS narasumber (id INTEGER PRIMARY KEY AUTOINCREMENT, nomor_surat TEXT NOT NULL, tanggal_surat TEXT NOT NULL, nama_narasumber TEXT NOT NULL, bidang TEXT NOT NULL, kegiatan TEXT NOT NULL, tempat_pelaksanaan TEXT NOT NULL, tanggal_pelaksanaan TEXT NOT NULL, waktu_pelaksanaan TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS surat_ahli_waris (id INTEGER PRIMARY KEY AUTOINCREMENT, nomor_surat TEXT NOT NULL, tanggal_surat TEXT NOT NULL, nama_pewaris TEXT NOT NULL, tempat_lahir_pewaris TEXT NOT NULL, tgl_lahir_pewaris TEXT NOT NULL, tgl_meninggal TEXT NOT NULL, alamat_pewaris TEXT NOT NULL, nama_ahli_waris TEXT NOT NULL, hubungan TEXT NOT NULL, nik_ahli_waris TEXT NOT NULL, alamat_ahli_waris TEXT NOT NULL, keterangan TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS rab_records (id INTEGER PRIMARY KEY AUTOINCREMENT, tahun TEXT NOT NULL, ss_code TEXT NOT NULL, ss_name TEXT NOT NULL, judul_kegiatan TEXT DEFAULT '', data_json TEXT NOT NULL, grand_total REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(tahun, ss_code))`
    ];

    for (const sql of tables) {
      db.run(sql);
      await new Promise(r => setTimeout(r, 50));
    }
    
    // Add new column to existing table if necessary
    try {
      db.run("ALTER TABLE rab_records ADD COLUMN judul_kegiatan TEXT DEFAULT ''");
      console.log('✅ Added judul_kegiatan to rab_records.');
    } catch (e) {
      // Column might already exist, ignore
    }
    
    console.log('✅ Tables ready.');

    // --- SEED DATA ---
    console.log('🌱 Seeding default data...');
    const currentYear = new Date().getFullYear().toString();
    const seedCommands = [
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('kode_surat', '096')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('kode_surat_narasumber', '005')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('kode_surat_ahli_waris', '470')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('kode_desa', '18')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('tahun', '${currentYear}')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('nama_desa', 'Kembanglimus')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('nama_kecamatan', 'Borobudur')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('nama_kabupaten', 'Magelang')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('kepala_desa', 'SOETJI ARIMBI')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('alamat_desa', 'Jl. Sudirman KM. 03, Kembanglimus')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('kode_pos_desa', '56553')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('telp_desa', '(0293) 7182286')`,
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('email_desa', 'desakembanglimus1@gmail.com')`,
      `INSERT OR IGNORE INTO users (id, username, password, role) VALUES (1, 'admin', 'admin123', 'SuperUser')`,
      `INSERT OR IGNORE INTO users (id, username, password, role) VALUES (2, 'user', 'user123', 'User')`
    ];

    for (const sql of seedCommands) {
      db.run(sql);
      await new Promise(r => setTimeout(r, 20));
    }
    console.log('✅ Seeding complete.');

    // --- MIGRATIONS ---
    const addCol = (table, col, type) => {
      try {
        const info = db.exec(`PRAGMA table_info(${table})`);
        if (info && info.length > 0) {
          const exists = info[0].values.some(r => r[1] === col);
          if (!exists) {
            db.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
            console.log(`📝 Migration: Added column ${col} to ${table}`);
          }
        }
      } catch (e) {
        console.warn(`⚠️ Migration warning for ${col}:`, e.message);
      }
    };

    addCol('sppd', 'dasar_surat', 'TEXT');
    addCol('sppd', 'nomor_surat_dasar', 'TEXT');
    addCol('sppd', 'nominal_rupiah', 'TEXT');
    addCol('sppd', 'file_base64', 'TEXT');

    console.log('💾 Saving initial state...');
    saveDatabase();
    console.log('🚀 Database initialization complete.');
  } catch (err) {
    console.error('❌ CRITICAL: Database initialization failed:', err);
    throw err;
  }
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

// Helper: generate next Narasumber number
function generateNextNarasumberNumber() {
  const settings = getSettings();
  const kode_surat = settings.kode_surat_narasumber || '005'; // Default for narasumber
  const kode_desa = settings.kode_desa || '18';
  const tahun = settings.tahun || new Date().getFullYear().toString();

  const countResult = db.exec(
    `SELECT COUNT(*) FROM narasumber WHERE nomor_surat LIKE '%/${tahun}'`
  );
  const count = countResult.length > 0 ? countResult[0].values[0][0] : 0;
  const urutan = String(parseInt(count) + 1).padStart(3, '0');

  return `${kode_surat}/${urutan}/${kode_desa}/${tahun}`;
}

// Helper: generate next Surat Ahli Waris number
function generateNextAhliWarisNumber() {
  const settings = getSettings();
  const kode_surat = settings.kode_surat_ahli_waris || '470';
  const kode_desa = settings.kode_desa || '18';
  const tahun = settings.tahun || new Date().getFullYear().toString();

  const countResult = db.exec(
    `SELECT COUNT(*) FROM surat_ahli_waris WHERE nomor_surat LIKE '%/${tahun}'`
  );
  const count = countResult.length > 0 ? countResult[0].values[0][0] : 0;
  const urutan = String(parseInt(count) + 1).padStart(3, '0');

  return `${kode_surat}/${urutan}/${kode_desa}/${tahun}`;
}

// Save database to file
function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('❌ Gagal menyimpan database ke file:', err.message);
  }
}




// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

// ── RAB: Read Excel ──
app.get('/api/rab', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Belum login.' });

  try {
    const bidangPath = path.join(__dirname, 'templates', 'daftar_bidang.xlsx');
    const hierarchyPath = path.join(__dirname, 'templates', 'daftar_sub__sub_bidang.xlsx');

    let bidangData = [];
    if (fs.existsSync(bidangPath)) {
      const wb = XLSX.readFile(bidangPath);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      bidangData = rows
        .filter(r => r[1]) // only rows with a bidang name
        .map(r => ({ no: r[0], nama_bidang: r[1] }));
    }

    let hierarchy = {};
    if (fs.existsSync(hierarchyPath)) {
      const wb = XLSX.readFile(hierarchyPath);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length >= 2) {
        const bidangHeaders = rows[0];
        const subBidangHeaders = rows[1];

        bidangHeaders.forEach((bidangName, colIndex) => {
          if (!bidangName) return;

          if (!hierarchy[bidangName]) hierarchy[bidangName] = {};

          const subBidangName = subBidangHeaders[colIndex];
          if (!subBidangName) return;

          if (!hierarchy[bidangName][subBidangName]) {
            hierarchy[bidangName][subBidangName] = [];
          }

          // Collect sub-sub bidang from row 2 onwards
          for (let i = 2; i < rows.length; i++) {
            const val = rows[i][colIndex];
            if (val) {
              hierarchy[bidangName][subBidangName].push(val);
            }
          }
        });
      }
    }

    res.json({ success: true, bidang: bidangData, hierarchy: hierarchy });
  } catch (err) {
    console.error('Error reading RAB Excel:', err);
    res.status(500).json({ success: false, message: 'Gagal membaca file Excel RAB.' });
  }
});

// Get Rincian Kegiatan Details
app.get('/api/rab/rincian', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Belum login.' });

  const { subSubBidangName } = req.query;
  if (!subSubBidangName) {
    return res.status(400).json({ success: false, message: 'Parameter subSubBidangName diperlukan.' });
  }

  try {
    const rincianPath = path.join(__dirname, 'templates', 'rincian_kegiatan.xlsx');
    if (!fs.existsSync(rincianPath)) {
      return res.status(404).json({ success: false, message: 'File rincian_kegiatan.xlsx tidak ditemukan.' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(rincianPath);
    const sheet = workbook.worksheets[0];

    // Find the column index for the requested Sub-Sub Bidang (Row 1 in exceljs is 1-based)
    let targetColIndex = -1;
    const headerRow = sheet.getRow(1);
    
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      // ExcelJS cell value might be a rich text object or string
      let val = cell.value;
      if (val && typeof val === 'object' && val.richText) {
        val = val.richText.map(rt => rt.text).join('');
      }
      if (val && String(val).trim().toLowerCase() === String(subSubBidangName).trim().toLowerCase()) {
        targetColIndex = colNumber;
      }
    });

    if (targetColIndex === -1) {
      return res.json({ success: true, data: [], message: 'Data rincian tidak ditemukan untuk kegiatan ini.' });
    }

    // Extract items from row 2 downwards
    const items = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > 1) {
        const cell = row.getCell(targetColIndex);
        let val = cell.value;
        if (val && typeof val === 'object' && val.richText) {
            val = val.richText.map(rt => rt.text).join('');
        }
        
        if (val && String(val).trim() !== '') {
          items.push({
            uraian: String(val).trim(),
            isBold: cell.font && cell.font.bold === true
          });
        }
      }
    });

    res.json({ success: true, data: items });
  } catch (err) {
    console.error('Error reading rincian kegiatan Excel:', err);
    res.status(500).json({ success: false, message: 'Gagal membaca file rincian_kegiatan.xlsx.' });
  }
});

// Get Saved RAB Data
app.get('/api/rab/saved', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Belum login.' });

  const { tahun, ss_code } = req.query;
  if (!tahun || !ss_code) {
    return res.status(400).json({ success: false, message: 'Parameter tahun dan ss_code diperlukan.' });
  }

  try {
    const stmt = db.prepare('SELECT data_json, grand_total, judul_kegiatan FROM rab_records WHERE tahun = ? AND ss_code = ?');
    stmt.bind([tahun, ss_code]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      res.json({ success: true, data: JSON.parse(row.data_json), grand_total: row.grand_total, judul_kegiatan: row.judul_kegiatan });
    } else {
      stmt.free();
      res.json({ success: true, data: null }); // Tidak ada data tersimpan
    }
  } catch (err) {
    console.error('Error fetching saved RAB:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data tersimpan.' });
  }
});

// Get All Saved RAB Data for a Year
app.get('/api/rab/saved-all', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Belum login.' });

  const { tahun } = req.query;
  if (!tahun) {
    return res.status(400).json({ success: false, message: 'Parameter tahun diperlukan.' });
  }

  try {
    const stmt = db.prepare('SELECT ss_code, ss_name, judul_kegiatan, data_json, grand_total FROM rab_records WHERE tahun = ? ORDER BY ss_code ASC');
    stmt.bind([tahun]);
    
    const records = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      records.push({
        ss_code: row.ss_code,
        ss_name: row.ss_name,
        judul_kegiatan: row.judul_kegiatan,
        data_json: JSON.parse(row.data_json),
        grand_total: row.grand_total
      });
    }
    stmt.free();
    
    res.json({ success: true, data: records });
  } catch (err) {
    console.error('Error fetching all saved RAB:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data semua RAB tersimpan.' });
  }
});

// Search RAB Records by year + keyword (searches both Excel hierarchy and DB records)
app.get('/api/rab/search', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Belum login.' });

  const { tahun, q } = req.query;
  if (!tahun) {
    return res.status(400).json({ success: false, message: 'Parameter tahun diperlukan.' });
  }

  try {
    const qLower = q ? q.toLowerCase().trim() : '';
    
    // 1. Load Excel Data to get full list of Sub-Sub Bidang
    const bidangPath = path.join(__dirname, 'templates', 'daftar_bidang.xlsx');
    const hierarchyPath = path.join(__dirname, 'templates', 'daftar_sub__sub_bidang.xlsx');

    let bidangMap = {}; // nama -> kode
    if (fs.existsSync(bidangPath)) {
      const wb = XLSX.readFile(bidangPath);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      rows.forEach((r, idx) => {
        if (r[1]) {
          const code = r[0] ? String(r[0]).padStart(2, '0') : String(idx + 1).padStart(2, '0');
          bidangMap[r[1]] = code;
        }
      });
    }

    let allSubSub = [];
    if (fs.existsSync(hierarchyPath)) {
      const wb = XLSX.readFile(hierarchyPath);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

      if (rows.length >= 2) {
        const bidangHeaders = rows[0];
        const subBidangHeaders = rows[1];
        let subBidangCounter = {}; // Tracking sub-bidang order per bidang

        bidangHeaders.forEach((bidangName, colIndex) => {
          if (!bidangName || !subBidangHeaders[colIndex]) return;

          const subName = subBidangHeaders[colIndex];
          if (!subBidangCounter[bidangName]) subBidangCounter[bidangName] = new Set();
          subBidangCounter[bidangName].add(subName);
          
          const bCode = bidangMap[bidangName] || '??';
          const sbCode = String(Array.from(subBidangCounter[bidangName]).indexOf(subName) + 1).padStart(2, '0');
          const baseCode = `${bCode}.${sbCode}`;

          for (let i = 2; i < rows.length; i++) {
            const ssName = rows[i][colIndex];
            if (ssName) {
              const ssCode = `${baseCode}.${String(i - 1).padStart(2, '0')}`;
              allSubSub.push({
                ss_code: ssCode,
                ss_name: String(ssName),
                bidang: bidangName,
                sub_bidang: subName
              });
            }
          }
        });
      }
    }

    // 2. Fetch saved data from DB for this year
    const stmt = db.prepare('SELECT ss_code, ss_name, judul_kegiatan, grand_total FROM rab_records WHERE tahun = ?');
    stmt.bind([tahun]);
    let dbMap = {};
    while (stmt.step()) {
      const row = stmt.getAsObject();
      dbMap[row.ss_code] = row;
    }
    stmt.free();

    // 3. Combine and Filter
    let results = allSubSub.map(item => {
      const dbItem = dbMap[item.ss_code];
      return {
        ...item,
        judul_kegiatan: dbItem ? (dbItem.judul_kegiatan || '') : '',
        grand_total: dbItem ? dbItem.grand_total : 0
      };
    });

    if (qLower) {
      results = results.filter(r => 
        r.ss_name.toLowerCase().includes(qLower) || 
        r.judul_kegiatan.toLowerCase().includes(qLower) ||
        r.ss_code.includes(qLower) ||
        r.bidang.toLowerCase().includes(qLower) ||
        r.sub_bidang.toLowerCase().includes(qLower)
      );
    }

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Error searching RAB:', err);
    res.status(500).json({ success: false, message: 'Gagal melakukan pencarian.' });
  }
});

// Search in RAB Details (Rincian) - searches inside rincian_kegiatan.xlsx and saved records' JSON
app.get('/api/rab/search-rincian', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Belum login.' });

  const { tahun, q } = req.query;
  if (!tahun) return res.status(400).json({ success: false, message: 'Parameter tahun diperlukan.' });
  const qLower = q ? q.toLowerCase().trim() : '';
  if (!qLower) return res.json({ success: true, data: [] });

  try {
    const rincianPath = path.join(__dirname, 'templates', 'rincian_kegiatan.xlsx');
    const bidangPath = path.join(__dirname, 'templates', 'daftar_bidang.xlsx');
    const hierarchyPath = path.join(__dirname, 'templates', 'daftar_sub__sub_bidang.xlsx');

    let results = [];
    let matchMap = {}; // ss_name -> { items: Set }

    // 1. Search in Excel Template
    if (fs.existsSync(rincianPath)) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(rincianPath);
      const sheet = workbook.worksheets[0];

      sheet.columns.forEach((col) => {
        const headerCell = col.values[1];
        let ssName = '';
        if (headerCell) {
          ssName = typeof headerCell === 'object' && headerCell.richText 
            ? headerCell.richText.map(rt => rt.text).join('') 
            : String(headerCell);
          ssName = ssName.trim();
        }
        if (!ssName) return;

        // Cek kecocokan di nama kegiatan (header)
        if (ssName.toLowerCase().includes(qLower)) {
          if (!matchMap[ssName]) matchMap[ssName] = new Set();
          matchMap[ssName].add('📌 [Cocok pada Nama Kegiatan]');
        }

        col.values.forEach((val, rowIdx) => {
          if (rowIdx <= 1 || !val) return;
          let text = typeof val === 'object' && val.richText 
            ? val.richText.map(rt => rt.text).join('') 
            : String(val);
          
          if (text.toLowerCase().includes(qLower)) {
            if (!matchMap[ssName]) matchMap[ssName] = new Set();
            matchMap[ssName].add(text.trim());
          }
        });
      });
    }

    // 2. Search in Saved DB Records (including custom notes/titles)
    const stmt = db.prepare('SELECT ss_name, ss_code, judul_kegiatan, data_json FROM rab_records WHERE tahun = ?');
    stmt.bind([tahun]);
    while (stmt.step()) {
      const row = stmt.getAsObject();
      const items = JSON.parse(row.data_json);
      let ssName = row.ss_name;
      
      // Cek kecocokan di nama kegiatan (header) - jaga-jaga kalau ada yg hanya di DB
      if (ssName.toLowerCase().includes(qLower)) {
        if (!matchMap[ssName]) matchMap[ssName] = new Set();
        matchMap[ssName].add('📌 [Cocok pada Nama Kegiatan]');
      }

      // Search in judul_kegiatan
      if (row.judul_kegiatan && row.judul_kegiatan.toLowerCase().includes(qLower)) {
        if (!matchMap[ssName]) matchMap[ssName] = new Set();
        matchMap[ssName].add(`[Judul Tambahan] ${row.judul_kegiatan}`);
      }

      // Search in rincian items
      items.forEach(item => {
        // Search in uraian
        if (item.uraian && item.uraian.toLowerCase().includes(qLower)) {
            if (!matchMap[ssName]) matchMap[ssName] = new Set();
            matchMap[ssName].add(item.uraian.trim());
        }
        // Search in catatan
        if (item.catatan && item.catatan.toLowerCase().includes(qLower)) {
          if (!matchMap[ssName]) matchMap[ssName] = new Set();
          matchMap[ssName].add(`[Catatan] ${item.catatan.trim()}`);
        }
      });
    }
    stmt.free();


    // 3. Get codes for these names to allow navigation
    let nameToCode = {};
    if (fs.existsSync(bidangPath) && fs.existsSync(hierarchyPath)) {
        // Build the same mapping as search-rab
        const wbB = XLSX.readFile(bidangPath);
        const rowsB = XLSX.utils.sheet_to_json(wbB.Sheets[wbB.SheetNames[0]], { header: 1 });
        let bMap = {};
        rowsB.forEach((r, i) => { if(r[1]) bMap[r[1]] = r[0] ? String(r[0]).padStart(2, '0') : String(i+1).padStart(2, '0'); });

        const wbH = XLSX.readFile(hierarchyPath);
        const rowsH = XLSX.utils.sheet_to_json(wbH.Sheets[wbH.SheetNames[0]], { header: 1 });
        if (rowsH.length >= 2) {
            const bh = rowsH[0]; const sbh = rowsH[1];
            let sbCount = {};
            bh.forEach((bn, colIdx) => {
                if(!bn || !sbh[colIdx]) return;
                if(!sbCount[bn]) sbCount[bn] = new Set();
                sbCount[bn].add(sbh[colIdx]);
                const bc = bMap[bn] || '??';
                const sbc = String(Array.from(sbCount[bn]).indexOf(sbh[colIdx]) + 1).padStart(2, '0');
                for(let i=2; i<rowsH.length; i++) {
                    if(rowsH[i][colIdx]) {
                        const code = `${bc}.${sbc}.${String(i-1).padStart(2, '0')}`;
                        nameToCode[rowsH[i][colIdx]] = { code, bidang: bn, sub_bidang: sbh[colIdx] };
                    }
                }
            });
        }
    }

    // 4. Format results
    results = Object.keys(matchMap).map(name => {
      const mapping = nameToCode[name] || { code: '??', bidang: '??', sub_bidang: '??' };
      return {
        ss_name: name,
        ss_code: mapping.code,
        bidang: mapping.bidang,
        sub_bidang: mapping.sub_bidang,
        matching_items: Array.from(matchMap[name])
      };
    });

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('Error searching RAB details:', err);
    res.status(500).json({ success: false, message: 'Gagal melakukan pencarian rincian.' });
  }
});

// Save RAB Data
app.post('/api/rab/save', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Belum login.' });

  const { tahun, ss_code, ss_name, judul_kegiatan, data_json, grand_total } = req.body;
  if (!tahun || !ss_code || !ss_name || !data_json) {
    return res.status(400).json({ success: false, message: 'Data tidak lengkap.' });
  }

  try {
    const jsonString = JSON.stringify(data_json);
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO rab_records (tahun, ss_code, ss_name, judul_kegiatan, data_json, grand_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run([tahun, ss_code, ss_name, judul_kegiatan || '', jsonString, grand_total]);
    stmt.free();
    
    saveDatabase();
    
    res.json({ success: true, message: 'Data Rincian Kegiatan RAB berhasil disimpan.' });
  } catch (err) {
    console.error('Error saving RAB:', err);
    res.status(500).json({ success: false, message: 'Gagal menyimpan data RAB.' });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username dan password wajib diisi.'
    });
  }

  const stmt = db.prepare(
    'SELECT * FROM users WHERE username = ? AND password = ?'
  );
  stmt.bind([username, password]);

  let user = null;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    user = row;
  }
  stmt.free();

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Username atau password salah.'
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

// Get all users
app.get('/api/users', (req, res) => {
  if (!req.session.userId) {
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
// TEMPLATE API ROUTES
// ============================================================

// Upload Word Template
app.post('/api/settings/upload-template', (req, res) => {
  if (!req.session.userId) {
    return res.status(403).json({ success: false, message: 'Akses ditolak.' });
  }

  const { file_base64 } = req.body;
  if (!file_base64) {
    return res.status(400).json({ success: false, message: 'File tidak ditemukan.' });
  }

  try {
    const data = file_base64.split(',')[1];
    const buffer = Buffer.from(data, 'base64');
    const templateDir = path.join(__dirname, 'templates');
    if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir);
    
    const templatePath = path.join(templateDir, 'sppd_template.docx');
    fs.writeFileSync(templatePath, buffer);
    console.log(`📂 Template Word uploaded: ${buffer.length} bytes`);
    res.json({ success: true, message: 'Template Word berhasil diunggah.' });
  } catch (err) {
    console.error('❌ Template Upload Error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengunggah template.' });
  }
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

// Update settings
app.put('/api/settings', (req, res) => {
  if (!req.session.userId) {
    return res.status(403).json({ success: false, message: 'Akses ditolak.' });
  }

  const allowed = ['kode_surat', 'kode_surat_narasumber', 'kode_surat_ahli_waris', 'kode_desa', 'tahun', 'nama_desa', 'nama_kecamatan', 'nama_kabupaten', 'kepala_desa', 'alamat_desa', 'kode_pos_desa', 'telp_desa', 'email_desa'];
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

// Get next Narasumber number
app.get('/api/narasumber/next-number', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }
  const nextNumber = generateNextNarasumberNumber();
  res.json({ success: true, nomor: nextNumber });
});

// Get next Ahli Waris number
app.get('/api/surat-ahli-waris/next-number', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }
  const nextNumber = generateNextAhliWarisNumber();
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

  const { nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah, file_base64 } = req.body;

  console.log(`[POST /api/sppd] Incoming request for: ${nomor_surat}`);
  const fileSize = file_base64 ? Math.round(file_base64.length / 1024) : 0;
  console.log(`[POST /api/sppd] File status: ${file_base64 ? `Attached (${fileSize} KB)` : 'No file'}`);

  if (!nomor_surat || !nama_pegawai || !jabatan || !acara || !kendaraan || !tujuan || !lama_perjalanan || !tanggal_berangkat || !tanggal_kembali) {
    console.warn(`[POST /api/sppd] ❌ Validation failed: missing fields.`);
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
  }

  try {
    db.run(
      `INSERT INTO sppd (nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah, file_base64) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah, file_base64]
    );
    saveDatabase();
    console.log(`[POST /api/sppd] ✅ Successfully saved SPPD data.`);

    // Get the last inserted id
    const lastId = db.exec('SELECT last_insert_rowid() as id');
    const id = lastId[0].values[0][0];

    res.json({ success: true, message: 'Data SPPD berhasil disimpan.', id });
  } catch (err) {
    console.error(`[POST /api/sppd] ❌ DB Error:`, err.message);
    res.status(500).json({ success: false, message: 'Gagal menyimpan ke database.', error: err.message });
  }
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

// ============================================================
// NARASUMBER API ROUTES
// ============================================================

// Create Narasumber
app.post('/api/narasumber', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const { nomor_surat, tanggal_surat, nama_narasumber, bidang, kegiatan, tempat_pelaksanaan, tanggal_pelaksanaan, waktu_pelaksanaan } = req.body;

  if (!nomor_surat || !tanggal_surat || !nama_narasumber || !bidang || !kegiatan || !tempat_pelaksanaan || !tanggal_pelaksanaan || !waktu_pelaksanaan) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
  }

  try {
    db.run(
      `INSERT INTO narasumber (nomor_surat, tanggal_surat, nama_narasumber, bidang, kegiatan, tempat_pelaksanaan, tanggal_pelaksanaan, waktu_pelaksanaan) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nomor_surat, tanggal_surat, nama_narasumber, bidang, kegiatan, tempat_pelaksanaan, tanggal_pelaksanaan, waktu_pelaksanaan]
    );
    saveDatabase();
    
    const lastId = db.exec('SELECT last_insert_rowid() as id');
    const id = lastId[0].values[0][0];

    res.json({ success: true, message: 'Data Narasumber berhasil disimpan.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menyimpan ke database.', error: err.message });
  }
});

// Get all Narasumber
app.get('/api/narasumber', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const result = db.exec('SELECT * FROM narasumber ORDER BY id DESC');
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

// Get single Narasumber by ID
app.get('/api/narasumber/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const stmt = db.prepare('SELECT * FROM narasumber WHERE id = ?');
  stmt.bind([parseInt(req.params.id)]);
  let item = null;
  if (stmt.step()) item = stmt.getAsObject();
  stmt.free();

  if (!item) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
  res.json({ success: true, data: item });
});

// Update Narasumber
app.put('/api/narasumber/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const { nomor_surat, tanggal_surat, nama_narasumber, bidang, kegiatan, tempat_pelaksanaan, tanggal_pelaksanaan, waktu_pelaksanaan } = req.body;

  try {
    db.run(
      `UPDATE narasumber SET nomor_surat=?, tanggal_surat=?, nama_narasumber=?, bidang=?, kegiatan=?, tempat_pelaksanaan=?, tanggal_pelaksanaan=?, waktu_pelaksanaan=? WHERE id=?`,
      [nomor_surat, tanggal_surat, nama_narasumber, bidang, kegiatan, tempat_pelaksanaan, tanggal_pelaksanaan, waktu_pelaksanaan, req.params.id]
    );
    saveDatabase();
    res.json({ success: true, message: 'Data Narasumber berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui database.', error: err.message });
  }
});

// Delete Narasumber
app.delete('/api/narasumber/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  try {
    db.run('DELETE FROM narasumber WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.json({ success: true, message: 'Data Narasumber berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus data.', error: err.message });
  }
});

// Generate Word (DOCX) SPPD Penerimaan Multiple
app.get('/api/sppd/generate-penerimaan-docx', (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) return res.status(400).send('Parameter ids tidak ditemukan.');
  
  const ids = idsParam.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
  if (ids.length === 0) return res.status(400).send('ID SPPD tidak valid.');

  console.log(`[GET /api/sppd/generate-penerimaan-docx] 📥 Requesting DOCX for IDs: ${ids.join(', ')}`);

  if (!req.session.userId) {
    return res.status(401).send('Belum login.');
  }

  const templatePath = path.join(__dirname, 'templates', 'sppdpenerimaan_template.docx');
  if (!fs.existsSync(templatePath)) {
    return res.status(404).send('Template Word sppdpenerimaan_template.docx tidak ditemukan.');
  }

  try {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`SELECT * FROM sppd WHERE id IN (${placeholders})`);
    stmt.bind(ids);
    
    const items = [];
    while (stmt.step()) {
      items.push(stmt.getAsObject());
    }
    stmt.free();

    if (items.length === 0) return res.status(404).send('Data SPPD tidak ditemukan.');

    const settings = getSettings();
    const firstItem = items[0]; // Used for common headers if needed
    
    let totalNominalNum = 0;

    const peserta = items.map((item, index) => {
      const nominalNum = Number(item.nominal_rupiah) || 0;
      totalNominalNum += nominalNum;
      return {
        no: index + 1,
        nama_pegawai: item.nama_pegawai,
        gol: item.jabatan || '-',
        tujuan: item.tujuan,
        lama_perjalanan: String(item.lama_perjalanan).replace(/\D+/g, ''), // Get only the number
        tgl_berangkat: formatDateID(item.tanggal_berangkat),
        tgl_kembali: formatDateID(item.tanggal_kembali),
        nominal: item.nominal_rupiah ? `Rp. ${new Intl.NumberFormat('id-ID').format(nominalNum)}` : 'Rp. 0'
      };
    });

    const templateData = {
      // Global/Header fields
      nomor_surat: firstItem.nomor_surat,
      nama_desa: settings.nama_desa || 'Kembanglimus',
      nama_kecamatan: settings.nama_kecamatan || 'Borobudur',
      nama_kabupaten: settings.nama_kabupaten || 'Magelang',
      kepala_desa: settings.kepala_desa || 'SOETJI ARIMBI',
      total_nominal: `Rp. ${new Intl.NumberFormat('id-ID').format(totalNominalNum)}`,
      jumlah_nominal: `Rp. ${new Intl.NumberFormat('id-ID').format(totalNominalNum)}`,
      
      // The array for loop: {#nama_pegawai} ... {/nama_pegawai}
      // Template uses nama_pegawai as the loop variable name
      nama_pegawai: peserta
    };

    const content = fs.readFileSync(templatePath); 
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(templateData);

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const safeFilename = `SPPD_Penerimaan_${Date.now()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);

  } catch (err) {
    console.error('❌ DOCX Generation Error Details:', err);
    
    let errorMsg = 'Ada kesalahan sistem saat memproses dokumen.';
    if (err.properties && err.properties.errors instanceof Array) {
      errorMsg = err.properties.errors.map(e => e.properties.explanation).join('\n');
    } else if (err.message) {
      errorMsg = err.message;
    }
    
    res.status(500).send(`
      <div style="font-family:sans-serif; padding:40px; text-align:center; color:#333;">
        <h2 style="color:#e53935;">Terjadi Kesalahan pada Template Word Anda</h2>
        <p>Sistem tidak dapat memproses file <b>sppdpenerimaan_template.docx</b> karena penulisan tag (kurung kurawal) yang tidak valid.</p>
        <div style="background:#ffebee; border:1px solid #ffcdd2; color:#b71c1c; padding:20px; border-radius:8px; display:inline-block; text-align:left; max-width:800px; margin-top:20px; font-family:monospace; white-space:pre-wrap;">${errorMsg}</div>
        <p style="margin-top:30px;"><b>Solusi:</b> Silakan buka file <code>sppdpenerimaan_template.docx</code> di Microsoft Word, dan perbaiki penulisan tag sesuai petunjuk, lalu simpan kembali.</p>
        <button onclick="window.close()" style="margin-top:20px; padding:10px 20px; background:#2196F3; color:white; border:none; border-radius:4px; cursor:pointer;">Tutup Halaman Ini</button>
      </div>
    `);
  }
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

  const { nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah, file_base64 } = req.body;

  console.log(`[PUT /api/sppd/${req.params.id}] Updating request for: ${nomor_surat}`);
  const fileSize = file_base64 ? Math.round(file_base64.length / 1024) : 0;
  console.log(`[PUT /api/sppd/${req.params.id}] File status: ${file_base64 ? `Attached (${fileSize} KB)` : 'No file'}`);

  if (!nomor_surat || !nama_pegawai || !jabatan || !acara || !kendaraan || !tujuan || !lama_perjalanan || !tanggal_berangkat || !tanggal_kembali) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
  }

  try {
    // Check if exists
    const existing = db.exec(`SELECT id FROM sppd WHERE id = ${parseInt(req.params.id)}`);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
    }

    db.run(
      `UPDATE sppd SET nomor_surat=?, nama_pegawai=?, jabatan=?, acara=?, kendaraan=?, tujuan=?, lama_perjalanan=?, tanggal_berangkat=?, tanggal_kembali=?, dasar_surat=?, nomor_surat_dasar=?, nominal_rupiah=?, file_base64=? WHERE id=?`,
      [nomor_surat, nama_pegawai, jabatan, acara, kendaraan, tujuan, lama_perjalanan, tanggal_berangkat, tanggal_kembali, dasar_surat, nomor_surat_dasar, nominal_rupiah, file_base64, parseInt(req.params.id)]
    );
    saveDatabase();
    console.log(`[PUT /api/sppd/${req.params.id}] ✅ Successfully updated SPPD data.`);

    res.json({ success: true, message: 'Data SPPD berhasil diperbarui.' });
  } catch (err) {
    console.error(`[PUT /api/sppd/${req.params.id}] ❌ DB Error:`, err.message);
    res.status(500).json({ success: false, message: 'Gagal memperbarui database.', error: err.message });
  }
});

// Helper: Format Date ID
function formatDateID(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Helper: Get Day Name ID
function getDayNameID(dateStr) {
  if (!dateStr) return '-';
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

// Generate Word (DOCX) SPPD
app.get('/api/sppd/generate-docx/:id', (req, res) => {
  const sppdId = req.params.id;
  console.log(`[GET /api/sppd/generate-docx] 📥 Requesting DOCX for ID: ${sppdId}`);

  if (!req.session.userId) {
    console.warn(`[GET /api/sppd/generate-docx] ❌ Unauthorized request.`);
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const templatePath = path.join(__dirname, 'templates', 'sppd_template.docx');
  if (!fs.existsSync(templatePath)) {
    return res.status(404).send('Template Word tidak ditemukan. Silakan unggah template di menu Pengaturan.');
  }

  try {
    const stmt = db.prepare('SELECT * FROM sppd WHERE id = ?');
    stmt.bind([parseInt(req.params.id)]);
    let item = null;
    if (stmt.step()) item = stmt.getAsObject();
    stmt.free();

    if (!item) return res.status(404).send('Data SPPD tidak ditemukan.');

    const settings = getSettings();
    
    // Prepare Data for Template
    const templateData = {
      nomor_surat: item.nomor_surat,
      nama_pegawai: item.nama_pegawai,
      jabatan: item.jabatan,
      acara: item.acara,
      kendaraan: item.kendaraan,
      tujuan: item.tujuan,
      lama_perjalanan: item.lama_perjalanan,
      tgl_berangkat: formatDateID(item.tanggal_berangkat),
      tgl_kembali: formatDateID(item.tanggal_kembali),
      dasar_surat: item.dasar_surat || '-',
      nomor_dasar: item.nomor_surat_dasar || '-',
      nominal: item.nominal_rupiah ? `Rp. ${new Intl.NumberFormat('id-ID').format(Number(item.nominal_rupiah))}` : 'Rp. 0',
      hari_berangkat: getDayNameID(item.tanggal_berangkat),
      hari_kembali: getDayNameID(item.tanggal_kembali),
      nama_desa: settings.nama_desa || 'Kembanglimus',
      nama_kecamatan: settings.nama_kecamatan || 'Borobudur',
      nama_kabupaten: settings.nama_kabupaten || 'Magelang',
      kepala_desa: settings.kepala_desa || 'SOETJI ARIMBI',
      alamat_desa: settings.alamat_desa || '-',
      kode_pos_desa: settings.kode_pos_desa || '-',
      telp_desa: settings.telp_desa || '-',
      email_desa: settings.email_desa || '-'
    };

    const content = fs.readFileSync(templatePath); // Read as Buffer (recommended for PizZip v3)
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    doc.render(templateData);

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const safeFilename = `SPPD_${item.nama_pegawai.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);

  } catch (err) {
    // Detailed Docxtemplater Error Handling
    if (err.properties && err.properties.errors instanceof Array) {
      const errorMessages = err.properties.errors.map(function (error) {
        return error.properties.explanation;
      }).join("\n");
      console.error('❌ DOCX Template Syntax Errors:\n', errorMessages);
    } else {
      console.error('❌ DOCX Generation Error Details:', {
        message: err.message,
        stack: err.stack,
        id: req.params.id
      });
    }
    
    res.status(500).send('Ada kesalahan penulisan tag {{ }} di file Template Word Anda. Mohon periksa kembali file template.');
  }
});

// Generate Narasumber DOCX
app.get('/api/narasumber/generate-docx/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('Belum login.');
  }

  const templatePath = path.join(__dirname, 'templates', 'narasumber_template.docx');
  if (!fs.existsSync(templatePath)) {
    return res.status(404).send('Template Narasumber tidak ditemukan.');
  }

  try {
    const stmt = db.prepare('SELECT * FROM narasumber WHERE id = ?');
    stmt.bind([parseInt(req.params.id)]);
    let item = null;
    if (stmt.step()) item = stmt.getAsObject();
    stmt.free();

    if (!item) return res.status(404).send('Data Narasumber tidak ditemukan.');

    const settings = getSettings();
    
    // Prepare Data for Template
    const templateData = {
      nomor_surat: item.nomor_surat,
      tanggal_surat: formatDateID(item.tanggal_surat),
      nama_narasumber: item.nama_narasumber,
      bidang: item.bidang,
      kegiatan: item.kegiatan,
      tempat_pelaksanaan: item.tempat_pelaksanaan,
      tanggal_pelaksanaan: formatDateID(item.tanggal_pelaksanaan),
      waktu_pelaksanaan: item.waktu_pelaksanaan,
      nama_desa: settings.nama_desa || 'Kembanglimus',
      nama_kecamatan: settings.nama_kecamatan || 'Borobudur',
      nama_kabupaten: settings.nama_kabupaten || 'Magelang',
      kepala_desa: settings.kepala_desa || 'SOETJI ARIMBI',
      alamat_desa: settings.alamat_desa || '-',
      kode_pos_desa: settings.kode_pos_desa || '-',
      telp_desa: settings.telp_desa || '-',
      email_desa: settings.email_desa || '-',
      tahun_berjalan: settings.tahun || new Date().getFullYear().toString()
    };

    const content = fs.readFileSync(templatePath); 
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render(templateData);

    const buf = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });

    const safeFilename = `Narasumber_${item.nama_narasumber.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', buf.length);
    res.send(buf);

  } catch (err) {
    console.error('❌ Narasumber DOCX Generation Error:', err);
    res.status(500).send('Gagal membuat dokumen. Periksa template.');
  }
});


// Get stats count
app.get('/api/stats', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const sppdCount = db.exec('SELECT COUNT(*) FROM sppd');
  const narasumberCount = db.exec('SELECT COUNT(*) FROM narasumber');
  
  let ahliWarisCount = 0;
  try {
    const awResult = db.exec('SELECT COUNT(*) FROM surat_ahli_waris');
    ahliWarisCount = awResult.length > 0 ? awResult[0].values[0][0] : 0;
  } catch (e) { /* table may not exist yet */ }

  res.json({
    success: true,
    stats: {
      sppd: sppdCount[0].values[0][0],
      narasumber: narasumberCount[0].values[0][0],
      ahli_waris: ahliWarisCount,
      rab: 0,
      permohonan: 0,
      sk: 0
    }
  });
});

// ============================================================
// SURAT AHLI WARIS API ROUTES
// ============================================================

// Create Surat Ahli Waris
app.post('/api/surat-ahli-waris', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const { nomor_surat, tanggal_surat, nama_pewaris, tempat_lahir_pewaris, tgl_lahir_pewaris, tgl_meninggal, alamat_pewaris, nama_ahli_waris, hubungan, nik_ahli_waris, alamat_ahli_waris, keterangan } = req.body;

  if (!nomor_surat || !tanggal_surat || !nama_pewaris || !tempat_lahir_pewaris || !tgl_lahir_pewaris || !tgl_meninggal || !alamat_pewaris || !nama_ahli_waris || !hubungan || !nik_ahli_waris || !alamat_ahli_waris) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
  }

  try {
    db.run(
      `INSERT INTO surat_ahli_waris (nomor_surat, tanggal_surat, nama_pewaris, tempat_lahir_pewaris, tgl_lahir_pewaris, tgl_meninggal, alamat_pewaris, nama_ahli_waris, hubungan, nik_ahli_waris, alamat_ahli_waris, keterangan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nomor_surat, tanggal_surat, nama_pewaris, tempat_lahir_pewaris, tgl_lahir_pewaris, tgl_meninggal, alamat_pewaris, nama_ahli_waris, hubungan, nik_ahli_waris, alamat_ahli_waris, keterangan || '']
    );
    saveDatabase();
    
    const lastId = db.exec('SELECT last_insert_rowid() as id');
    const id = lastId[0].values[0][0];

    res.json({ success: true, message: 'Surat Ahli Waris berhasil disimpan.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menyimpan ke database.', error: err.message });
  }
});

// Get all Surat Ahli Waris
app.get('/api/surat-ahli-waris', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const result = db.exec('SELECT * FROM surat_ahli_waris ORDER BY id DESC');
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

// Get single Surat Ahli Waris by ID
app.get('/api/surat-ahli-waris/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const stmt = db.prepare('SELECT * FROM surat_ahli_waris WHERE id = ?');
  stmt.bind([parseInt(req.params.id)]);
  let item = null;
  if (stmt.step()) item = stmt.getAsObject();
  stmt.free();

  if (!item) return res.status(404).json({ success: false, message: 'Data tidak ditemukan.' });
  res.json({ success: true, data: item });
});

// Update Surat Ahli Waris
app.put('/api/surat-ahli-waris/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  const { nomor_surat, tanggal_surat, nama_pewaris, tempat_lahir_pewaris, tgl_lahir_pewaris, tgl_meninggal, alamat_pewaris, nama_ahli_waris, hubungan, nik_ahli_waris, alamat_ahli_waris, keterangan } = req.body;

  try {
    db.run(
      `UPDATE surat_ahli_waris SET nomor_surat=?, tanggal_surat=?, nama_pewaris=?, tempat_lahir_pewaris=?, tgl_lahir_pewaris=?, tgl_meninggal=?, alamat_pewaris=?, nama_ahli_waris=?, hubungan=?, nik_ahli_waris=?, alamat_ahli_waris=?, keterangan=? WHERE id=?`,
      [nomor_surat, tanggal_surat, nama_pewaris, tempat_lahir_pewaris, tgl_lahir_pewaris, tgl_meninggal, alamat_pewaris, nama_ahli_waris, hubungan, nik_ahli_waris, alamat_ahli_waris, keterangan || '', req.params.id]
    );
    saveDatabase();
    res.json({ success: true, message: 'Surat Ahli Waris berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal memperbarui database.', error: err.message });
  }
});

// Delete Surat Ahli Waris
app.delete('/api/surat-ahli-waris/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Belum login.' });
  }

  try {
    db.run('DELETE FROM surat_ahli_waris WHERE id = ?', [req.params.id]);
    saveDatabase();
    res.json({ success: true, message: 'Surat Ahli Waris berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Gagal menghapus data.', error: err.message });
  }
});

// ── CETAK DAFTAR HADIR PESERTA ──
app.post('/api/cetak/daftar-hadir-peserta', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Belum login.' });

  try {
    const { hari_tanggal_pelaksanaan, judul_kegiatan, nama_pelaksana_kegiatan, jumlah_baris } = req.body;
    
    // Susun array peserta untuk loop baris kosong
    const baris = parseInt(jumlah_baris) || 10;
    const peserta = [];
    for (let i = 1; i <= baris; i++) {
      // Logika zig-zag: ganjil di kiri, genap agak di kanan
      const ttd = i % 2 !== 0 ? `${i}.` : `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0${i}.`;
      peserta.push({
        no: i,
        nama: '',
        jabatan: '',
        alamat: '',
        tanda_tangan: ttd
      });
    }

    const templatePath = path.join(__dirname, 'templates', 'daftar_hadir_template.docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ success: false, message: 'Template daftar_hadir_template.docx tidak ditemukan.' });
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    const doc = new Docxtemplater(zip, { 
        paragraphLoop: true, 
        linebreaks: true 
    });

    doc.render({
      hari_tanggal_pelaksanaan: hari_tanggal_pelaksanaan || '-',
      judul_kegiatan: judul_kegiatan || '-',
      nama_pelaksana_kegiatan: nama_pelaksana_kegiatan || '-',
      peserta: peserta
    });

    const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const fileName = `Daftar_Hadir_Peserta_${Date.now()}.docx`;
    const outputDir = path.join(__dirname, 'public', 'arsip');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, buf);
    
    res.json({ success: true, downloadUrl: `/arsip/${fileName}` });
  } catch (err) {
    console.error('Error cetak daftar hadir peserta:', err);
    res.status(500).json({ success: false, message: 'Gagal membuat dokumen daftar hadir.', error: err.message });
  }
});

// ── CETAK DAFTAR PENERIMAAN ──
app.post('/api/cetak/daftar-penerimaan', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ success: false, message: 'Belum login.' });

  try {
    const { pelaksana_kegiatan, nominal, jumlah_baris } = req.body;
    
    // Ambil setting dari database untuk bendahara_desa
    const settings = getSettings();
    const bendahara_desa = settings.bendahara_desa || '';

    // Perhitungan
    const numNominal = parseFloat(nominal) || 0;
    const numPph21 = Math.round(numNominal * 0.05); // 5%
    const numBersih = numNominal - numPph21;

    // Helper format rupiah
    const formatRp = (angka) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
    };

    const strPenerimaan = numNominal > 0 ? formatRp(numNominal) : '';
    const strPph21 = numPph21 > 0 ? formatRp(numPph21) : '';
    const strBersih = numBersih > 0 ? formatRp(numBersih) : '';

    // Susun array penerima
    const baris = parseInt(jumlah_baris) || 10;
    const penerima = [];
    for (let i = 1; i <= baris; i++) {
      const ttd = i % 2 !== 0 ? `${i}.` : `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0${i}.`;
      penerima.push({
        no: i,
        nik: '',
        nama: '',
        jabatan: '',
        penerimaan: strPenerimaan,
        pph21: strPph21,
        bersih: strBersih,
        tanda_tangan: ttd
      });
    }

    const numTotalPenerimaan = numNominal * baris;
    const numTotalPph21 = numPph21 * baris;
    const numTotalBersih = numBersih * baris;

    const templatePath = path.join(__dirname, 'templates', 'daftar_penerimaan_template.docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ success: false, message: 'Template daftar_penerimaan_template.docx tidak ditemukan.' });
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);
    
    const doc = new Docxtemplater(zip, { 
        paragraphLoop: true, 
        linebreaks: true 
    });

    doc.render({
      hari_tanggal_pelaksanaan: req.body.hari_tanggal_pelaksanaan || '-',
      judul_kegiatan: req.body.judul_kegiatan || '-',
      bendahara_desa: bendahara_desa || '-',
      pelaksana_kegiatan: pelaksana_kegiatan || '-',
      total_penerimaan: numTotalPenerimaan > 0 ? formatRp(numTotalPenerimaan) : '',
      tiotal_pph21: numTotalPph21 > 0 ? formatRp(numTotalPph21) : '',
      total_penerimaan_bersih: numTotalBersih > 0 ? formatRp(numTotalBersih) : '',
      penerima: penerima
    });

    const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    const fileName = `Daftar_Penerimaan_${Date.now()}.docx`;
    const outputDir = path.join(__dirname, 'public', 'arsip');
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, buf);
    
    res.json({ success: true, downloadUrl: `/arsip/${fileName}` });
  } catch (err) {
    console.error('Error cetak daftar penerimaan:', err);
    res.status(500).json({ success: false, message: 'Gagal membuat dokumen daftar penerimaan.', error: err.message });
  }
});

// Generic Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Terjadi kesalahan sistem di server.',
    error: err.message
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
