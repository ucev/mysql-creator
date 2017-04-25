#!/usr/bin/env node
const mysql_creator = require('../src/mysql_creator');
const importData = require('../src/mysql_data').importData;
const exportData = require('../src/mysql_data').exportData;
const logger = require('../src/utils/logger');
const readline = require('readline');

const options = [
  "i",
  "o",
  "h",
  "u",
  "d",
  "p"
];

var argv = process.argv;
if (argv.length <= 2) {
  logger.error('请输入数据库配置文件名');
  process.exit(1);
} else if (argv.length == 2) {
  mysql_creator(argv[2]);
} else {
  var params = {};
  var args = Array.from(argv).slice(2);
  var arg;
  for (var i = 0; i < args.length; i++) {
    arg = args[i];
    if (options.includes(arg[1])) {
      // be consistent with mysql command line tool
      if (arg[1] == "p") {
        if (arg.length == 2) {
          params[arg[1]] = args[i + 1];
          i++;
        } else {
          params[arg[1]] = arg.substr(2);
        }
      } else {
        if (arg.length == 2) {
          params[arg[1]] = args[i + 1];
          i++;
        } else {
          params[arg[1]] = arg.substr(2);
        }
      }
    }
  }
  let { h: host, u: user, p: password, d: database, i: input, o: output } = params;
  if (!(host && user && database && (input || output))) {
    logger.error("参数错误");
    process.exit(1);
  }
  console.log(`host: ${host} user: ${user} password: ${password} database: ${database} input: ${input} output: ${output}`);
  if (!password) {
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question("请输入数据库密码", (answer) => {
      password = answer;
      rl.close();
      if (input) {
        importData(input, host, user, password, database);
      } else {
        exportData(output, host, user, password, database);
      }
    })
  } else {
    if (input) {
      importData(input, host, user, password, database);
    } else {
      exportData(output, host, user, password, database);
    }
  }
}