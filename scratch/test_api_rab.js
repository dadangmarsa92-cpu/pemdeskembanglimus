
const initSqlJs = require('sql.js');
const fs = require('fs');

async function testApiRab() {
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync('database.sqlite');
  const db = new SQL.Database(dbBuffer);
  
  const ssResult = db.exec('SELECT * FROM rab_sub_sub_bidang WHERE sub_bidang_id = 9');
  console.log(JSON.stringify(ssResult, null, 2));
}

testApiRab();
