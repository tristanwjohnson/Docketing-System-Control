/**
 * Function to generate a report for a given client
 * This entails creating a google sheet in the client's directory
 *
 * @param {object} client: the client we wish to create a report for
 * @param {object} matters: the client's list of matters 
 * @param {object} matterTypes: info regarding matter types
 * @param {object} matterTypeData: data for specific matter types
 * 
 * @return {object} return an infolist with information for front end: [ client ID, report spreadsheet ID]
 */
function generateClientReport(client, matters, matterTypes, matterTypeData) {
  // create the new spreadsheet in the client folder
  // create the name of the spreadsheet
  var date = new Date();
  var ssName = client["DocketCode"] + " Docket Report " + date.toDateString();
  // create the spreadsheet
  var spreadsheet = SpreadsheetApp.create(ssName);
  // move the spreadsheet into the appropriate folder (the given client's reports folder)
  var clientFolder = DriveApp.getFolderById(client["FolderID"]);
  var reportFolder = clientFolder.getFoldersByName("Reports").next();
  var ssFile = DriveApp.getFileById(spreadsheet.getId());
  ssFile.moveTo(reportFolder);
  // Create a dictionary to hold all of the data we wish to input
  var clientMatterTypes = {}; // dictionary of the following format: {matterTypeName: matterTypeData[][]}
  var matterTypeID, matterTypeName, matter, matterType, matterTypeColumnNames;
  // iterate through the matters to determine which set they belong
  for (var i = 0; i < matters.length; i++) {
    matter = matters[i];
    matterTypeID = matter["TypeID"];
    matterTypeName = matter["TypeName"];
    matterType = matterTypeData[matterTypeID];
    matterTypeColumnNames = matterTypes[matterTypeName];
    // if this matter type name is already in the dictionary, just append the necessary info as a row
    if (Object.keys(clientMatterTypes).includes(matterTypeName)) {
      clientMatterTypes[matterTypeName].push(formatMatterInfo_(matter, matterType, matterTypeColumnNames));
    } else { // if not, create a dictionary entry for this matter type name
      clientMatterTypes[matterTypeName] = [formatMatterInfo_(matter, matterType, matterTypeColumnNames)];
    }
  }
  // Create each sheet and populate it with the appropriate data
  var matterTypeNames = Object.keys(clientMatterTypes);
  var typeSheet, sheetName, indexOfLastDash, data, firstRow;
  // get default sheet always created when a spreadsheet is created to be overwritten
  var firstSheet = spreadsheet.getSheetByName("Sheet1");
  for (var i = 0; i < matterTypeNames.length; i++) {
    // remove the -(prefix) from the end of each type name when creating the sheet name
    sheetName = matterTypeNames[i];
    indexOfLastDash = sheetName.length - sheetName.split("").reverse().indexOf("-") - 1;
    sheetName = sheetName.slice(0, indexOfLastDash);
    if (i == 0) { // set the default sheet to be our first typesheet
      typeSheet = firstSheet.setName(sheetName);
    } else { // create a new sheet for each extra matter type
      typeSheet = spreadsheet.insertSheet(sheetName);
    }
    // format data to be added to each sheet
    // create the header row
    firstRow = ["Docket Number"];
    firstRow = firstRow.concat(matterTypes[matterTypeNames[i]]);
    // put the rest of information to be added to the sheet in data
    data = [firstRow];
    data = data.concat(clientMatterTypes[matterTypeNames[i]]);
    typeSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    // format header row
    typeSheet.setFrozenRows(1);
    typeSheet.getRange(1, 1, 1, data[0].length).setFontWeight("bold");
  }
  return [client["ID"], ssFile.getId()];
}

/**
 * Helper function that returns the matter and its info to be added to the sheet 
 * The info we get from matter type matches the column names in the matterTypeColumnNames list
 * 
 * @param {object} matter: dictionary of matter to be placed in sheet
 * @param {object} matterType: mater type data for the given matter
 * @param {object} matterTypeColumnNames: headdings for the type sheet - for formmatting output
 * 
 * @return {object} array formatted to be a row in the report sheet in the following format: [DocketNo, infoFromMatterType...]
 */
function formatMatterInfo_(matter, matterType, matterTypeColumnNames) {
  var matterInfo = [matter["DocketNo"]];
  for (var i = 0; i < matterTypeColumnNames.length; i++) {
    matterInfo.push(matterType[matterTypeColumnNames[i]]);
  }
  return matterInfo;
}