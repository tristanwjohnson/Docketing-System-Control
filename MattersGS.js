/*
 * Function to add a matter type.
 * Creates a new sheet in the matters spreadsheet of the same name as this type.
 *
 * @param {object} fieldList: a list holding the title of a new matter type(index 0) and all the field names to be columns in the sheet
 */
function addTypeToSheet(fieldList) {
  // Get the spreadsheet ID, title of the new type (sheet name), and field/column names
  var ssID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  var sheetName = fieldList[0];
  var colNames = fieldList.slice(1, fieldList.length);
  // Call the server to actually create and populate this sheet
  sheetName = accessDatabase("CREATE_SHEET", ssID, sheetName, [colNames])
  return [sheetName, fieldList.slice(1, fieldList.length)];
}

/**
 * Function to close a matter
 * 
 * @param {object} matter: the matter we wish to close
 */
function closeMatter(matter) {
  // set matter closed date
  matter["DateClosed"] = new Date();
  var matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  var matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  // call the server to close the matter
  var closedMatter = Object.values(accessDatabase("UPDATE", matterSSID, matterSheetName, [matter]))[0];
  return JSON.parse(JSON.stringify(closedMatter));
}

/**
 * Function to reopen a matter
 * 
 * @param {object} matter: the matter we wish to reopen
 */
function reopenMatter(matter) {
  // remove matter closed date
  delete matter["DateClosed"];
  var matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  var matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  // call the server to update and reopen the matter
  var reopenedMatter = Object.values(accessDatabase("UPDATE", matterSSID, matterSheetName, [matter]))[0];
  return JSON.parse(JSON.stringify(reopenedMatter));
}

/**
 * Function to add a matter (and its corresponding type information) to the database.
 * Also handles folder management and client association.
 *
 * @param {object} matterInfo: dictionary containing general matter information
 * @param {object} matterTypeInfo: dictionary containing information specific to the matter type
 * @param {object} clients: dictionary of dictionaries containing client information
 * @return {object} returns a list of the dictionaries of the added rows [{matter}, {matterType}, {client}]
 */
function addMatter(matterInfo, matterTypeInfo, clients) {
  // Get the ssIDs and sheetNames
  var matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  var clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  var matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  var matterTypeSheetName = matterInfo["TypeName"];
  var clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  // get associated client
  var clientID = matterInfo["ClientID"];
  var client = clients[clientID];
  //create matter folder and assign to client
  var folderID = createMatterFolder(matterInfo, client);
  matterInfo["FolderID"] = folderID;

  // Add the matterTypeInfo to its respective sheet and get its unique id
  var matterTypeRow = Object.values(accessDatabase("CREATE", matterSSID, matterTypeSheetName, [[matterTypeInfo]]))[0];

  // Add this unique id to the matterInfo
  matterInfo["TypeID"] = matterTypeRow["ID"];

  // Add the matter to the matter sheet and get its unique id
  var matterRow = Object.values(accessDatabase("CREATE", matterSSID, matterSheetName, [[matterInfo]]))[0];

  // Update the appropriate client so that it includes this matter association
  if (client["MatterID"] == null) {
    client["MatterID"] = matterRow["ID"];
  } else {
    client["MatterID"] += "," + matterRow["ID"];
  }
  var clientRow = Object.values(accessDatabase("UPDATE", clientSSID, clientSheetName, [client]))[0];


  return [JSON.parse(JSON.stringify(matterRow)), JSON.parse(JSON.stringify(matterTypeRow)), JSON.parse(JSON.stringify(clientRow))];
}


/**
 * Function to edit a matter (and its corresponding type information) in the database.
 * Also handles folder management and client association.
 *
 * @param {object} matterInfo: dictionary containing general matter information
 * @param {object} matterTypeInfo: dictionary containing information specific to the matter type
 * @param {oldClientId} oldClientId: the id of the previous client that this matter was associated with
 * @param {object} clients: dictionary of dictionaries containing client information
 * @return {object} returns a list of the dictionaries of the added rows [{matter}, {matterType}, {old client}, {new client}]
 */
