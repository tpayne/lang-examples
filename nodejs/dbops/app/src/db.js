const PropertiesReader = require('properties-reader')
const Pool = require('pg').Pool
var properties = PropertiesReader('config/app.properties')

var pool = null

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

// Database connections
function connectDB() {
    try {
        if (pool == null) {
            var pgConStr = process.env.PG_CONSTR
            if (pgConStr == null) {
                pgConStr = properties.get("pg_constr")
            }
            console.log('Connecting to %s',pgConStr)
            const dbconfig = parser(pgConStr)
            try {
                pool = new Pool(
                    dbconfig
                )    
            } catch(e) {
                pool = null
            }
        }
        return
    } catch(e) {
        console.log(e)
        pool = null
        return
    }
}

function testConnection() {
    console.log('Checking database connection...')

    try {
        connectDB()
        if (pool) {
            pool.query('SELECT NOW()', (error, results) => {
                if (error) {
                    console.log(error)
                    pool = null
                    return false
                }
            })
            return true    
        }
        return false
    }
    catch(e) {
        console.log(e)
        pool = null
        return false
    }
}

const healthCheck = (request, response) => {
    try {
        if (!testConnection()) {
            response.status(404).json({ message: 'Database error' })
        }
        pool.query('SELECT 1 FROM orders_in_progress', (error, results) => {
            if (error) {
                response.status(404).json({ message: 'Database error' })
            }
        })
    } catch(e) {
        console.log(e)
    }
}

const getOrdersInProgress = (request, response) => {
    if (!testConnection()) {
        throw new Error('Database is not connected')
    }

    try {
        pool.query('SELECT customer_name,order_name,stock_item,order_date,number_ordered FROM orders_in_progress', (error, results) => {
            if (error) {
                throw error
            }
            response.status(200).json(results.rows)
        })    
    } catch(e) {
        console.log(e)
    }
}

const getCustomers = (request, response) => {
    if (!testConnection()) {
        throw new Error('Database is not connected')
    }

    try {
        pool.query('SELECT * FROM customers ORDER BY customer_uid ASC', (error, results) => {
            if (error) {
                throw error
            }
            response.status(200).json(results.rows)
        })
    } catch(e) {
        console.log(e)
    }
}

const getStock = (request, response) => {
    if (!testConnection()) {
        throw new Error('Database is not connected')
    }

    try {
        pool.query('SELECT * FROM stock_items ORDER BY stock_uid ASC', (error, results) => {
            if (error) {
                throw error
            }
            response.status(200).json(results.rows)
        })
    } catch(e) {
        console.log(e)
    }
}

module.exports = {
    getOrdersInProgress,
    getCustomers,
    getStock,
    healthCheck,
}

// Signal handlers...
function signalHandler(signal) {
    if (pool) {
        pool.end()
    }
    console.log("Killing process and shutting down")
    process.exit()
}

process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)
