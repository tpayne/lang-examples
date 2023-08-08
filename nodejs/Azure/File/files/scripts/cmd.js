async function getInfo() {
  runCmd('info')
}

async function getVersion() {
  runCmd('version')
}

async function healthCheck() {
  runCmd('api/shares/healthz')
}

async function getShares() {
  runCmd('api/shares/list', true);
}
