// Imports...
const args = require('yargs').argv
const exeTest = require('hasbin')
const { boolean } = require('yargs')
 
// Do function...
function main(args) {
    try {
        console.log(`Generate file: ${args.generateFile}`)
        console.log(`Overwrite: ${args.overwrite}`)
        isHelmAvailable = exeTest.sync('helm')
        isLsAvailable = exeTest.sync('ls')
        console.log(`Is Helm installed: ${isHelmAvailable}`)
        console.log(`Is LS installed: ${isLsAvailable}`)
    } catch (e) {
        console.log(e)
    }
}

main(args)

