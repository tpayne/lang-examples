// Test ops
const PropertiesReader = require('properties-reader')

const getTestData = (request, response) => {
  console.log('%s: Processing %s', new Date().toISOString(), request.path)

  try {
    let testdata = null

    try {
      const properties = PropertiesReader('test/data.txt')
      testdata = properties.get('testdata_orders')
    } catch (e) {
    }
    if (testdata) {
      response.status(200).send(testdata) 
    } else {
      response.status(404).send({ message: 'Data not found' })
    }
  } catch(e) {
    response.status(500).send({ message: 'Service Error' })
  }
}

module.exports = {
  getTestData,
}
