const PropertiesReader = require('properties-reader')

// Utility functions
async function getProperty(prop) {
  let property = null
  const configFile = process.env.CONFIG_FILE ? process.env.CONFIG_FILE : '/config/app.properties'

  try {
    const properties = PropertiesReader(configFile)
    property = properties.get(prop)
  } catch (px) {
    console.error('%s: Error - Unable to get storage account from properties file (%s) %s',
      new Date().toISOString(), configFile, px.message)
    return null
  }

  return property
}

async function isPathDir(fileName) {
  return (fileName.slice(-1) == '/')
}

function isNull(str) {
  return (!Boolean(str))
}

module.exports = {
  getProperty,
  isPathDir,
  isNull
}
