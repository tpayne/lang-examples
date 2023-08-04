// Import required core modules
const express = require('express')
const fs = require('fs')
const azure = require('./azure.js')
const bodyParser = require('body-parser')
const PropertiesReader = require('properties-reader')

/* eslint-disable no-use-before-define */
function processRequest (svrapp) {
  // Standard functions...
  svrapp.get('/', (request, response) => {
    // console.log('%s: Processing %s',new Date().toISOString(),request.path)
    fs.readFile('html/index.html', function (herr, html) {
      response.writeHead(200, {
        'Content-Type': 'text/html'
      })
      response.write(html)
      response.end()
    })
  })

  svrapp.get('/info', (request, response) => {
    // console.log('%s: Processing %s',new Date().toISOString(),request.path)
    response.json({
      info: 'This is a Demoapp for Storage'
    })
  })

  svrapp.get('/version', (request, response) => {
    // console.log('%s: Processing %s',new Date().toISOString(),request.path)
    response.json({
      version: '1.0.0'
    })
  })

  // Database functions
  svrapp.post('/api/tables/create', azure.createTable)
  svrapp.post('/api/tables/drop', azure.dropTable)
  svrapp.get('/api/tables/list', azure.listTables)
}

function main () {
  const svrapp = express()
  svrapp.use(bodyParser.json())
  svrapp.use(
    bodyParser.urlencoded({
      extended: true
    })
  )

  try {
    let port = 3000

    try {
      const configFile = process.env.CONFIG_FILE ? process.env.CONFIG_FILE : 'config/app.properties'
      const properties = PropertiesReader(configFile)
      port = properties.get('port')
    } catch (e) {}

    svrapp.listen(port, () => {
      console.log(`App running on port ${port}.`)
    })

    try {
      processRequest(svrapp)
    } catch (e) {
      console.log(e)
    }
  } catch (e) {
    console.log(e)
  }
}

// Signal handlers...
function signalHandler (signal) {
  console.log('Killing process and shutting down')
  process.exit()
}

process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)

main()
