// Import required core modules
const express = require('express')
const fs = require('fs');
const db = require('./db')

const bodyParser = require('body-parser')

const PropertiesReader = require('properties-reader')
var properties = PropertiesReader('config/app.properties')
const port = properties.get("port")

function processRequest(svrapp) {
    // Standard functions...
    svrapp.get('/', (request, response) => {
        fs.readFile('html/index.html', function (herr, html) {
            response.writeHead(200, { 'Content-Type': 'text/html' })
            response.write(html)
            response.end()
        })
    })

    svrapp.get('/info', (request, response) => {
        response.json({ info: 'This is a Demoapp for Postgres' })
    })

    svrapp.get('/version', (request, response) => {
        response.json({ version: '1.0.0' })
    })

    // Database functions
    svrapp.get('/orders', db.getOrdersInProgress)
    svrapp.get('/customers', db.getCustomers)
    svrapp.get('/stock', db.getStock)    
    svrapp.get('/healthz', db.healthCheck)    
}

function main() {
    const svrapp = express()
    svrapp.use(bodyParser.json())
    svrapp.use(
        bodyParser.urlencoded({
            extended: true,
        })
    )

    try {
        svrapp.listen(port, () => {
            console.log(`App running on port ${port}.`)
        })

        try {
            processRequest(svrapp)
        } catch(e) {
            console.log(e)
        }
    } catch(e) {
        console.log(e)
    }
}

main()