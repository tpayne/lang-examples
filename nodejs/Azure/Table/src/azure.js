const { odata, TableServiceClient } = require('@azure/data-tables')
const { DefaultAzureCredential } = require('@azure/identity')
const { AzureNamedKeyCredential } = require('@azure/core-auth')
const { getProperty } = require('./utils.js')
// const { table } = require('console')
// const util = require('util')

const conmap = new Map()

// Utility functions
async function getStorageAccount () {
  let storageAccount = null
  storageAccount = await getProperty('storage-account')
  if (!storageAccount) {
    storageAccount = process.env.STORAGE_ACCOUNT
  }
  return storageAccount
}

async function getStorageAccountKey () {
  let storageAccountKey = null
  storageAccountKey = await getProperty('storage-account-key')
  if (!storageAccountKey) {
    storageAccountKey = process.env.STORAGE_ACCOUNT_KEY
  }
  return storageAccountKey
}

async function getUrl (storageAccount) {
  return `https://${storageAccount}.table.core.windows.net`
}

async function connect () {
  let credential = null
  let tableClientService = null
  const storageAccount = await getStorageAccount()
  const storageAccountKey = await getStorageAccountKey()

  if (conmap.has(storageAccount)) {
    return conmap.get(storageAccount)
  }

  try {
    const tableUrl = await getUrl(storageAccount)

    if (storageAccountKey) {
      console.log('%s: Key logging into %s', new Date().toISOString(), tableUrl)
      credential = new AzureNamedKeyCredential(storageAccount, storageAccountKey)
    } else {
      console.log('%s: Default logging into %s', new Date().toISOString(), tableUrl)
      credential = new DefaultAzureCredential()
    }
    tableClientService = new TableServiceClient(tableUrl, credential)
    console.log('%s: Logged onto ', new Date().toISOString(), tableUrl)
  } catch (e) {
    console.error('%s: Error - Unable to login to Azure %s',
      new Date().toISOString(), e.message)
    return null
  }

  conmap.set(storageAccount, tableClientService)
  return tableClientService
}

async function tableExists (tableName) {
  const tableClientService = await connect()
  const queryTable = tableClientService.listTables({
    queryOptions: { filter: odata`TableName eq ${tableName}` }
  })

  let ret = false
  for await (const table of queryTable) { // eslint-disable-line
    ret = true
    break
  }
  return ret
}

// Helper functions
async function list () {
  try {
    const tableClientService = await connect()
    const queryTable = tableClientService.listTables({
      queryOptions: {}
    })
    const p = []
    for await (const table of queryTable) {
      p.push(table)
    }
    return p
  } catch (e) {
    console.log('%s: Error - %s', new Date().toISOString(), e.message)
    return null
  }
}

async function create (tableName) {
  const tableClientService = await connect()
  await tableClientService.createTable(tableName, {
    onResponse: (error, result) => {
      if (error) {
        // console.log(util.inspect(error, false, null, true))
        return (error)
      }
      // console.log(util.inspect(result, false, null, true))
      return (result)
    }
  })
}

async function drop (tableName) {
  const tableClientService = await connect()
  await tableClientService.deleteTable(tableName, {
    onResponse: (error, result) => {
      if (error) {
        // console.log(util.inspect(error, false, null, true))
        return (error)
      }
      // console.log(util.inspect(result, false, null, true))
      return (result)
    }
  })
}

async function createTable (request, response) {
  const tableName = request.body.table
  console.log('%s: Processing %s %s', new Date().toISOString(), request.path, tableName)

  try {
    const exists = await tableExists(tableName)
    if (exists) {
      return response.status(409).json({
        message: 'Table already exists'
      })
    }
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
  try {
    const result = await create(tableName) // eslint-disable-line
    const exists = await tableExists(tableName)
    if (exists) {
      return response.status(201).json({
        message: 'Table created'
      })
    }
    return response.status(500).json({
      message: 'Table creation service error'
    })
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
}

async function dropTable (request, response) {
  const tableName = request.body.table
  console.log('%s: Processing %s %s', new Date().toISOString(), request.path, tableName)

  try {
    const exists = await tableExists(tableName)
    if (!exists) {
      return response.status(404).json({
        message: 'Table does not exist'
      })
    }
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
  try {
    const result = await drop(tableName) // eslint-disable-line
    const exists = await tableExists(tableName)
    if (!exists) {
      return response.status(201).json({
        message: 'Table dropped'
      })
    }
    return response.status(500).json({
      message: 'Table drop service error'
    })
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
}

async function listTables (request, response) {
  console.log('%s: Processing %s', new Date().toISOString(), request.path)

  try {
    const result = await list()
    if (result) {
      response.status(200).json(result)
    } else {
      response.status(500).json({
        message: 'Service error'
      })
    }
  } catch (e) {
    response.status(500).json({
      message: e.message
    })
  }
}

async function healthCheck (request, response) {
  console.log('%s: Processing %s', new Date().toISOString(), request.path)

  try {
    const result = await list() // eslint-disable-line
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
  listTables,
  createTable,
  dropTable,
  healthCheck
}
