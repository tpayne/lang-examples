const PropertiesReader = require('properties-reader')
const fs = require('fs')

const queryMap = new Map()

async function getQueryTxt (key) {
  if (queryMap.size == 0) {
    await loadQueries(await getProperty('QUERY_FILE'))
  }

  if (queryMap.has(key)) {
    return queryMap.get(key)
  }

  return null
}

// Get queries
async function loadQueries (queryFile) {
  try {
    if (!fs.existsSync(queryFile)) {
      console.error('%s: Error - Unable to access query file %s',
        new Date().toISOString(), queryFile)
      return null
    }
    const text = fs.readFileSync(queryFile,
      { encoding: 'utf8', flag: 'r' })

    let currentOffset = 0;
    const pattern = /^(\w+):(.+(?:\n  .*|\n[^:\n]+$)*)/gm

    for (const [fullMatch, key, value] of text.matchAll(pattern)) {
      queryMap.set(
        key,
        value
      )
    }
    return queryMap
  } catch (e) {
    console.error('%s: Error - Unable to get query from file (%s) %s',
      new Date().toISOString(), queryFile, e.message)
    return null
  }
}

// Utility functions
async function getProperty (prop) {
  let property = null
  const configFile = process.env.CONFIG_FILE ? process.env.CONFIG_FILE : '/config/app.properties'

  try {
    const properties = PropertiesReader(configFile)
    property = properties.get(prop)
  } catch (px) {
    console.error('%s: Error - Unable to get value from properties file (%s) %s',
      new Date().toISOString(), configFile, px.message)
    return null
  }

  return property
}

module.exports = {
  getProperty,
  getQueryTxt
}
