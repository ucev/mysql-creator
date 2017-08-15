const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

function getAbsolutePath (filepath) {
  if (path.isAbsolute(filepath)) {
    return filepath
  }
  return path.resolve(process.cwd(), filepath)
}

function dumpDataToFile (filepath, data) {
  return new Promise((resolve, reject) => {
    var yRes = yaml.safeDump(data)
    filepath = getAbsolutePath(filepath)
    var ws = fs.createWriteStream(filepath, { defaultEncoding: 'utf8' })
    ws.on('finish', () => {
      resolve()
    })
    ws.on('error', (err) => {
      console.log('ERROR')
      reject(err)
    })
    ws.write(yRes)
    ws.end()
  })
}

exports.getAbsolutePath = getAbsolutePath
exports.dumpDataToFile = dumpDataToFile
