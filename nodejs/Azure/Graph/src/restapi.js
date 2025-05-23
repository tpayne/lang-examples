// Import required core modules
const express = require('express')
const fs = require('fs')
const azure = require('./azure.js')
const bodyParser = require('body-parser')
const PropertiesReader = require('properties-reader')
const RateLimit = require('express-rate-limit');

/* eslint-disable no-use-before-define */
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per windowMs
});

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
      info: 'This is a Demoapp for Graph'
    })
  })

  svrapp.get('/version', (request, response) => {
    // console.log('%s: Processing %s',new Date().toISOString(),request.path)
    response.json({
      version: '1.0.0'
    })
  })

  // Database functions
  svrapp.get('/api/query/count', azure.countResources)
  svrapp.get('/api/query/list', azure.listResources)
  svrapp.get('/api/query/healthz', azure.healthCheck)
}

function main () {
  const svrapp = express()
  const configFile = process.env.CONFIG_FILE ? process.env.CONFIG_FILE : '/config/app.properties'

  svrapp.use(bodyParser.json())
  svrapp.use(
    bodyParser.urlencoded({
      extended: true
    })
  )
  svrapp.use(limiter);
  svrapp.use(
    express.static(
      // path.join(__dirname, "scripts")
      '.'
    )
  )

  try {
    let port = 3000

    try {
      const properties = PropertiesReader(configFile)
      port = properties.get('port')
    } catch (e) {
      console.log('%s: Cannot read file %s', new Date().toISOString(), configFile)
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
