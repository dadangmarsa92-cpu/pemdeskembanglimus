const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const bidangPath = path.join(__dirname, 'templates', 'daftar_bidang.xlsx');
const subSubPath = path.join(__dirname, 'templates', 'daftar_sub__sub_bidang.xlsx');

async function migrate() {
    const SQL = await initSqlJs();
    if (!fs.existsSync(DB_PATH)) {
        console.error('Database file not found. Run the server first to initialize.');
        return;
    }
    const fileBuffer = fs.readFileSync(DB_PATH);
    const db = new SQL.Database(fileBuffer);

    console.log('--- MIGRATION START ---');

    // 1. Create tables if not exist
    db.run(`CREATE TABLE IF NOT EXISTS rab_bidang (id INTEGER PRIMARY KEY AUTOINCREMENT, no TEXT, nama_bidang TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS rab_sub_bidang (id INTEGER PRIMARY KEY AUTOINCREMENT, bidang_id INTEGER, no TEXT, nama_sub_bidang TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS rab_sub_sub_bidang (id INTEGER PRIMARY KEY AUTOINCREMENT, sub_bidang_id INTEGER, no TEXT, nama_ss_bidang TEXT)`);

    // 2. Clear existing data
    db.run('DELETE FROM rab_bidang');
    db.run('DELETE FROM rab_sub_bidang');
    db.run('DELETE FROM rab_sub_sub_bidang');

    // 2. Load Bidang
    let bidangMap = {}; // name -> db_id
    if (fs.existsSync(bidangPath)) {
        console.log('Reading bidang...');
        const wb = XLSX.readFile(bidangPath);
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        rows.forEach((r, idx) => {
            if (r[1]) {
                db.run('INSERT INTO rab_bidang (no, nama_bidang) VALUES (?, ?)', [r[0], r[1]]);
                const lastId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
                bidangMap[r[1]] = lastId;
                console.log(`  Added Bidang: ${r[1]} (ID: ${lastId})`);
            }
        });
    }

    // 3. Load Sub & Sub-Sub Bidang
    if (fs.existsSync(subSubPath)) {
        console.log('Reading sub & sub-sub bidang...');
        const wb = XLSX.readFile(subSubPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length >= 2) {
            const bidangHeaders = rows[0];
            const subBidangHeaders = rows[1];

            let subBidangMap = {}; // bidang_id:sub_name -> db_id

            bidangHeaders.forEach((bidangName, colIndex) => {
                if (!bidangName) return;
                const bId = bidangMap[bidangName];
                if (!bId) {
                    console.warn(`    Warning: Bidang "${bidangName}" not found in mapping.`);
                    return;
                }

                const subBidangName = subBidangHeaders[colIndex];
                if (!subBidangName) return;

                const sbKey = `${bId}:${subBidangName}`;
                let sbId = subBidangMap[sbKey];
                if (!sbId) {
                    // Try to extract code from name if exists, e.g. "01.01 Penyediaan..."
                    const match = subBidangName.match(/^([\d\.]+)\s+(.+)$/);
                    let code = '';
                    let cleanName = subBidangName;
                    if (match) {
                        code = match[1];
                        cleanName = match[2];
                    }

                    db.run('INSERT INTO rab_sub_bidang (bidang_id, no, nama_sub_bidang) VALUES (?, ?, ?)', [bId, code, cleanName]);
                    sbId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
                    subBidangMap[sbKey] = sbId;
                    console.log(`    Added Sub Bidang: ${subBidangName} (ID: ${sbId})`);
                }

                // Sub-sub bidang
                for (let i = 2; i < rows.length; i++) {
                    const ssName = rows[i][colIndex];
                    if (ssName) {
                        const match = ssName.match(/^([\d\.]+)\s+(.+)$/);
                        let code = '';
                        let cleanName = ssName;
                        if (match) {
                            code = match[1];
                            cleanName = match[2];
                        }
                        db.run('INSERT INTO rab_sub_sub_bidang (sub_bidang_id, no, nama_ss_bidang) VALUES (?, ?, ?)', [sbId, code, cleanName]);
                    }
                }
            });
        }
    }

    console.log('--- MIGRATION COMPLETE ---');
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log('Database updated.');
}

migrate().catch(console.error);
