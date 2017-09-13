const mysql = require('promise-mysql')

function connectDatabase (conn, dbname) {
  return conn.query(`use ${dbname}`)
}

async function createConnection (configs) {
  var conn = await mysql.createConnection(configs)
  return conn
}

async function createDatabase (conn, dbname, charset, collate) {
  try {
    if (charset && collate) {
      var c = collate.split('_')
      if (c[0] !== charset) collate = undefined
    }
    var sql = `create database if not exists ${conn.escapeId(dbname)}`
    if (charset) {
      sql += ` character set ${charset}`
      if (collate) {
        sql += ` collate ${collate}`
      }
    } else {
      sql += ` character set utf8mb4 collate utf8mb4_unicode_ci`
    }
    await conn.query(sql)
  } catch (err) {
    return Promise.reject(err)
  }
}

async function getDatabaseData (conn) {
  try {
    var tables = await listTables(conn)
    var dpromises = tables.map((table) => {
      return getTableData(conn, table)
    })
    var datas = await Promise.all(dpromises)
    var returnVal = {}
    for (var i = 0; i < tables.length; i++) {
      returnVal[tables[i]] = datas[i]
    }
    return Promise.resolve(returnVal)
  } catch (err) {
    return Promise.reject(new Error('获取数据失败'))
  }
}

async function getDatabaseCharset (conn, dbname) {
  try {
    var results = await conn.query(`show create database ${conn.escapeId(dbname)}`)
    var createDb = results[0]['Create Database']
    var reg = /CHARACTER SET\s(\w+)\sCOLLATE\s(\w+)/
    var res = reg.exec(createDb)
    if (res) {
      return Promise.resolve({ charset: res[1], collate: res[2] })
    }
    reg = /CHARACTER SET\s+(\w+)/
    res = reg.exec(createDb)
    if (res) {
      return Promise.resolve({ charset: res[1] })
    }
    return Promise.resolve({})
  } catch (err) {
    return Promise.reject(new Error('获取字符集失败'))
  }
}

async function getDatabaseStruct (conn, dbname) {
  try {
    var returnVal = {}
    var tableNames = await listTables(conn)
    var tpromises = tableNames.map((tname) => {
      return getTableStruct(conn, tname)
    })
    var tstructs = await Promise.all(tpromises)
    var tables = []
    for (var i = 0; i < tableNames.length; i++) {
      tables.push({ [tableNames[i]]: tstructs[i] })
    }
    returnVal.tables = tables
    var charsets = await getDatabaseCharset(conn, dbname)
    Object.assign(returnVal, charsets)
    return Promise.resolve(returnVal)
  } catch (err) {
    return Promise.reject(err)
  }
}

function getForeignKeys (createTb) {
  var reg = /FOREIGN KEY \(([`\w]+?)\) REFERENCES ([`\w]+?) \(([`\w]+)\) ON DELETE ([`\w]+\s*?[`\w]*?) ON UPDATE ([`\w]+\s*?[`\w]*?)/mg
  var matches = createTb.match(reg)
  if (!matches) return []
  var res = matches.map((mat) => {
    var r = reg.exec(mat)
    var k = {
      col: r[1],
      ftable: r[2],
      fcol: r[3],
      delete: r[4],
      update: r[5]
    }
    for (var i in k) {
      if (k[i].startsWith('`')) k[i] = k[i].slice(1)
      if (k[i].endsWith('`')) k[i] = k[i].slice(0, k[i].length - 1)
    }
    return k
  })
  return res
}

function _getTableStruct (data) {
  var st = { rows: [], keys: {} }
  data.forEach((r) => {
    if (!r) return
    var id = r.Field
    var descp = {}
    descp.type = r.Type
    if (r.Null.toLowerCase() === 'no') descp['null'] = false
    if (r.Default) descp.default = r.Default
    if (r.Key) {
      var key = ''
      switch (r.Key) {
        case 'UNI':
          key = 'unique'
          break
        case 'PRI':
          key = 'primary'
          break
        default:
          break
      }
      if (key) { st.keys[key] ? (st.keys[key].push(id)) : (st.keys[key] = [id]) }
    }
    var extra = r.Extra.toLowerCase()
    if (extra.includes('auto_increment')) {
      descp.auto_increment = true
    }
    st.rows.push({ [id]: descp })
  })
  return st
}

function getTableCharset (createTb) {
  var reg = /CHARSET=(\w+)\s+COLLATE=(\w+)\s*$/m
  var res = reg.exec(createTb)
  if (res) {
    return { charset: res[1], collate: res[2] }
  }
  reg = /CHARSET=(\w+)\s*$/m
  res = reg.exec(createTb)
  if (res) {
    return { charset: res[1] }
  }
  return {}
}

async function getTableData (conn, tablename) {
  try {
    var results = await conn.query(`select * from ${tablename}`)
    return Promise.resolve(Array.from(results))
  } catch (err) {
    return Promise.reject(err)
  }
}

async function getTableStruct (conn, tablename) {
  try {
    var results = await conn.query(`describe ${tablename}`)
    var struct = _getTableStruct(results)
    results = await conn.query(`show create table ${tablename}`)
    var createTb = results[0]['Create Table']
    var chars = getTableCharset(createTb)
    Object.assign(struct, chars)
    var fkeys = getForeignKeys(createTb)
    if (fkeys) {
      struct.keys.foreign = fkeys
    }
    return Promise.resolve(struct)
  } catch (err) {
    return Promise.reject(new Error(`获取表格 ${tablename} 结构失败`))
  }
}

async function listTables (conn) {
  try {
    var results = await conn.query('show tables')
    var tables = Array.from(results).map(r => r[Object.keys(r)[0]])
    return Promise.resolve(tables)
  } catch (err) {
    return Promise.reject(new Error('获取表格列表失败'))
  }
}

function truncate (conn, table) {
  return conn.query(`truncate ${table}`)
}

exports.connectDatabase = connectDatabase
exports.createConnection = createConnection
exports.createDatabase = createDatabase
exports.getDatabaseData = getDatabaseData
exports.getDatabaseStruct = getDatabaseStruct
exports.getTableData = getTableData
exports.getTableStruct = getTableStruct
exports.listTables = listTables
exports.truncate = truncate
