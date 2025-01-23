// Imports...
const args = require('yargs').argv
const exeTest = require('hasbin')
const { boolean } = require('yargs')

const fs = require('fs')
const chdPrc = require('child_process')

function logOutput(fileName) {
    try {
        const lsProc = chdPrc.spawnSync('ls', ['-lh', '/bin']);
        fs.writeFileSync(fileName, lsProc.stdout)
    } catch(e) {
        console.log(e)
    }
}


// Do function...
function main(args) {
    try {
        console.log(`Generate file: ${args.generateFile}`)
        console.log(`Overwrite: ${args.overwrite}`)
        isHelmAvailable = exeTest.sync('helm')
        isLsAvailable = exeTest.sync('ls')
        console.log(`Is Helm installed: ${isHelmAvailable}`)
        console.log(`Is LS installed: ${isLsAvailable}`)
        logOutput(args.generateFile)
        fs.stat(args.generateFile, function(err, stat) {
            if (err == null) {
                buf = fs.readFileSync(args.generateFile).toString()
                console.log('Command output:\n'+buf)
            } else if (err.code === 'ENOENT') {
                console.log(`File ${args.generateFile} does not exist`)
            }
        });
    } catch (e) {
        console.log(e)
    }
}

main(args)

