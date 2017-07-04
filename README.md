# mysql-creator

A simple mysql database generator tools for nodejs.

Database config files are written using yaml. See examples under test.

# Install

**node.js**
```
  npm install mysql-creator --save
```

# Usage examples
1. create database
  ```
    ./bin/mysql_creator ${PATH_TO_CONFIG_FILE}
  ```
2. import data
  ```
    ./bin/mysql_creator -h localhost -u root -d jsyaml -i ${PATH_TO_DATA_FILE} -p
  ```
3. export data
  ```
    ./bin/mysql_creator -h localhost -u root -d jsyaml -o ${PATH_TO_OUTPUT_FILE} -p
  ```
4. export database structure
  ```
    ./bin/mysql_creator -h localhost -u root -d jsyaml -e ${PATH_TO_OUTPUT_FILE} -p
  ```
具体命令行参数的格式见 [minimist](https://www.npmjs.com/package/minimist)

# Params
+ `-d`: target database
+ `-e`: path to file where structure are exported
+ `-h`: mysql hostname
+ `-i`: path to file with data to import
+ `-o`: path to file where data are exported
+ `-p`: mysql password
+ `-u`: mysql username