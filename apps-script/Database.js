/**
 * Returns a sheet object.
 *
 * @param {string} tableName
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(tableName) {
  const sheet = getSpreadsheet().getSheetByName(tableName);

  if (!sheet) {
    throw new Error(`Table "${tableName}" does not exist.`);
  }

  return sheet;
}

/**
 * Returns every row from a sheet as an array of objects.
 *
 * @param {string} tableName
 * @returns {Object[]}
 */
function getTable(tableName) {

  const values = getSheet(tableName).getDataRange().getValues();

  if (values.length === 0) {
    return [];
  }

  const headers = values.shift();

  return values.map(row => {

    const object = {};

    headers.forEach((header, index) => {
      object[header] = row[index];
    });

    return object;

  });

}