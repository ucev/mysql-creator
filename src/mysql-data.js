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
    return Promise.all(tpromises)
  })
}

async function exportData (destFile, host, user, pass, db) {
  var conn
  try {
    conn = await mysql.createConnection({ host: host, user: user, password: pass, database: db, charset: 'utf8mb4' })
    var datas = await mysql.getDatabaseData(conn)
    await dumpDataToFile(destFile, datas)
    logger.succ('数据导出成功')
  } catch (err) {
    logger.error('数据导出失败')
    console.log(err)
  } finally {
    if (conn) {
      mysql.close(conn)
    }
  }
}

async function importData (srcFile, host, user, pass, db) {
  var datas = yaml.safeLoad(fs.readFileSync(srcFile, 'utf8'))
  var conn
  try {
    conn = await mysql.createConnection({ host: host, user: user, password: pass, database: db, charset: 'utf8mb4' })
    await mysql.beginTransaction(conn)
    var tables = await mysql.listTables(conn)
    var tpromises = tables.map((tb) => {
      return importTableData(conn, tb, datas[tb])
    })
    await Promise.all(tpromises)
    await mysql.commit(conn)
    logger.succ('数据导入成功')
  } catch (err) {
    logger.error(err.message)
    console.log(err)
    if (conn) {
      await mysql.rollback(conn)
    }
  } finally {
    mysql.close(conn)
  }
}

exports.exportData = exportData
exports.importData = importData
