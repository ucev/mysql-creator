const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const mysql = require('./mysql_base');
const logger = require('./utils/logger');

const dumpDataToFile = require('./utils/base').dumpDataToFile;

function importTableData(conn, tbname, data) {
  if (!data || data.length == 0) {
    return Promise.resolve();
  }
  return mysql.truncate(conn, tbname).then(() => {
    var tpromises = data.map((d) => {
      return new Promise((resolve, reject) => {
        conn.query(`insert into ${tbname} set ?`, d, (err, results, fields) => {
          if (err) {
            reject();
          }
          resolve();
        })
      })
    })
    return Promise.all(tpromises).catch(() => {
      return Promise.reject();
    })
  })
}

function exportData(destFile, host, user, pass, db) {
  var conn = mysql.createConnection({ host: host, user: user, password: pass, database: db, charset: "utf8mb4" });
  mysql.getDatabaseData(conn).then((datas) => {
    return dumpDataToFile(destFile, datas);
  }).then(() => {
    logger.succ("数据导出成功");
    conn.end(() => {});
  }).catch(() => {
    logger.error("数据导出失败");
    conn.end(() => { });
  })
}

function importData(srcFile, host, user, pass, db) {
  var conn = mysql.createConnection({ host: host, user: user, password: pass, database: db, charset: "utf8mb4" });
  var datas = yaml.safeLoad(fs.readFileSync(srcFile, "utf8"));
  mysql.beginTransaction(conn).then(() => {
    return mysql.listTables(conn)
  }).then((tables) => {
    var tpromises = tables.map((table) => {
      return importTableData(conn, table, datas[table]);
    })
    return Promise.all(tpromises);
  }).then(() => {
    return mysql.commit(conn);
  }).then(() => {
    logger.succ("数据导入成功");
    conn.end(() => { });
  }).catch(() => {
    logger.error("数据导入失败");
    mysql.rollback(() => {
      conn.end();
    })
  })
}

exports.exportData = exportData;
exports.importData = importData;
