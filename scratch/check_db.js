
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function checkDb() {
  try {
    const SQL = await initSqlJs();
    const dbBuffer = fs.readFileSync('database.sqlite');
    const db = new SQL.Database(dbBuffer);
    
    console.log('--- BIDANG ---');
    const bidang = db.exec('SELECT * FROM rab_bidang');
    console.log(JSON.stringify(bidang, null, 2));
    
    console.log('--- SUB BIDANG ---');
    const sub = db.exec('SELECT * FROM rab_sub_bidang');
    console.log(JSON.stringify(sub, null, 2));
    
    console.log('--- SUB SUB BIDANG (10) ---');
    const ss = db.exec("SELECT * FROM rab_sub_sub_bidang WHERE no = '10' OR no LIKE '%10%'");
    console.log(JSON.stringify(ss, null, 2));

    console.log('--- ALL SUB SUB BIDANG ---');
    const allSs = db.exec("SELECT * FROM rab_sub_sub_bidang");
    console.log(JSON.stringify(allSs, null, 2));
  } catch (err) {
    console.error(err);
  }
}

checkDb();
