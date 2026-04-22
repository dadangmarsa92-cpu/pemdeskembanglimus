const fs = require('fs');
const initSqlJs = require('./node_modules/sql.js');

async function checkDb() {
    const SQL = await initSqlJs();
    const dbData = fs.readFileSync('database.sqlite');
    const db = new SQL.Database(dbData);
    
    const res = db.exec("SELECT ss_code, ss_name, grand_total FROM rab_records LIMIT 10");
    console.log(JSON.stringify(res, null, 2));
}

checkDb();
