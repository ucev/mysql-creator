const fs = require('fs')
const yaml = require('js-yaml')
const mysql = require('./mysql-base')
const logger = require('./utils/logger')

const dumpDataToFile = require('./utils/base').dumpDataToFile

var _dataStruct
var _oldStruct

function buildCreateTableSql (conn, tbname, tbstruct) {
  var sql = 'drop table if exists ' + conn.escapeId(tbname) + ';'
  sql = sql + 'create table ' + conn.escapeId(tbname) + '('
  tbstruct.rows.forEach((row) => {
    var parts = buildRowParts(conn, row)
    sql = (sql + parts.join(' ') + ', ')
  })
  if (tbstruct.keys) {
    var keys = Object.keys(tbstruct.keys)
    keys.forEach((key) => {
      var keyparts = buildKeyParts(conn, key, tbstruct.keys[key])
      keyparts = keyparts.join(', ')
      if (keyparts.trim()) { sql = (sql + keyparts + ', ') }
    })
  }
  sql = sql.substr(0, sql.length - 2)
  sql = sql + ')'
  if (tbstruct.charset) {
    sql += ` character set ${tbstruct.charset}`
  }
  if (tbstruct.collate) {
    sql += ` collate ${tbstruct.collate}`
  }
  console.log(sql)
  return sql
}

function buildKeyField (conn, key, field) {
  switch (key) {
    case 'foreign':
      var f = `CONSTRAINT ${conn.escapeId(field.col)} FOREIGN KEY (${conn.escapeId(field.col)}) references ${conn.escapeId(field.ftable)} (${conn.escapeId(field.fcol)})`
      if (field.delete) { f += ` ON DELETE ${field.delete}` }
      if (field.update) { f += ` ON UPDATE ${field.update}` }
      return f
    case 'primary':
      field = conn.escapeId(field)
      return `PRIMARY KEY (${field})`
    case 'unique':
      field = conn.escapeId(field)
      return `UNIQUE KEY ${field} (${field})`
    default:
      return ''
  }
}

function buildKeyParts (conn, key, keystruct) {
  var parts = []
  switch (key) {
    case 'foreign':
      keystruct.forEach((field) => {
        if (field) { parts.push(buildKeyField(conn, key, field)) }
      })
      break
    case 'primary':
      if (keystruct instanceof Array) keystruct = keystruct[0]
      parts.push(buildKeyField(conn, key, keystruct))
      break
    case 'unique':
      if (typeof keystruct === 'string') {
        parts.push(buildKeyField(conn, key, keystruct))
      } else if (keystruct instanceof Array) {
        keystruct.forEach((field) => {
          if (field) { parts.push(buildKeyField(conn, key, field)) }
        })
      }
      break
    default:
      break
  }
  return parts
}

function buildRowParts (conn, row) {
  var parts = []
  var rowname = Object.keys(row)[0]
  parts.push(conn.escapeId(rowname))
  var descp = row[rowname]
  // keyword's type
  if (!('type' in descp)) {
    return false
  }/*
  if (buildComponentCheckValid(descp.type)) {
    parts.push(descp.type);
  } */
  parts.push(descp.type)
  // if is not null
  if ('null' in descp && descp.null === false) {
    parts.push('not null')
  }
  if ('default' in descp) {
    parts.push(`default ${conn.escape(descp.default)}`)
  }
  // if (['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'].indexOf(descp.type) !== -1 && descp.auto_increment === true) {
  if (descp.type.indexOf('int') !== -1 && descp.auto_increment === true) {
    parts.push('auto_increment')
  }
  return parts
}

function changeDatabaseCharset (conn, dbname, newCharset, newCollate, oldCharset, oldCollate) {
  if ((!newCharset || newCharset === oldCharset) && (!newCollate && newCollate === oldCollate)) {
    return Promise.resolve()
  }
  return conn.query(`alter database ${conn.escapeId(dbname)} character set ${conn.escapeId(newCharset)} collate ${conn.escapeId(newCollate)}`)
}

// no foreign key or other indexes
function createNewTable (conn, tbname, tbstruct) {
  return new Promise((resolve, reject) => {
    var sql = buildCreateTableSql(conn, tbname, tbstruct)
    if (!sql) {
      reject(new Error(`表${tbname} 配置错误`))
    }
    conn.query(sql, (err, results, fields) => {
      if (err) {
        reject(new Error(`表 ${tbname} 创建失败`))
      }
      resolve(`表 ${tbname} 创建成功`)
    })
  })
}

