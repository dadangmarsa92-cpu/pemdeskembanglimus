
const initSqlJs = require('sql.js');
const fs = require('fs');

async function testDelete() {
  const SQL = await initSqlJs();
  const dbBuffer = fs.readFileSync('database.sqlite');
  const db = new SQL.Database(dbBuffer);
  
  const before = db.exec('SELECT count(*) FROM rab_sub_sub_bidang WHERE id = 219')[0].values[0][0];
  console.log('Before:', before); // should be 1
  
  db.run('DELETE FROM rab_sub_sub_bidang WHERE id = ?', ["219"]);
  
  const after = db.exec('SELECT count(*) FROM rab_sub_sub_bidang WHERE id = 219')[0].values[0][0];
  console.log('After string delete:', after); // should be 0 if it worked
}

testDelete();
