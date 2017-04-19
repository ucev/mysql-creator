const fs = require('fs');
const yaml = require('js-yaml');
const mysql = require('mysql');
const logger = require('./utils/logger');

function buildComponentCheckValid(str) {
  var re = /[^0-9a-zA-Z_\-\(\)\s]/;
  return !re.test(str);
}

function buildCreateTableSql(conn, table) {
  var tbname = Object.keys(table)[0];
  var sql = 'drop table if exists ' + conn.escapeId(tbname) + ';';
  sql = sql + ('create table ' + conn.escapeId(tbname) + '(');
  table[tbname].forEach((row) => {
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
    sql = (sql + parts.join(' ') + ',');
  });
  sql = sql.substr(0, sql.length - 1);
  sql = sql + ')';
  console.log(sql);
  return sql;
}

function connectDatabase(conn, dbname) {
  return new Promise((resolve, reject) => {
    conn.query('use ' + conn.escapeId(dbname), (err, results, fields) => {
      if (err) {
        reject();
      }
      resolve();
    })
  })
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

// no foreign key or other indexes
function createTable(conn, table) {
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
  })
}

function createFs(filename) {
  var struct = yaml.safeLoad(fs.readFileSync(filename, "utf8"));
  var { host, user, pass, dbname, tables } = struct;
  var conn = mysql.createConnection({ host: host, user: user, password: pass, multipleStatements: true });
  var p = createDatabase(conn, dbname);
  p.then((dt) => {
    return connectDatabase(conn, dbname);
  }).then(() => {
    var promises = tables.map((tb) => {
      return createTable(conn, tb);
    });
    return Promise.all(promises);
  }).then(() => {
    conn.end(() => { });
  }).catch((err) => {
    conn.end(() => { });
  })
}

module.exports = createFs;
