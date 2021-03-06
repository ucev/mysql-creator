const fs = require('fs')
const yaml = require('js-yaml')
const mysql = require('./mysql-base')
const logger = require('./utils/logger')

const dumpDataToFile = require('./utils/base').dumpDataToFile

async function importTableData (conn, tbname, data) {
  if (!data || data.length === 0) {
    return Promise.resolve()
  }
  try {
    await mysql.truncate(conn, tbname)
    var tpromises = data.map((d) => {
      return conn.query(`insert into ${tbname} set ?`, d)
    })
    return Promise.all(tpromises)
  } catch (err) {
    return Promise.reject(err)
  }
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
      conn.end()
    }
  }
}

async function importData (srcFile, host, user, pass, db) {
  var datas = yaml.safeLoad(fs.readFileSync(srcFile, 'utf8'))
  var conn
  try {
    conn = await mysql.createConnection({ host: host, user: user, password: pass, database: db, charset: 'utf8mb4' })
    await conn.beginTransaction()
    var tables = await mysql.listTables(conn)
    var tpromises = tables.map((tb) => {
      return importTableData(conn, tb, datas[tb])
    })
    await Promise.all(tpromises)
    await conn.commit()
    logger.succ('数据导入成功')
  } catch (err) {
    logger.error(err.message)
    console.log(err)
    if (conn) {
      await conn.rollback()
    }
  } finally {
    conn.end()
  }
}

exports.exportData = exportData
exports.importData = importData
