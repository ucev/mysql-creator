const mysql = require('mysql')

function beginTransaction (conn) {
  return new Promise((resolve, reject) => {
    conn.beginTransaction((err) => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

function close (conn) {
  conn.end(() => { })
}

function commit (conn) {
  return new Promise((resolve, reject) => {
    conn.commit((err) => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

function connectDatabase (conn, dbname) {
  return new Promise((resolve, reject) => {
    conn.query(`use ${dbname}`, (err, results, fields) => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

function createConnection (configs) {
  return new Promise((resolve, reject) => {
    var conn = mysql.createConnection(configs)
    conn.connect((err) => {
      if (err) {
        reject(new Error('无法连接到数据库'))
      }
      resolve(conn)
    })
  })
}

function createDatabase (conn, dbname, charset, collate) {
  return new Promise((resolve, reject) => {
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
    conn.query(sql, (err, results, fields) => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

function getDatabaseData (conn) {
  return listTables(conn).then((tables) => {
    var dpromises = tables.map((table) => {
      return getTableData(conn, table)
    })
    return Promise.all(dpromises).then((datas) => {
      var returnVal = {}
      for (var i = 0; i < tables.length; i++) {
        returnVal[tables[i]] = datas[i]
      }
      return Promise.resolve(returnVal)
    }).catch(() => {
      return Promise.reject(new Error('获取数据失败'))
    })
  })
}

function getDatabaseCharset (conn, dbname) {
  return new Promise((resolve, reject) => {
    conn.query(`show create database ${conn.escapeId(dbname)}`, (err, results, fields) => {
      if (err) {
        reject(err)
      }
      var createDb = results[0]['Create Database']
      var reg = /CHARACTER SET\s(\w+)\sCOLLATE\s(\w+)/
      var res = reg.exec(createDb)
      if (res) {
        resolve({ charset: res[1], collate: res[2] })
      }
      reg = /CHARACTER SET\s+(\w+)/
      res = reg.exec(createDb)
      if (res) {
        resolve({ charset: res[1] })
      }
      resolve({})
    })
  })
}

function getDatabaseStruct (conn, dbname) {
  var returnVal = {}
  return listTables(conn).then((tbs) => {
    var tpromises = tbs.map((tname) => {
      return getTableStruct(conn, tname)
    })
    return Promise.all(tpromises).then((tstructs) => {
      var tables = []
      for (var i = 0; i < tbs.length; i++) {
        tables.push({ [tbs[i]]: tstructs[i] })
      }
      return Promise.resolve(tables)
    }).catch(() => { })
  }).then((structs) => {
    returnVal.tables = structs
    return getDatabaseCharset(conn, dbname)
  }).then((data) => {
    return Promise.resolve(Object.assign(returnVal, data))
  }).catch(() => { })
}

function getForeignKeys (createTb) {
  var reg = /FOREIGN KEY \(([`\w]+?)\) REFERENCES ([`\w]+?) \(([`\w]+)\) ON DELETE ([`\w]+\s*?[`\w]*?) ON UPDATE ([`\w]+\s*?[`\w]*?)/mg
  var matches = createTb.match(reg)
  if (!matches) return []
  var res = matches.map((mat) => {
    var r = reg.exec(mat)
    return {
      col: r[1],
      ftable: r[2],
      fcol: r[3],
      delete: r[4],
      update: r[5]
    }
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

function getTableData (conn, tablename) {
  return new Promise((resolve, reject) => {
    conn.query(`select * from ${tablename}`, (err, results, fields) => {
      if (err) {
        reject(err)
      }
      resolve(Array.from(results))
    })
  })
}

function getTableStruct (conn, tablename) {
  return new Promise((resolve, reject) => {
    conn.query(`describe ${tablename}`, (err, results, fields) => {
      if (err) {
        reject(err)
      }
      var struct = _getTableStruct(results)
      resolve(struct)
    })
  }).then((struct) => {
    return new Promise((resolve, reject) => {
      conn.query(`show create table ${tablename}`, (err, results, fields) => {
        if (err) {
          reject(err)
        }
        var createTb = results[0]['Create Table']
        var chars = getTableCharset(createTb)
        Object.assign(struct, chars)
        var fkeys = getForeignKeys(createTb)
        if (fkeys) {
          struct.keys.foreign = fkeys
        }
        resolve(struct)
      })
    })
  }).catch(() => { })
}

function listTables (conn) {
  return new Promise((resolve, reject) => {
    conn.query('show tables', (err, results, fields) => {
      if (err) {
        reject(err)
      }
      if (results.length === 0) {
        resolve([])
      }
      var fname = fields[0].name
      var tables = results.map(r => r[fname])
      resolve(tables)
    })
  })
}

function rollback (conn) {
  return new Promise((resolve, reject) => {
    conn.rollback(() => {
      resolve()
    })
  })
}

function truncate (conn, table) {
  return new Promise((resolve, reject) => {
    conn.query(`truncate ${table}`, (err, results, fields) => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

exports.beginTransaction = beginTransaction
exports.close = close
exports.commit = commit
exports.connectDatabase = connectDatabase
exports.createConnection = createConnection
exports.createDatabase = createDatabase
exports.getDatabaseData = getDatabaseData
exports.getDatabaseStruct = getDatabaseStruct
exports.getTableData = getTableData
exports.getTableStruct = getTableStruct
exports.listTables = listTables
exports.rollback = rollback
exports.truncate = truncate
