async function getInfo() {
  runCmd('info')
}

async function getVersion() {
  runCmd('version')
}

async function healthCheck() {
  runCmd('api/files/healthz')
}

async function getFiles() {
  runCmd('api/files/list', true);
}

