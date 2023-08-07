const { ShareServiceClient, StorageSharedKeyCredential } = require('@azure/storage-file-share')
const { DefaultAzureCredential } = require('@azure/identity')
const { getProperty, isPathDir } = require('./utils.js')
const { table } = require('console')
const util = require('util')
//const { AzureNamedKeyCredential } = require('@azure/core-auth')

const conmap = new Map()

// Utility functions
async function getStorageAccount() {
  let storageAccount = null
  storageAccount = await getProperty('storage-account')
  if (!storageAccount) {
    storageAccount = process.env.STORAGE_ACCOUNT
  }
  return storageAccount
}

async function getStorageAccountKey() {
  let storageAccountKey = null
  storageAccountKey = await getProperty('storage-account-key')
  if (!storageAccountKey) {
    storageAccountKey = process.env.STORAGE_ACCOUNT_KEY
  }
  return storageAccountKey
}

async function getUrl(storageAccount) {
  return `https://${storageAccount}.file.core.windows.net`
}

async function connect() {
  let credential = null
  let shareClientService = null
  const storageAccount = await getStorageAccount()
  const storageAccountKey = await getStorageAccountKey()

  if (conmap.has(storageAccount)) {
    return conmap.get(storageAccount)
  }

  try {
    const fileUrl = await getUrl(storageAccount)

    if (storageAccountKey) {
      console.log('%s: Key logging into %s', new Date().toISOString(), fileUrl)
      credential = new StorageSharedKeyCredential(storageAccount, storageAccountKey)
    } else {
      console.log('%s: Default logging into %s', new Date().toISOString(), fileUrl)
      credential = new DefaultAzureCredential()
    }
    shareClientService = new ShareServiceClient(fileUrl, credential)
    console.log('%s: Logged onto ', new Date().toISOString(), fileUrl)
  } catch (e) {
    console.error('%s: Error - Unable to login to Azure %s',
      new Date().toISOString(), e.message)
    return null
  }

  conmap.set(storageAccount, shareClientService)
  return shareClientService
}

// Helper functions
async function shareExists(shareName) {
  const shareClientService = await connect()
  const shareClient = shareClientService.getShareClient(shareName)
  return await shareClient.exists()
}

async function fileExists(shareName, fileName) {
  const shareClientService = await connect()
  const shareClient = shareClientService.getShareClient(shareName)
  return await shareClient.exists()
}

// Share Implementors
async function listSharesImpl() {
  try {
    const shareClientService = await connect()
    let queryShare = shareClientService.listShares()
    let p = []
    if (!queryShare) {
      return p
    }
    for await (const share of queryShare) {
      p.push({
        name: share.name,
        accessTierChangeTime: share.properties.accessTierChangeTime,
        lastModified: share.properties.lastModified,
        quota: share.properties.quota,
        accessTier: share.properties.accessTier,
        leaseStatus: share.properties.leaseStatus
      })
    }
    return p
  } catch (e) {
    console.log('%s: List error - %s', new Date().toISOString(), e.message)
    return null
  }
}

async function createShareImpl(shareName) {
  const shareClientService = await connect()

  await shareClientService.createShare(shareName, {
    onResponse: (shareDetails, shareResponse) => {
      console.log(util.inspect(shareResponse, false, null, true))
    }
  })
}

async function dropShareImpl(shareName) {
  const shareClientService = await connect()

  await shareClientService.deleteShare(shareName, {
    onResponse: (shareDetails, shareResponse) => {
      console.log(util.inspect(shareResponse, false, null, true))
    }
  })
}

// File implementors
async function listFilesImpl(shareName) {
  
  try {
    const shareClientService = await connect()
    const directoryClient = serviceClient.getShareClient(shareName).getDirectoryClient(directoryName)

    let queryShare = directoryClient.listFilesAndDirectories();
    let p = []

    if (!queryShare) {
      return p
    }
    for await (const share of queryShare) {
      p.push(share)
    }
    return p
  } catch (e) {
    console.log('%s: List error - %s', new Date().toISOString(), e.message)
    return null
  }
}

async function createFileImpl(shareName, fileName) {
  const shareClientService = await connect()
  const isDir = await isPathDir(fileName)
  const shareClient = shareClientService.getShareClient(shareName)

  if (isDir) {
    const directoryClient = shareClient.getDirectoryClient(shareName)
    await directoryClient.create(fileName, {
      onResponse: (result) => {
        console.log(util.inspect(result, false, null, true))
        return (result)
      }
    })
  } else {
    const fileClient = shareClient.getShareFileClient(shareName)
    await fileClient.create(fileName, {
      onResponse: (result) => {
        console.log(util.inspect(result, false, null, true))
        return (result)
      }
    })
  }
}

async function dropFileImpl(shareName, fileName) {
  const shareClientService = await connect()
  const isDir = await isPathDir(fileName)
  const shareClient = shareClientService.getShareClient(shareName)

  if (isDir) {
    const directoryClient = shareClient.getDirectoryClient(shareName)
    await directoryClient.delete(fileName, {
      onResponse: (result) => {
        console.log(util.inspect(result, false, null, true))
        return (result)
      }
    })
  } else {
    const fileClient = shareClient.getShareFileClient(shareName)
    await fileClient.delete(fileName, {
      onResponse: (result) => {
        console.log(util.inspect(result, false, null, true))
        return (result)
      }
    })
  }
}

// Signal handlers...
function signalHandler(signal) {
  console.log('Killing process and shutting down')
  conmap.clear()
  process.exit()
}

process.on('SIGINT', signalHandler)
process.on('SIGTERM', signalHandler)
process.on('SIGQUIT', signalHandler)

module.exports = {
  listFilesImpl,
  createFileImpl,
  dropFileImpl,
  listSharesImpl,
  createShareImpl,
  dropShareImpl,
  shareExists,
  fileExists
}
