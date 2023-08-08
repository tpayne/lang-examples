const { ShareServiceClient, StorageSharedKeyCredential } = require('@azure/storage-file-share')
const { DefaultAzureCredential } = require('@azure/identity')

const { getProperty, isPathDir,
  getDirectories, 
  getFileName,
  getDirectoryName, 
  isNull,
  getParentDir } = require('./utils.js')

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
  const isDir = isPathDir(fileName)

  var ret = false
  var dirs = getDirectories(fileName)
  var fileN = getFileName(fileName)

  const shareClient = shareClientService.getShareClient(shareName)

  if (isDir) {
    const directoryClient = shareClient.getDirectoryClient(fileName)
    ret = await directoryClient.exists()
  } else {
    let dirN = getDirectoryName(fileName)

    const directoryClient = shareClient.getDirectoryClient(dirN)
    if (await directoryClient.exists()) {
      const fileClient = directoryClient.getFileClient(fileN)
      ret = await fileClient.exists()
    }
  }
  return ret
}

async function createDirName(shareClient, dirName) {
  let dirN = (dirName.slice(-1) === "/") ? dirName.substring(0, dirName.length - 1) : dirName
  const directoryClient = shareClient.getDirectoryClient(dirN)
  await directoryClient.createIfNotExists({
    onResponse: (result) => {
      //console.debug(util.inspect(result, false, null, true))
      return (result)
    }
  })
}

async function createFileName(shareClient, fileName) {
  let dirN = getDirectoryName(fileName)
  let fileN = getFileName(fileName)
  let directoryClient = shareClient.getDirectoryClient(dirN)

  if (!isNull(dirN) && !(await directoryClient.exists())) {
    await createDirName(shareClient, dirN)
  }

  directoryClient = null
  directoryClient = shareClient.getDirectoryClient(dirN)

  await directoryClient.createFile(fileN, 0, {
    onResponse: (fileClient, result) => {
      //console.debug(util.inspect(result, false, null, true))
      return (result)
    }
  })
}

async function deleteDirName(shareClient,dirName) {
  const directoryClient = shareClient.getDirectoryClient(dirName)
  await directoryClient.deleteIfExists(dirName)
}

async function deleteFileName(shareClient,dirName,fileName) {
  const directoryClient = shareClient.getDirectoryClient(dirName)
  await directoryClient.deleteFile(fileName)
}

async function listFilesRecursive(shareClient,parent,child,files) {
  let directory = ""
  if (isNull(parent) && !isNull(child)) {
    directory += `${child}/`
  } else if (isNull(parent) && isNull(child)) {
  } else {
    directory += `${parent}${child}/`
  }

  let directoryClient = shareClient.getDirectoryClient(directory)
  let queryFiles = directoryClient.listFilesAndDirectories();
  
  //console.debug("Scanning (%s) (%s) (%s)", parent, child, directory)

  if (!queryFiles) {
    return files
  }

  for await (const file of queryFiles) {
    files.push({
      name: file.name,
      kind: file.kind,
      fileId: file.fileId,
      parent: (isNull(directory)) ? "/" : directory,
      fullPath: `${directory}${file.name}`
    })
    if (file.kind === "directory") {
      files = await listFilesRecursive(shareClient, directory, file.name, files)
    }
  }
  return files
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
    console.error('%s: List error - %s', new Date().toISOString(), e.message)
    return null
  }
}

async function createShareImpl(shareName) {
  const shareClientService = await connect()

  await shareClientService.createShare(shareName, {
    onResponse: (shareDetails, shareResponse) => {
      //console.debug(util.inspect(shareResponse, false, null, true))
      return(shareResponse)
    }
  })
}

async function dropShareImpl(shareName) {
  const shareClientService = await connect()

  await shareClientService.deleteShare(shareName, {
    onResponse: (shareDetails, shareResponse) => {
      //console.debug(util.inspect(shareResponse, false, null, true))
      return(shareResponse)
    }
  })
}

// File implementors
async function listFilesImpl(shareName) {
  const serviceClient = await connect()
  const shareClient = serviceClient.getShareClient(shareName) 

  let p = []
  p = await listFilesRecursive(shareClient,"","",p)
  return p
}

async function createFileImpl(shareName, fileName) {
  const shareClientService = await connect()
  const shareClient = shareClientService.getShareClient(shareName)

  let dirs = getDirectories(fileName)
  let noDirs = dirs.length
  let parent = ""

  for (const child of dirs) {
    noDirs--
    if (noDirs) {
      parent += `${child}/`
    }
    if (!isNull(child)) {
      if (noDirs) {
        await createDirName(shareClient,parent)
      } else {
        await createFileName(shareClient,fileName)
      }
    }
  }
}

async function dropFileImpl(shareName, fileName) {
  const shareClientService = await connect()
  const isDir = await isPathDir(fileName)
  const shareClient = shareClientService.getShareClient(shareName)
  
  if (isDir) {
    await deleteDirName(shareClient,fileName)
  } else {
    const dirN = getDirectoryName(fileName)
    const fileN = getFileName(fileName)
    await deleteFileName(shareClient,dirN,fileN)
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
