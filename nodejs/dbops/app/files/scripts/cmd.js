async function getInfo() {
  runCmd('info')
}

async function getVersion() {
  runCmd('version')
}

async function healthCheck() {
  runCmd('healthz')
}

async function getOrders() {
  runCmd('orders', true);
}

async function getStock() {
  runCmd('stock', true);
}

async function getCustomers() {
  runCmd('customers', true);
}

async function getTestData() {
  runCmd('testData');
}

async function tableData() {
  runCmd('testData', true);
}
