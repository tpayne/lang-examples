//
const DbPool = require('./dbpool.js').DbPool

var runQuery = function(queryStr) {
    return new Promise(function(resolve, reject){
        DbPool.pool.query(queryStr, function(err, result) {
            if(err)
                return reject(err)
            resolve(result)
        })
    });
}

async function testConnection() {
    runQuery('SELECT NOW()')
    .then(function(result){
        return true    
    }).catch(function(err){
        return false   
    })
}

const healthCheck = (request, response) => {
    if (!testConnection()) {
        response.status(500).send({ message: 'Service Error' })   
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
        response.status(500).send({ message: 'Service Error' })   
    }

    runQuery('SELECT customer_name,order_name,stock_item,order_date,number_ordered FROM "demoapp".orders_in_progress')
    .then(function(result){
        response.status(200).json(result.rows)  
    }).catch(function(err){
        response.status(500).send({ message: 'Service Error' })   
    })
}

const getCustomers = (request, response) => {
    if (!testConnection()) {
        response.status(500).send({ message: 'Service Error' })   
    }

    runQuery('SELECT * FROM "demoapp".customers ORDER BY customer_uid ASC')
    .then(function(result){
        response.status(200).json(result.rows)  
    }).catch(function(err){
        response.status(500).send({ message: 'Service Error' })   
    })
}

const getStock = (request, response) => {
    if (!testConnection()) {
        response.status(500).send({ message: 'Service Error' })   
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

const healthCheck = (request, response) => {
    if (!testConnection()) {
        response.send(404, { message: 'Error' });
    }

    try {
        pool.query('SELECT 1 FROM orders_in_progress', (error, results) => {
            if (error) {
                response.send(404, { message: 'Error' });
            }
            response.send(200, { message: 'Ok' });
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
    DbPool.pool.end()
    console.log("Killing process and shutting down")
    process.exit()
}

process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)
