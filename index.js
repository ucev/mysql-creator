const mysql_creator = require('./src/mysql_creator');
const importData = require('./src/mysql_data').importData;
const exportData = require('./src/mysql_data').exportData;

exports.importStruct = mysql_creator.importStruct;
exports.exportStruct = mysql_creator.exportStruct;
exports.importData = importData;
exports.exportData = exportData;