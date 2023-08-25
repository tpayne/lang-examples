const {
  DefaultAzureCredential
} = require('@azure/identity')
const { ResourceGraphClient } = require('@azure/arm-resourcegraph')
const { getProperty, getQueryTxt } = require('./utils.js')
const { setLogLevel } = require('@azure/logger')
const os = require('os')

// const { table } = require('console')
// const util = require('util')

const conmap = new Map()

// Utility functions
function setLog (level) {
  setLogLevel(level)
}

async function getManagedId () {
  let Id = await getProperty('MANAGED_CLIENT_ID')
  if (!Id) {
    Id = process.env.MANAGED_CLIENT_ID
  }
  return Id
}

async function getTenantId () {
  let Id = await getProperty('AZURE_TENANT_ID')
  if (!Id) {
    Id = process.env.AZURE_TENANT_ID
  }
  return Id
}

async function getClientId () {
  let Id = await getProperty('AZURE_CLIENT_ID')
  if (!Id) {
    Id = process.env.AZURE_CLIENT_ID
  }
  return Id
}

async function getClientSecret () {
  let Id = await getProperty('AZURE_CLIENT_SECRET')
  if (!Id) {
    Id = process.env.AZURE_CLIENT_SECRET
  }
  return Id
}

async function getAADEndpoint () {
  let Id = await getProperty('AZURE_AAD_ENDPOINT')
  if (!Id) {
    Id = process.env.AZURE_AAD_ENDPOINT
  }
  return Id
}

async function getGraphEndpoint () {
  let Id = await getProperty('AZURE_GRAPH_ENDPOINT')
  if (!Id) {
    Id = process.env.AZURE_GRAPH_ENDPOINT
  }
  return Id
}

async function getQuery (query) {
  return (await getQueryTxt(query))
}

async function connect () {
  let credential = null
  let graphClientService = null

  const userInfo = os.userInfo()
  const userName = userInfo.username

  if (conmap.has(userName)) {
    return conmap.get(userName)
  }

  try {
    setLog("info")
    console.log('%s: Default login', new Date().toISOString())
    credential = new DefaultAzureCredential()
    graphClientService = new ResourceGraphClient(credential)
    console.log('%s: Logged in', new Date().toISOString())
    setLog("warning")
  } catch (e) {
    console.error('%s: Error - Unable to login to Azure %s',
      new Date().toISOString(), e.message)
    setLog("warning")
    return null
  }

  conmap.set(userName, graphClientService)
  return graphClientService
}

// Helper functions
async function runQueryImpl (query) {
  const graphClientService = await connect()
  // let   qry = queryStr.replace(/^"(.*)"$/, '$1')
  const qry = await getQuery(query)

  if (qry == null) {
    return null
  }

  setLog("info")
   
  const result = await graphClientService.resources(
    {
      query: qry
    },
    { resultFormat: 'json' }
  )

  setLog("warning")
 
  return result
}

async function countResources (request, response) {
  const resourceType = request.query.resourceType
  console.log('%s: Processing %s %s', new Date().toISOString(), request.path, resourceType)

  try {
    const results = await runQueryImpl('TYPE_COUNT')
    if (results === null) {
      return response.status(500).json({
        message: 'Query error'
      })  
    }
    return response.status(200).send(JSON.stringify(results.data, null, 2))
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
}

async function listResources (request, response) {
  const resourceType = request.query.resourceType
  console.log('%s: Processing %s %s', new Date().toISOString(), request.path, resourceType)

  try {
    const results = await runQueryImpl('LIST_QUERY')
    if (results === null) {
      return response.status(500).json({
        message: 'Query error'
      })  
    }
    return response.status(200).send(JSON.stringify(results.data, null, 2))
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
}

async function healthCheck (request, response) {
  console.log('%s: Processing %s', new Date().toISOString(), request.path)

  try {
    const results = await runQueryImpl('HEALTH_CHECK')
    if (results === null) {
      return response.status(500).json({
        message: 'Query error'
      })  
    }
    response.status(200).json({
      message: 'Ok'
    })
  } catch (e) {
    response.status(500).json({
      message: e.message
    })
  }
}

// Signal handlers...
function signalHandler (signal) {
  console.log('Killing process and shutting down')
  conmap.clear()
  process.exit()
}

process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)

module.exports = {
  countResources,
  healthCheck,
  listResources
}
