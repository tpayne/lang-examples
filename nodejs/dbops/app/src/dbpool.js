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
    
        var tmpStr = conStr.substring(conStr.indexOf('://')+3)
        var userId = tmpStr.substring(0,tmpStr.indexOf(':'))
        var tmpStr = tmpStr.substring(tmpStr.indexOf(':')+1)
        var pwd = tmpStr.substring(0,tmpStr.indexOf('@'))
        var tmpStr = tmpStr.substring(tmpStr.indexOf('@')+1)
        var host = tmpStr.substring(0,tmpStr.indexOf(':'))
        var tmpStr = tmpStr.substring(tmpStr.indexOf(':')+1)
        var portNo = tmpStr.substring(0,tmpStr.indexOf('/'))
        var db = tmpStr.substring(tmpStr.indexOf('/')+1)
        return { max: 300, connectionTimeoutMillis: 5000,
                 host: host, user: userId, password: pwd, 
                 database: db, port: parseInt(portNo), ssl: true, }
    }
    
    #createPool() {
        const properties = PropertiesReader('config/app.properties')
        const pgConStr = properties.get("pg_constr")
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
