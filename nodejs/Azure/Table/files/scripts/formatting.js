async function blankAll () {
  const responseContainer = document.getElementById('response')
  const errorContainer = document.getElementById('error')
  $('#printData').empty()
  responseContainer.innerText = ''
  errorContainer.innerText = ''
}

async function displayResponse (response, error = false) {
  await blankAll()
  const jsonResponse = await response.json()
  const responseContainer = document.getElementById('response')
  const errorContainer = document.getElementById('error')
  if (error) {
    errorContainer.innerText = JSON.stringify(jsonResponse, null, 2)
  } else {
    responseContainer.innerText = JSON.stringify(jsonResponse, null, 2)
  }
}

async function displayError (response) {
  displayResponse(response, true)
}

async function runCmd (cmd, tableData = false) {
  let response = null
  try {
    await blankAll()
    const url = window.location.pathname + window.location.search
    response = await fetch(url + cmd)
    if (response.ok) {
      if (tableData) {
        const jsonResponse = await response.json()
        await buildTable('#printData', jsonResponse)
      } else {
        displayResponse(response)
      }
    } else {
      displayError(response)
    }
  } catch (error) {
    displayError(response)
  }
}

async function buildTable (tableName, data) {
  $(tableName).empty()
  const columns = await addColumnHeaders(tableName, data)
  for (let i = 0; i < data.length; i++) {
    const row = $('<tr/>')
    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
      let cellValue = data[i][columns[colIndex]]
      if (cellValue == null) cellValue = ''
      row.append($('<td/>').html(cellValue))
    }
    $(tableName).append(row)
  }
}

async function addColumnHeaders (tableName, data) {
  const columnSet = []
  const headerTr$ = $('<tr/>')

  for (let i = 0; i < data.length; i++) {
    const rowHash = data[i]
    for (const key in rowHash) {
      if ($.inArray(key, columnSet) == -1) {
        columnSet.push(key)
        headerTr$.append($('<th/>').html(key))
      }
    }
  }
  $(tableName).append(headerTr$)
  return columnSet
}
