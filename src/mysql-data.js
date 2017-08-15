const fs = require('fs')
const yaml = require('js-yaml')
const mysql = require('./mysql-base')
const logger = require('./utils/logger')

const dumpDataToFile = require('./utils/base').dumpDataToFile

function importTableData (conn, tbname, data) {
  if (!data || data.length === 0) {
    return Promise.resolve()
  }
  return mysql.truncate(conn, tbname).then(() => {
    var tpromises = data.map((d) => {
      return new Promise((resolve, reject) => {
        conn.query(`insert into ${tbname} set ?`, d, (err, results, fields) => {
          if (err) {
            reject(err)
          }
          resolve()
        })
      })
    })
    return Promise.all(tpromises).catch((err) => {
      return Promise.reject(err)
    })
  })
}

function exportData (destFile, host, user, pass, db) {
  var conn
  return mysql.createConnection({ host: host, user: user, password: pass, database: db, charset: 'utf8mb4' }).then((_conn) => {
    conn = _conn
    return mysql.getDatabaseData(conn)
  }).then((datas) => {
    return dumpDataToFile(destFile, datas)
  }).then(() => {
    logger.succ('数据导出成功')
    mysql.close(conn)
  }).catch((err) => {
    console.log(err)
    logger.error('数据导出失败')
    if (conn) { mysql.close(conn) }
  })
}

function importData (srcFile, host, user, pass, db) {
  var datas = yaml.safeLoad(fs.readFileSync(srcFile, 'utf8'))
  var conn
  mysql.createConnection({ host: host, user: user, password: pass, database: db, charset: 'utf8mb4' }).then((_conn) => {
    conn = _conn
    return mysql.beginTransaction(conn)
  }).then(() => {
    return mysql.listTables(conn)
  }).then((tables) => {
    var tpromises = tables.map((table) => {
      return importTableData(conn, table, datas[table])
    })
    return Promise.all(tpromises)
  }).then(() => {
    return mysql.commit(conn)
  }).then(() => {
    logger.succ('数据导入成功')
    mysql.close(conn)
  }).catch((err) => {
    if (typeof err === 'object') {
      console.log(err.message)
    } else {
      logger.error('数据导入失败')
    }
    if (conn) {
      mysql.rollback(conn).then(() => {
        mysql.close(conn)
      }).catch(() => {
        mysql.close(conn)
      })
    }
  })
}

exports.exportData = exportData
exports.importData = importData