function createTable (conn, table) {
  var tbname = Object.keys(table)[0]
  var tbstruct = table[tbname]
  // here to be modified
  var oldTables = _oldStruct.map((tb) => {
    return Object.keys(tb)[0]
  })
  if (oldTables.includes(tbname)) {
    return refactTable(conn, tbname, tbstruct)
  } else {
    return createNewTable(conn, tbname, tbstruct)
  }
}

function dropKeyField (conn, key, field) {
  switch (key) {
    case 'foreign':
      return `drop FOREIGN KEY ${field}, drop KEY ${field}`
    case 'primary':
      return 'drop PRIMARY KEY'
    case 'unique':
    default:
      field = conn.escapeId(field)
      return `drop index ${field}`
  }
}

function refactKeys (conn, key, newKeys, oldKeys) {
  newKeys = newKeys instanceof Array ? newKeys : newKeys ? [newKeys] : []
  oldKeys = oldKeys instanceof Array ? oldKeys : oldKeys ? [oldKeys] : []
  var k
  var keyparts = []
  switch (key) {
    case 'foreign':
      var oldFKeys = {}
      var newFKeys = {}
      newKeys.forEach((k) => {
        newFKeys[conn.escapeId(k.col)] = k
      })
      oldKeys.forEach((k) => {
        oldFKeys[k.col] = k
      })
      var newFks = Object.keys(newFKeys)
      var oldFks = Object.keys(oldFKeys)
      for (k of oldFks) {
        if (k && !newFks.includes(k)) {
          keyparts.push(dropKeyField(conn, key, k))
        }
      }
      for (k of newFks) {
        var nk = newFKeys[k]
        var ok = oldFKeys[k]
        if (nk && !ok) {
          keyparts.push('ADD ' + buildKeyField(conn, key, nk))
          continue
        }
        var sameKey = true
        var keyTypes = new Set(Object.keys(nk).concat(Object.keys(ok)))
        for (var ktype of keyTypes) {
          if (['col', 'ftable', 'fcol'].includes(ktype)) {
            if (conn.escapeId(nk[ktype]) !== ok[ktype]) {
              sameKey = false
              break
            }
          } else if (nk[ktype] !== ok[ktype]) {
            sameKey = false
            break
          }
        }
        if (!sameKey) {
          keyparts.push(dropKeyField(conn, key, k))
          keyparts.push('ADD ' + buildKeyField(conn, key, nk))
        }
      }
      break
    case 'primary':
    case 'unique':
    default:
      for (k of oldKeys) {
        if (k && !newKeys.includes(k)) {
          keyparts.push(dropKeyField(conn, key, k))
        }
      }
      for (k of newKeys) {
        if (k && !oldKeys.includes(k)) {
          keyparts.push('ADD ' + buildKeyField(conn, key, k))
        }
      }
      break
  }
  return keyparts
}

function refactTable (conn, tbname, tbstruct) {
  var rows = refactTableRows(conn, tbname, tbstruct)
  var ps = rows.map((row) => {
    return conn.query(row)
  })
  return Promise.all(ps).then(() => {
    return Promise.resolve(`表 ${tbname} 重构成功`)
  }, () => {
    return Promise.reject(new Error(`表 ${tbname} 重构失败`))
  })
}

