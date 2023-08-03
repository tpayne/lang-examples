const { TableServiceClient } = require('@azure/data-tables')
const { DefaultAzureCredential } = require("@azure/identity");
const { SecretClient } = require("@azure/keyvault-secrets");
const PropertiesReader = require('properties-reader')

class AzTableClient {
  credential = null
  tableClient = null
  storageAccount = null

  get client () {
    if (!this.tableClient) {
      this.#client()
    }
    return this.tableClient
  }

  #init() {
    const configFile = process.env.CONFIG_FILE ? process.env.CONFIG_FILE : 'config/app.properties'
    if (!this.credential ||
        !this.storageAccount ||
        !this.tableClient) {
      try {
        const properties = PropertiesReader(configFile)
        this.storageAccount = properties.get('storage-account')
        if (!this.storageAccount) {
          this.storageAccount = process.env.STORAGE_ACCOUNT
        }
      }
      catch(px) {
        console.error('%s: Error - Unable to get storage account from properties file (%s) %s',
                      new Date().toISOString(),configFile, px.message)
        return null
      }
      try {
        const tableUrl = `https://${this.storageAccount}.table.core.windows.net`
        console.log('%s: Logging into %s',new Date().toISOString(),tableUrl)
        this.credential = new DefaultAzureCredential()
        this.tableClient = new TableServiceClient(
          tableUrl,
          this.credential
        )
        console.log('%s: Logged on',new Date().toISOString(),tableUrl)
      } catch (e) {
        console.error('%s: Error - Unable to login to Azure %s',
                      new Date().toISOString(), e.message)
        return null
      }
    }
    return this.tableClient
  }

  #client () {
    if (!this.tableClient) {
      this.tableClient = this.#init()
    }
  }
}

const azTableClient = new AzTableClient()

const create = function (tableName) {
  return new Promise(function (resolve, reject) {
    azTableClient.client.createTable(tableName, function (error, result) {
      if (error) { return reject(error) }
      resolve(result)
    })
  })
}

const drop = function (tableName) {
  return new Promise(function (resolve, reject) {
    azTableClient.client.dropTable(tableName, function (error, result) {
      if (error) { return reject(error) }
      resolve(result)
    })
  })
}

const list = function () {
  return new Promise(function (resolve, reject) {
    azTableClient.client.listTablesSegmented(null, function (error, result) {
      if (error) { return reject(error) }
      resolve(result)
    })
  })
}

const createTable = (request, response) => {
  let tableName = request.query.table
  console.log('%s: Processing %s %s', new Date().toISOString(), request.path, tableName)

  create(tableName)
    .then(function (result) {
      if (result.statusCode == 200) {
        response.status(200).send({
          message: 'Table created'
        })
      }
    }).catch(function (error) { // eslint-disable-line
      response.status(500).send({
        message: 'Service error'
      })
    })
  /*
  let status = create(tableName)
  console.log('%s: Code is %s', new Date().toISOString(), status)

  if (status == 409) {
    response.status(409).send({
      message: 'Table already exists'
    })
  } else if (status == 200) {
    response.status(200).send({
      message: 'Table created'
    })
  } else if (status == 500) {
    response.status(500).send({
      message: 'Service error'
    })
  } else {
    response.status(status).send({
      message: 'Unknown error'
    })
  }
  */
}

const dropTable = (request, response) => {
  let tableName = request.query.table
  console.log('%s: Processing %s %s', new Date().toISOString(), request.path, tableName)
  drop(tableName)
    .then(function (result) {
      if (result.statusCode == 200) {
        response.status(200).send({
          message: 'Table dropped'
        })
      }
    }).catch(function (error) { // eslint-disable-line
      response.status(500).send({
        message: 'Service error'
      })
    })
}

const listTables = (request, response) => {
  console.log('%s: Processing %s', new Date().toISOString(), request.path)
  list()
    .then(function (result) {
      if (result.statusCode == 200) {
        response.status(200).json(result.entries)
      }
    }).catch(function (error) { // eslint-disable-line
      response.status(500).send({
        message: error.message
      })
    })
}

/*
async function listTables () {
  let iter = azTableClient.client.listTables()
  let i = 1;
  let str = new String("{ \"table\": [")
  for (const table of iter) {
    str += "\"${table}\","
    i++
  }
  str += "]}"
  response.status(200).send(str)
}
*/

module.exports = {
  listTables,
  createTable,
  dropTable
}
