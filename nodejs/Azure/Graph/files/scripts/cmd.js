async function getInfo() {
  runCmd('info')
}

async function getVersion() {
  runCmd('version')
}

async function healthCheck() {
  runCmd('api/query/healthz')
}

async function getCount() {
  runCmd('api/query/list', true);
}