function editMatter(matterInfo, matterTypeInfo, oldClientId, clients) {
  // Get the ssIDs and sheetNames
  var matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  var clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  var matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  var matterTypeSheetName = matterInfo["TypeName"];
  var clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  // get associated client
  var clientID = matterInfo["ClientID"];
  var newClient = clients[clientID];
  var oldClient = clients[oldClientId];
  //update matter folder
  updateMatterFolder(matterInfo, oldClient, newClient);

  // update the matterTypeInfo to its respective sheet and get its unique id
  var matterTypeRow = Object.values(accessDatabase("UPDATE", matterSSID, matterTypeSheetName, [matterTypeInfo]))[0];

  // update the matter to the matter sheet and get its unique id
  var matterRow = Object.values(accessDatabase("UPDATE", matterSSID, matterSheetName, [matterInfo]))[0];


  if (oldClientId != clientID) { // we want to remove matter from the old client and add to new matter
    // Update the appropriate client so that it includes this matter association
    if (newClient["MatterID"] == null) {
      newClient["MatterID"] = matterRow["ID"];
    } else {
      newClient["MatterID"] += "," + matterRow["ID"];
    }
    //remove matter ID from old client
    var oldMatterList = oldClient["MatterID"].split(",");
    var updatedMatterList = oldMatterList.filter(function (id) { return (id != this); }, matterInfo["ID"]);
    //update object dictionary with new list of noteID FKs
    oldClient["MatterID"] = updatedMatterList.join(',');
    newClient = Object.values(accessDatabase("UPDATE", clientSSID, clientSheetName, [newClient]))[0];
    oldClient = Object.values(accessDatabase("UPDATE", clientSSID, clientSheetName, [oldClient]))[0];
  }

  return [JSON.parse(JSON.stringify(matterRow)), JSON.parse(JSON.stringify(matterTypeRow)), JSON.parse(JSON.stringify(oldClient)), JSON.parse(JSON.stringify(newClient))];
}

/**
 * Function to delete a matter (and its corresponding type information) in the database.
 * Also handles folder management and client association.
 *
 * @param {object} matter: dictionary containing matter information
 * @param {object} client: dictionary containing client information
 * @return {object} returns a list with three dictionaries and a list of IDs [deleted matter, deleted matter type, deleted client, parent Folder IDs]
 */
function deleteMatter(matter, client) {
  // get needed IDs
  var matterID = matter["ID"];
  var matterTypeID = matter["TypeID"];
  // get sheet info
  const matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  const matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  const matterTypeSheetName = matter["TypeName"];
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");

  // delete the matter folder
  var parentFolderIDs = deleteFolder(matter["FolderID"]);

  var params = ["ID", [matterID]];
  // delete matter
  var deletedMatter = accessDatabase("DELETE", matterSSID, matterSheetName, params)[matterID];

  // delete matter type info
  params = ["ID", [matterTypeID]];
  var deletedMatterType = accessDatabase("DELETE", matterSSID, matterTypeSheetName, params)[matterTypeID];

  // delete matter notes
  var noteIDs = deletedMatter["NoteID"];
  if (noteIDs) {
    noteIDs = noteIDs.split(',');
    params = ["ID", noteIDs];
    accessDatabase("DELETE", noteSSID, noteSheetName, params);
  }
  // update client without matter id

  //remove matter ID from old client
  var oldMatterList = client["MatterID"].split(",");
  var newMatterList = oldMatterList.filter(function (id) { return (id != this); }, matter["ID"]);
  //update object dictionary with new list of noteID FKs
  client["MatterID"] = newMatterList.join(',');
  var updatedClient = Object.values(accessDatabase("UPDATE", clientSSID, clientSheetName, [client]))[0];

  return [JSON.parse(JSON.stringify(deletedMatter)), JSON.parse(JSON.stringify(deletedMatterType)), JSON.parse(JSON.stringify(updatedClient)), parentFolderIDs];
}

/** 
 * Function to undo the deletion of the specified matter and put it back into the specified parent folders
 *
 * @param {string} matterID: the id of the matter being recovered
 * @param {string} parentFolderIDs: the ids of all of the parent folders of the matter prior to its deletion
 * @param {object} client: dictionary representing this matter's client
 * @return {object} returns the following list: [matter, matterType, updatedClient]
 */
function undoDeleteMatter(matterID, parentFolderIDs, client) {
  // get sheet info
  const matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  const matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");

  // undo delete matter
  var params = ["ID", [matterID]];
  var matter = accessDatabase("UNDO_DELETE", matterSSID, matterSheetName, params)[0];
  // undo delete matter type
  var matterTypeID = matter["TypeID"];
  var typeName = matter["TypeName"];
  params = ["ID", [matterTypeID]];
  var matterType = accessDatabase("UNDO_DELETE", matterSSID, typeName, params)[0];
  // reinclude this matter in the client
  if (client["MatterID"]) {
    client["MatterID"] += "," + matterID;
  } else {
    client["MatterID"] = matterID;
  }
  params = ["ID", [client["ID"]]];
  var updatedClient = accessDatabase("UPDATE", clientSSID, clientSheetName, [client]);
  // undo delete matter folder
  undoDeleteFolder(matter["FolderID"], parentFolderIDs);
  // undo delete notes
  var deletedNoteIDs = matter["NoteID"]
  if (deletedNoteIDs) {
    deletedNoteIDs = deletedNoteIDs.split(',');
    params = ["ID", deletedNoteIDs];
    accessDatabase("UNDO_DELETE", noteSSID, noteSheetName, params);
  }
  // return the appropriate values
  return [JSON.parse(JSON.stringify(matter)), JSON.parse(JSON.stringify(matterType)), JSON.parse(JSON.stringify(updatedClient))];

}