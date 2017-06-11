const mysql_creator = require('./src/mysql-creator');
const importData = require('./src/mysql-data').importData;
const exportData = require('./src/mysql-data').exportData;

exports.importStruct = mysql_creator.importStruct;
exports.exportStruct = mysql_creator.exportStruct;
exports.importData = importData;
exports.exportData = exportData;