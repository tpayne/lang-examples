const {
  listFilesImpl,
  createFileImpl,
  dropFileImpl,
  listSharesImpl,
  createShareImpl,
  dropShareImpl,
  shareExists,
  fileExists
} = require('./azure.js')
const { table } = require('console')
const util = require('util')
const { isNull } = require('./utils.js')

// Share functions
async function createShare(request, response) {
  const shareName = request.body.share

  console.log('%s: Processing %s %s', new Date().toISOString(), request.path, shareName)

  if (isNull(shareName)) {
    return response.status(400).json({
      message: 'Missing parameters'
    })
  }

  try {
    const exists = await shareExists(shareName)
    if (exists) {
      return response.status(409).json({
        message: 'Share already exists'
      })
    }
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
  try {
    const result = await createShareImpl(shareName) // eslint-disable-line
    const exists = await shareExists(shareName)
    if (exists) {
      return response.status(201).json({
        message: 'Share created'
      })
    }
    return response.status(500).json({
      message: 'Share creation service error'
    })
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
}

async function dropShare(request, response) {
  const shareName = request.body.share

  console.log('%s: Processing %s %s', new Date().toISOString(), request.path, shareName)

  if (isNull(shareName)) {
    return response.status(400).json({
      message: 'Missing parameters'
    })
  }

  try {
    const exists = await shareExists(shareName)
    if (!exists) {
      return response.status(404).json({
        message: 'Share does not exist'
      })
    }
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }

  try {
    const result = await dropShareImpl(shareName) // eslint-disable-line
    const exists = await shareExists(shareName)
    if (!exists) {
      return response.status(201).json({
        message: 'Share dropped'
      })
    }
    return response.status(500).json({
      message: 'Share drop service error'
    })
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
}

async function listShares(request, response) {
  console.log('%s: Processing %s', new Date().toISOString(), request.path)

  try {
    const result = await listSharesImpl()
    if (result) {
      response.status(200).json(result)
    } else {
      response.status(500).json({
        message: 'Service error'
      })
    }
  } catch (e) {
    response.status(500).json({
      message: e.message
    })
  }
}

// File functions
async function listFiles(request, response) {
  console.log('%s: Processing %s', new Date().toISOString(), request.path)

  const shareName = request.query.share

  if (isNull(shareName)) {
    return response.status(400).json({
      message: 'Missing parameters'
    })
  }

  try {
    const exists = await shareExists(shareName)
    if (!exists) {
      return response.status(404).json({
        message: `Share ${shareName} does not exist`
      })
    }
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }

  try {
    const result = await listFilesImpl(shareName)
    if (result) {
      response.status(200).json(result)
    } else {
      response.status(500).json({
        message: 'Service error'
      })
    }
  } catch (e) {
    response.status(500).json({
      message: e.message
    })
  }
}

async function createFile(request, response) {
  const fileName = request.body.file
  const shareName = request.body.share

  console.log('%s: Processing %s %s %s', new Date().toISOString(), request.path, shareName, fileName)

  if (isNull(fileName) ||
    isNull(shareName)) {
    return response.status(400).json({
      message: 'Missing parameters'
    })
  }

  try {
    const exists = await shareExists(shareName)
    if (!exists) {
      return response.status(404).json({
        message: `Share ${shareName} does not exist`
      })
    }
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }

  try {
    const exists = await fileExists(shareName, fileName)
    if (exists) {
      return response.status(409).json({
        message: 'File already exists'
      })
    }
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }

  try {
    const result = await createFileImpl(shareName, fileName) // eslint-disable-line
    const exists = await fileExists(shareName, fileName)
    if (exists) {
      return response.status(201).json({
        message: 'File created'
      })
    }
    return response.status(500).json({
      message: 'File creation service error'
    })
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
}

async function dropFile(request, response) {
  const fileName = request.body.file
  const shareName = request.body.share

  console.log('%s: Processing %s %s %s', new Date().toISOString(), request.path, shareName, fileName)

  if (isNull(fileName) ||
    isNull(shareName)) {
    return response.status(400).json({
      message: 'Missing parameters'
    })
  }

  try {
    const exists = await shareExists(shareName)
    if (!exists) {
      return response.status(404).json({
        message: `Share ${shareName} does not exist`
      })
    }
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }

  try {
    const exists = await fileExists(shareName, fileName)
    if (!exists) {
      return response.status(404).json({
        message: 'File does not exist'
      })
    }
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }

  try {
    const result = await dropFileImpl(shareName, fileName) // eslint-disable-line
    const exists = await fileExists(shareName, fileName)
    if (!exists) {
      return response.status(201).json({
        message: 'File dropped'
      })
    }
    return response.status(500).json({
      message: 'File drop service error'
    })
  } catch (e) {
    return response.status(500).json({
      message: e.message
    })
  }
}

async function healthCheck(request, response) {
  console.log('%s: Processing %s', new Date().toISOString(), request.path)

  try {
    const result = await listSharesImpl() // eslint-disable-line
    response.status(200).json({
      message: 'Ok'
    })
  } catch (e) {
    response.status(500).json({
      message: e.message
    })
  }
}

module.exports = {
  listFiles,
  createFile,
  dropFile,
  listShares,
  createShare,
  dropShare,
  healthCheck
}
