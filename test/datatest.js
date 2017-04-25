const mysql_data = require('../src/mysql_data');

mysql_data.importData("test.yaml", "localhost", "root", "root", "jsyaml");