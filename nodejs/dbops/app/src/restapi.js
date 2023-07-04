// Import required core modules
const express = require('express')
const fs = require('fs')
const path = require('path')
const db = require('./db')
const testdata = require('./testdata')

const bodyParser = require('body-parser')

const PropertiesReader = require('properties-reader')

function processRequest (svrapp) {
  // Standard functions...
  svrapp.get('/', (request, response) => {
    // console.log('%s: Processing %s',new Date().toISOString(),request.path)
    fs.readFile('html/index.html', function (herr, html) {
      response.writeHead(200, { 'Content-Type': 'text/html' })
      response.write(html)
      response.end()
    })
  })

  svrapp.get('/info', (request, response) => {
    // console.log('%s: Processing %s',new Date().toISOString(),request.path)
    response.json({ info: 'This is a Demoapp for Postgres' })
  })

  svrapp.get('/version', (request, response) => {
    // console.log('%s: Processing %s',new Date().toISOString(),request.path)
    response.json({ version: '1.0.0' })
  })

  // Database functions
  svrapp.get('/orders', db.getOrdersInProgress)
  svrapp.get('/customers', db.getCustomers)
  svrapp.get('/stock', db.getStock)
  svrapp.get('/healthz', db.healthCheck)

  // Test functions
  svrapp.get('/testData', testdata.getTestData)
  // End
}

function main () {
  const svrapp = express()
  svrapp.use(bodyParser.json())
  svrapp.use(
    bodyParser.urlencoded({
      extended: true
    })
  )
  svrapp.use(
    express.static(
      //path.join(__dirname, "scripts")
      "."
    )
  );

  try {
    let port = 3000

    try {
      const properties = PropertiesReader('config/app.properties')
      port = properties.get('port')
    } catch (e) {
    }

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

main()
