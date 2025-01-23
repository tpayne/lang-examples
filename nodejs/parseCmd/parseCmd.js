// Imports...
const args = require('yargs').argv
const isHelmAvailable = require('hasbin').sync('helm')

// Do function...
function main(args) {
    try {
        console.log(`Generate file: ${args.generateFile}`)
        console.log(`Overwrite: ${args.overwrite}`)
        console.log(`Is Helm installed: ${isHelmAvailable}`)
    } catch (e) {
        console.log(e)
    }
}

main(args)

