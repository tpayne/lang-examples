async function getInfo() {
  runCmd('info')
}

async function getVersion() {
  runCmd('version')
}

async function healthCheck() {
  runCmd('api/tables/healthz')
}

async function getTables() {
  runCmd('api/tables/list', true);
}

async function createTable() {
  runCmd('api/tables/create');
}
