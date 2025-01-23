// Imports...
const args = require('yargs').argv

// Do function...
function main(args) {
    try {
        console.log(`Generate file: ${args.generateFile}`)
        console.log(`Overwrite: ${args.overwrite}`)
    } catch (e) {
        console.log(e)
    }
}

main(args)

