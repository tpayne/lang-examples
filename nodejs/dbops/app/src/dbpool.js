const PropertiesReader = require('properties-reader')
const Pool = require('pg').Pool

class Connect {
    #poolCon = null

    constructor() {
    }

    get pool() {
        if (!this.#poolCon) {
            this.#pool()
        }
        return this.#poolCon
    }

    // Short parser function to workaround weirdo issues from Pool...
    #parser(conStr) {
        if (conStr == null) {
            return {
                host: 'localhost', 
                user: 'postgres', 
                database: 'default' 
            }
        }
    
        let tmpStr = conStr.substring(conStr.indexOf('://') + 3)
        const userId = tmpStr.substring(0, tmpStr.indexOf(':'))
        tmpStr = tmpStr.substring(tmpStr.indexOf(':') + 1)
        const pwd = tmpStr.substring(0, tmpStr.indexOf('@'))
        tmpStr = tmpStr.substring(tmpStr.indexOf('@') + 1)
        const host = tmpStr.substring(0, tmpStr.indexOf(':'))
        tmpStr = tmpStr.substring(tmpStr.indexOf(':') + 1)
        const portNo = tmpStr.substring(0, tmpStr.indexOf('/'))
        const db = tmpStr.substring(tmpStr.indexOf('/') + 1)
        return {
          max: 300,
          connectionTimeoutMillis: 5000,
          host,
          user: userId,
          password: pwd,
          database: db,
          port: parseInt(portNo),
          ssl: true
        }
    }
    
    #createPool() {
        var pgConStr = null
        try {
            const properties = PropertiesReader('config/app.properties')
            pgConStr = properties.get("pg_constr")
        } catch(err) {
            pgConStr = process.env.PG_CONSTR
        }

        const dbconfig = this.#parser(pgConStr)
            
        const pool = new Pool(
            dbconfig
        )

        return pool
    }
    
    #pool() {
        if (!this.#poolCon) {
            this.#poolCon = this.#createPool()
        }
    }
}

const DbPool = new Connect()

module.exports = {
    DbPool,
}
