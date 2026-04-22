const fs = require('fs');
const initSqlJs = require('./node_modules/sql.js');

async function migrateDb() {
    const SQL = await initSqlJs();
    const dbData = fs.readFileSync('database.sqlite');
    const db = new SQL.Database(dbData);
    
    // 1. Update ss_code to have leading zero if it starts with a single digit and a dot
    // Example: "1.01.01" -> "01.01.01"
    db.run("UPDATE rab_records SET ss_code = '0' || ss_code WHERE ss_code LIKE '_.%.%'");
    
    // 2. Verify
    const res = db.exec("SELECT ss_code, ss_name FROM rab_records LIMIT 5");
    console.log('Migrated Data:', JSON.stringify(res, null, 2));
    
    // 3. Save back
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync('database.sqlite', buffer);
    console.log('Database migrated successfully.');
}

migrateDb();
