#!/usr/bin/env node
const createDatabase = require('../src/mysql-creator').importStruct;
const exportStruct = require('../src/mysql-creator').exportStruct;
const importData = require('../src/mysql-data').importData;
const exportData = require('../src/mysql-data').exportData;
const logger = require('../src/utils/logger');
const readline = require('readline');

const options = [
  "d",
  "e",
  "h",
  "i",
  "o",
  "p",
  "u"
];

function destructOptions(args) {
  var params = {};
  var arg;
  for (var i = 0; i < args.length; i++) {
    arg = args[i];
    if (options.includes(arg[1])) {
      // be consistent with mysql command line tool
      if (arg[1] == "p") {
        if (arg.length == 2) {
          if (i + 1 < args.length && !options.includes(args[i + 1][1])) {
            params[arg[1]] = args[i + 1];
            i++;
          }
        } else {
          console.log(args[i + 1][1]);
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
  console.log(params);
  return params;
}

var argv = process.argv;
if (argv.length <= 2) {
  logger.error('请输入数据库配置文件名');
  process.exit(1);
} else if (argv.length == 3) {
  createDatabase(argv[2]);
} else {
  var args = Array.from(argv).slice(2);
  var params = destructOptions(args);
  let { h: host, u: user, p: password, d: database, i: input, o: output, e: exportf } = params;
  if (!(host && user && database && (input || output || exportf))) {
    logger.error("参数错误");
    process.exit(1);
  }
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