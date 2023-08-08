const PropertiesReader = require('properties-reader')

// Utility functions
async function getProperty (prop) {
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

function isPathDir (fileName) {
  return (fileName.slice(-1) === '/')
}

function isNull (str) {
  return (!str)
}

function getDirectoryName (str) {
  const dirs = getDirectories(str)
  let noDirs = dirs.length
  let parent = ''
  for (const dir of dirs) {
    noDirs--
    if (noDirs && !isNull(dir)) {
      parent += `${dir}/`
    }
  }
  return parent
}

function getParentDir (str) {
  const dirs = getDirectories(str)
  let noDirs = dirs.length
  let parent = ''
  noDirs--
  for (const dir of dirs) {
    noDirs--
    if (noDirs && !isNull(dir)) {
      parent += `${dir}/`
    }
  }
  return parent
}

function getDirectories (str) {
  const dirs = str.split('/')
  return dirs
}

function getFileName (str) {
  const dirs = getDirectories(str)
  let len = dirs.length
  len--
  return dirs[len]
}

module.exports = {
  getProperty,
  isPathDir,
  isNull,
  getDirectories,
  getDirectoryName,
  getFileName,
  getParentDir
}
