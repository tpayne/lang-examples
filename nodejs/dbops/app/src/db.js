const PropertiesReader = require('properties-reader')
const Pool = require('pg').Pool

// Database connections
var properties = PropertiesReader('config/app.properties')
const pgConStr = (process.env.PG_CONSTR) ? process.env.PG_CONSTR :
                    properties.get("pg_constr")

const dbconfig = parser(pgConStr)

const pool = new Pool(
    dbconfig
)

// Short parser function to workaround weirdo issues from Pool...
function parser(conStr) {
    if (conStr == null) {
        return {
            host: 'localhost', 
            user: 'postgres', 
            database: 'default' 
        }
    }

    var tmpStr = conStr.substring(conStr.indexOf('://')+3)
    var userId = tmpStr.substring(0,tmpStr.indexOf(':'))
    var tmpStr = tmpStr.substring(tmpStr.indexOf(':')+1)
    var pwd = tmpStr.substring(0,tmpStr.indexOf('@'))
    var tmpStr = tmpStr.substring(tmpStr.indexOf('@')+1)
    var host = tmpStr.substring(0,tmpStr.indexOf('/'))
    var db = tmpStr.substring(tmpStr.indexOf('/')+1)
    return { host: host, user: userId, password: pwd, database: db }
}

const getOrdersInProgress = (request, response) => {
    pool.query('SELECT customer_name,order_name,stock_item,order_date,number_ordered FROM orders_in_progress', (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json(results.rows)
    })
}

const getCustomers = (request, response) => {
    pool.query('SELECT * FROM customers ORDER BY customer_uid ASC', (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json(results.rows)
    })
}

const getStock = (request, response) => {
    pool.query('SELECT * FROM stock_items ORDER BY stock_uid ASC', (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json(results.rows)
    })
}

module.exports = {
    getOrdersInProgress,
    getCustomers,
    getStock,
}

// Signal handlers...
function signalHandler(signal) {
    pool.end()
    console.log("Killing process and shutting down")
    process.exit()
}

process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)