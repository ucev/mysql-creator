const fs = require('fs');
const yaml = require('js-yaml');
const mysql = require('./mysql_base');
const logger = require('./utils/logger');

const dumpDataToFile = require('./utils/base').dumpDataToFile;

var _dataStruct;
var _oldStruct;

function buildComponentCheckValid(str) {
  var re = /[^0-9a-zA-Z_\-\(\)\s]/;
  return !re.test(str);
}

function buildRowParts(conn, row) {
  var parts = [];
  var rowname = Object.keys(row)[0];
  parts.push(conn.escapeId(rowname));
  var descp = row[rowname];
  // keyword's type
  if (!('type' in descp)) {
    return false;
  }
  if (buildComponentCheckValid(descp.type)) {
    parts.push(descp.type);
  }
  // if is primary key
  if ('key' in descp && buildComponentCheckValid(descp.key)) {
    parts.push(descp.key);
  }
  // if is not null
  if ('null' in descp && descp.null === false) {
    parts.push("not null");
  }
  if ('default' in descp) {
    parts.push(`default ${conn.escape(descp.default)}`);
  }
  if (['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint'].indexOf(descp.type) != -1 && descp.auto_increment === true) {
    parts.push('auto_increment');
  }
  return parts;
}

function refactTableRows(conn, table) {
  var rows = [];
  var k;
  var tbname = Object.keys(table)[0];
  var ids = table[tbname].map(row => conn.escapeId(Object.keys(row)[0]));
  var _oldTable = _oldStruct[tbname];
  var oldTable = {};
  for (k in _oldTable) {
    oldTable[conn.escapeId(k)] = _oldTable[k];
  }
  var oldKeys = Object.keys(oldTable);
  for (k of oldKeys) {
    if (!ids.includes(k)) {
      rows.push(`alter table ${tbname} drop column ${k}`);
    }
  }
  table[tbname].forEach((row) => {
    var parts = buildRowParts(conn, row);
    var rowname = parts[0];
    // 如果当前的字段被设为 primary key, 删除已经存在的 primary key
    if (parts.includes("primary key")) {
      if (oldTable[rowname].key == "primary key") {
        var index = parts.indexOf("primary key");
        parts.splice(index, 1);
      } else {
        rows.push(`alter table ${tbname} drop primary key`);
      }
    }
    if (oldKeys.includes(rowname)) {
      rows.push(`alter table ${tbname} change column ${rowname} ${parts.join(' ')}`);
    } else {
      rows.push(`alter table ${tbname} add column ${parts.join(' ')}`);
    }
  })
  return rows;
}

function buildCreateTableSql(conn, table) {
  var tbname = Object.keys(table)[0];
  var sql = 'drop table if exists ' + conn.escapeId(tbname) + ';';
  sql = sql + ('create table ' + conn.escapeId(tbname) + '(');
  table[tbname].forEach((row) => {
    var parts = buildRowParts(conn, row);
    sql = (sql + parts.join(' ') + ',');
  });
  sql = sql.substr(0, sql.length - 1);
  sql = sql + ')';
  console.log(sql);
  return sql;
}

// no foreign key or other indexes
function createNewTable(conn, table) {
  return new Promise((resolve, reject) => {
    var sql = buildCreateTableSql(conn, table);
    var tbname = Object.keys(table)[0];
    if (!sql) {
      logger.error(`表${tbname} 配置错误`);
      reject();
    }
    conn.query(sql, (err, results, fields) => {
      if (err) {
        logger.error(`表 ${tbname} 创建失败`);
        reject();
      }
      logger.succ(`表 ${tbname} 创建成功`);
      resolve();
    })
  }).catch((e) => {
    console.log(e);
  })
}

function refactTable(conn, table) {
  var tbname = Object.keys(table)[0];
  var rows = refactTableRows(conn, table);
  var ps = rows.map((row) => {
    return new Promise((resolve, reject) => {
      conn.query(row, (err, results, fields) => {
        if (err) {
          reject(err);
        }
        resolve();
      })
    }).catch((e) => {
      console.log(e);
    })
  })
  return Promise.all(ps).then(() => {
    logger.succ(`表 ${tbname} 重构成功`);
  }, () => {
    logger.error(`表 ${tbname} 重构失败`);
  });
}

function createTable(conn, table) {
  var tbname = Object.keys(table)[0];
  if (tbname in _oldStruct) {
    return refactTable(conn, table);
  } else {
    return createNewTable(conn, table);
  }
}

function createDatabase(filename) {
  _dataStruct = yaml.safeLoad(fs.readFileSync(filename, "utf8"));
  _oldStruct = {};
  var { host, user, pass, dbname, tables } = _dataStruct;
  var conn = mysql.createConnection({ host: host, user: user, password: pass, multipleStatements: true });
  return mysql.beginTransaction(conn).then(() => {
    return mysql.createDatabase(conn, dbname);
  }).then((dt) => {
    return mysql.connectDatabase(conn, dbname);
  }).then(() => {
    return mysql.getDatabaseStruct(conn);
  }).then((structs) => {
    _oldStruct = structs;
    var promises = tables.map((tb) => {
      return createTable(conn, tb);
    });
    return Promise.all(promises);
  }).then(() => {
    return mysql.commit(conn).then(() => {
      conn.end(() => {})
    }).catch(() => {
      mysql.rollback(conn);
    })
  }).catch((err) => {
    conn.end(() => { });
  });
}

function exportStruct(filepath, host, user, password, database) {
  var conn = mysql.createConnection({host: host, user: user, password: password, database: database});
  return mysql.getDatabaseStruct(conn).then((struct) => {
    return dumpDataToFile(filepath, struct);
  }).then(() => {
    logger.succ("数据库导出成功");
    conn.end(() => {});
  }).catch((err) => {
    console.log(err);
    logger.error("数据库导出失败");
    conn.end(() => {});
  });
}

exports.createDatabase = createDatabase;
exports.exportStruct = exportStruct;
