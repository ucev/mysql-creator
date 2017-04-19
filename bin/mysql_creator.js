#!/usr/bin/env node
const mysql_creator = require('../src/mysql_creator');
const logger = require('../src/utils/logger');

var argv = process.argv;
if (argv.length <= 2) {
  logger.error('请输入数据库配置文件名');
  process.exit(1);
}
mysql_creator(argv[2]);