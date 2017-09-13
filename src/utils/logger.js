const chalk = require('chalk')

const logger = {
  error: function (str) {
    console.log(chalk.bgRed.white(str))
  },
  info: function (str) {
    console.log(chalk.bgBlack.yellow(str))
  },
  succ: function (str) {
    console.log(chalk.bgGreen.yellow(str))
  }
}

module.exports = logger