function refactTableRows (conn, tbname, tbstruct) {
  var rows = []
  var row
  var k
  var table
  var ids = tbstruct.rows.map(row => Object.keys(row)[0])
  var _oldTable
  for (table of _oldStruct) {
    k = Object.keys(table)[0]
    if (k === tbname) {
      _oldTable = table[k]
      break
    }
  }
  //
  if (!_oldTable) return []
  var oldRows = {}
  for (row of _oldTable.rows) {
    var key = Object.keys(row)[0]
    oldRows[key] = row[key]
  }
  var oldKeys = Object.keys(oldRows)
  // 删除不存在的字段
  for (k of oldKeys) {
    if (!ids.includes(k)) {
      rows.push(`alter table ${tbname} drop column ${conn.escapeId(k)}`)
    }
  }
  tbstruct.rows.forEach((row) => {
    var id = Object.keys(row)[0]
    var parts = buildRowParts(conn, row)
    var rowname = parts[0]
    if (oldKeys.includes(id)) {
      if (!sameRow(row[id], oldRows[id])) { rows.push(`alter table ${tbname} change column ${rowname} ${parts.join(' ')}`) }
    } else {
      rows.push(`alter table ${tbname} add column ${parts.join(' ')}`)
    }
  })
  // keys
  var keyparts = []
  var keyTypes = ['foreign', 'primary', 'unique']
  keyTypes.forEach((key) => {
    keyparts = keyparts.concat(refactKeys(conn, key, tbstruct.keys ? tbstruct.keys[key] : [], _oldTable.keys ? _oldTable.keys[key] : []))
  })
  keyparts.forEach((p) => {
    if (p) {
      rows.push(`alter table ${tbname} ${p}`)
    }
  })
  // charset
  if ((tbstruct.charset && tbstruct.charset !== _oldTable.charset) && (tbstruct.collate && tbstruct.collate !== _oldTable.collate)) {
    var charset = tbstruct.charset || _oldTable.charset
    var collate = tbstruct.collate || _oldTable.collate
    rows.push(`alter table ${tbname} character set ${charset} collate ${collate}`)
  }
  return rows
}

function sameRow (newRow, oldRow) {
  var sameValueArr = {
    tinyint: ['tinyint', 'tinyint(4)'],
    smallint: ['smallint', 'smallint(6)'],
    mediumint: ['mediumint', 'mediumint(9)'],
    int: ['int', 'int(11)'],
    bigint: ['bigint', 'bigint(20)']
  }
  var newKeys = Object.keys(newRow)
  var oldKeys = Object.keys(oldRow)
  var keys = newKeys
  var k
  for (k of oldKeys) {
    if (!keys.includes(k)) {
      keys.push(k)
    }
  }
  for (k of keys) {
    // int/int(11)...
    if (k === 'type' && newRow[k].indexOf('int') !== -1) {
      var ck = oldRow[k]
      ck = ck.slice(0, ck.indexOf('('))
      if (sameValueArr[ck] && sameValueArr[ck].includes(oldRow[k]) && sameValueArr[ck].includes(newRow[k])) {
        continue
      }
    }
    if ((newRow[k] && oldRow[k]) && newRow[k] !== oldRow[k]) {
      return false
    }
  }
  return true
}

async function exportStruct (filepath, host, user, password, database) {
  var conn
  try {
    conn = await mysql.createConnection({ host: host, user: user, password: password, database: database })
    var struct = await mysql.getDatabaseStruct(conn, database)
    struct = Object.assign({
      host: '',
      user: '',
      pass: '',
      dbname: database
    }, struct)
    await dumpDataToFile(filepath, struct)
    logger.succ('数据库导出成功')
  } catch (err) {
    console.log(err)
    logger.error('数据库导出失败')
  } finally {
    if (conn) {
      conn.end()
    }
  }
}

async function importStruct (filename) {
  try {
    _dataStruct = yaml.safeLoad(fs.readFileSync(filename, 'utf8'))
    var { host, user, pass, dbname, charset, collate, tables } = _dataStruct
    var conn = await mysql.createConnection({ host: host, user: user, password: pass, multipleStatements: true })
    await conn.beginTransaction()
    await mysql.createDatabase(conn, dbname, charset, collate)
    await mysql.connectDatabase(conn, dbname)
    var structs = await mysql.getDatabaseStruct(conn, dbname)
    _oldStruct = structs.tables
    await changeDatabaseCharset(conn, dbname, charset, collate, structs.charset, structs.collate)
    var promises = tables.map((tb) => {
      return createTable(conn, tb)
    })
    await Promise.all(promises).then((infos) => {
      infos.forEach((info) => {
        logger.succ(info)
      })
    }).catch((err) => {
      console.log(err)
      logger.error(err.message)
    })
    await conn.commit()
  } catch (err) {
    console.log(err)
    if (conn) {
      try {
        await conn.rollback()
      } catch (err) {
        console.log(err)
      }
    }
  } finally {
    if (conn) {
      conn.end()
    }
  }
}

exports.importStruct = importStruct
exports.exportStruct = exportStruct
