#!/usr/bin/env node
const minimist = require('minimist');

const createDatabase = require('../src/mysql-creator').importStruct;
const exportStruct = require('../src/mysql-creator').exportStruct;
const importData = require('../src/mysql-data').importData;
const exportData = require('../src/mysql-data').exportData;
const logger = require('../src/utils/logger');
const getpass = require('getpassword');

/**
 * @author <a href="mailto:zhangshuaiyf@icloud.com">ucev</a>
 * @fileoverview
 *   命令行参数说明
 *       d: database 名称
 *       e: 导出数据库结构到文件名
 *       h: host
 *       i: 导入数据所在的文件
 *       o: 导出数据到文件名
 *       p: password
 *       u: user
 *   如果不加附加参数，则第三个参数代表导入数据库结构所在的文件
 *   具体用法见 {@link https://www.npmjs.com/package/minimist }
 *
 */

const options = [
  "d",
  "e",
  "h",
  "i",
  "o",
  "p",
  "u"
];

var argv = process.argv;
if (argv.length <= 2) {
  logger.error('请输入数据库配置文件名');
  process.exit(1);
} else if (argv.length == 3) {
  createDatabase(argv[2]);
} else {
  var params = minimist(argv.slice(2));
  let { h: host, u: user, p: password, d: database, i: input, o: output, e: exportf } = params;
  if (!(host && user && database && (input || output || exportf))) {
    logger.error("参数错误");
    process.exit(1);
  }
  if (password === true) {
    getpass.getpass({ prompt: "请输入数据库密码：" }, (err, pass) => {
      password = pass;
      if (input) {
        importData(input, host, user, password, database);
      } else if (output) {
        exportData(output, host, user, password, database);
      } else if (exportf) {
        exportStruct(exportf, host, user, password, database);
      }
    })
  } else {
    if (input) {
      importData(input, host, user, password, database);
    } else if (output) {
      exportData(output, host, user, password, database);
    } else if (exportf) {
      exportStruct(exportf, host, user, password, database);
    }
  }
}
