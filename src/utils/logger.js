const logger = {
  log: function(fgcolor, bgcolor, str) {
    console.log('\033[1;' + fgcolor + ';' + bgcolor + 'm');
    console.log(str);
    console.log('\033[0m');
  },
  error: function(str) {
    this.log(31, 40, str);
  },
  succ: function(str) {
    this.log(33, 42, str);
  }
}

module.exports = logger;
