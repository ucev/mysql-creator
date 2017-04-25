const mysql = require('mysql');

function beginTransaction(conn) {
  return new Promise((resolve, reject) => {
    conn.beginTransaction((err) => {
      if (err) {
        reject();
      }
      resolve();
    })
  })
}

function commit(conn) {
  return new Promise((resolve, reject) => {
    conn.commit((err) => {
      if (err) {
        reject();
      }
      resolve();
    })
  })
}

function connectDatabase(conn, dbname) {
  return new Promise((resolve, reject) => {
    conn.query(`use ${dbname}`, (err, results, fields) => {
      if (err) {
        reject();
      }
      resolve();
    })
  })
}

function createConnection(configs) {
  var conn = mysql.createConnection(configs);
  return conn;
}

function createDatabase(conn, dbname) {
  return new Promise((resolve, reject) => {
    conn.query('create database if not exists ' + conn.escapeId(dbname) + ' character set utf8mb4 collate utf8mb4_unicode_ci', (err, results, fields) => {
      if (err) {
        reject();
      }
      resolve();
    })
  })
}

function getDatabaseData(conn) {
  var datas = {};
  return listTables(conn).then((tables) => {
    var dpromises = tables.map((table) => {
      return getTableData(conn, table).then((data) => {
        datas[table] = data;
      }).catch(() => {
      });
    });
    return Promise.all(dpromises).then(() => {
      return Promise.resolve(datas);
    }).catch(() => {
      return Promise.reject();
    })
  })
}

function getDatabaseStruct(conn) {
  var structs = {};
  return listTables(conn).then((tables) => {
    var tpromises = tables.map((tname) => {
      return getTableStruct(conn, tname, structs).then((struct) => {
        structs[tname] = struct;
      }).catch(() => {

      })
    })
    return Promise.all(tpromises).then(() => {
      return Promise.resolve(structs);
    })
  }).catch(() => {
  })
}

function _getTableStruct(data) {
  var st = {};
  data.forEach((r) => {
    var id = r.Field;
    var descp = {};
    descp = {
      type: r.Type,
      null: r.Null != 'NO',
      default: r.Default
    }
    if (r.Key) {
      var key = "";
      switch (r.Key) {
        case "UNI":
          key = "unique";
          break;
        case "PRI":
          key = "primary key";
          break;
        default:
          key = "";
          break;
      }
      descp.key = key;
    }
    var extra = r.Extra.toLowerCase();
    if (extra.includes("auto_increment")) {
      descp.auto_increment = true;
    }
    st[id] = descp;
  })
  return st;
}

function getTableData(conn, tablename) {
  return new Promise((resolve, reject) => {
    conn.query(`select * from ${tablename}`, (err, results, fields) => {
      if (err) {
        reject();
      }
      resolve(Array.from(results));
    })
  })
}

function getTableStruct(conn, tablename) {
  return new Promise((resolve, reject) => {
    conn.query(`describe ${tablename}`, (err, results, fields) => {
      if (err) {
        console.log(err);
        reject();
      }
      var struct = _getTableStruct(results);
      resolve(struct);
    })
  })
}

function listTables(conn) {
  return new Promise((resolve, reject) => {
    conn.query('show tables', (err, results, fields) => {
      if (err) {
        reject();
      }
      var fname = fields[0].name;
      var tables = results.map(r => r[fname]);
      resolve(tables);
    })
  })
}

function rollback(conn) {
  return new Promise((resolve, reject) => {
    conn.rollback(() => {
      resolve();
    })
  })
}

function truncate(conn, table) {
  return new Promise((resolve, reject) => {
    conn.query(`truncate ${table}`, (err, results, fields) => {
      if (err) {
        reject();
      }
      resolve();
    })
  })
}

exports.beginTransaction = beginTransaction;
exports.commit = commit;
exports.connectDatabase = connectDatabase;
exports.createConnection = createConnection;
exports.createDatabase = createDatabase;
exports.getDatabaseData = getDatabaseData;
exports.getDatabaseStruct = getDatabaseStruct;
exports.getTableData = getTableData;
exports.getTableStruct = getTableStruct;
exports.listTables = listTables;
exports.rollback = rollback;
exports.truncate = truncate;
