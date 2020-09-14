//-------------------------------------------------------------------- Delete Clients functions -----------------------------------------------------------

/**
 * Function that deletes a client
 *
 * @param {string} clientID: the id of the client that we are deleting
 * @param {object} matters: dictionary of matters, allows us to get matter types for deletion
 * @return {object} [clientID, parentFolderIDs] - parentFolderIDs: a dictionary of {folderID: [parentFolderIDs]} to be used for undoing deletions
 *                                              - clientID: the id of the deletedClient so it can be accessed in the onSuccessFunction
 */
function deleteClient(clientID, matters) {
  // get the necessary information to retrieve the client
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");
  const matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  const matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  var params = ["ID", [clientID]];
  // delete the client itself from sheets
  var deletedClient = accessDatabase("DELETE", clientSSID, clientSheetName, params)[clientID];
  // delete the client folder
  var parentFolderIDs = {};
  parentFolderIDs[deletedClient["FolderID"]] = deleteFolder(deletedClient["FolderID"]);

  // Delete all the clients notes from sheets
  var noteIDs = deletedClient["NoteID"];
  if (noteIDs) {
    noteIDs = noteIDs.split(',');
    params = ["ID", noteIDs];
    accessDatabase("DELETE", noteSSID, noteSheetName, params);
  }

  // Delete all the clients matters from sheets, as well as the matter types
  var matterIDs = deletedClient["MatterID"];
  var matter, matterTypeID, matterTypeName;
  var matterTypeDict = {}; // dictionary of {typeName: [corresponding matter ids]}
  if (matterIDs) {
    matterIDs = matterIDs.split(',');
    // populate a dictionary to be used to delete matter types by their names and delete the matter folders
    for (var i = 0; i < matterIDs.length; i++) {
      matter = matters[matterIDs[i]];
      matterTypeID = matter["TypeID"];
      matterTypeName = matter["TypeName"];
      if (matterTypeDict[matterTypeName]) { // this type name already exists in the dictionary
        matterTypeDict[matterTypeName].push(matterTypeID);
      } else {
        matterTypeDict[matterTypeName] = [matterTypeID];
      }
      parentFolderIDs[matter["FolderID"]] = deleteFolder(matter["FolderID"]);
    }
    // delete the matter types
    var typeNames = Object.keys(matterTypeDict);
    for (var i = 0; i < typeNames.length; i++) {
      params = ["ID", matterTypeDict[typeNames[i]]];
      accessDatabase("DELETE", matterSSID, typeNames[i], params);
    }
    // delete the matters themself
    params = ["ID", matterIDs];
    accessDatabase("DELETE", matterSSID, matterSheetName, params);
  }
  return [clientID, JSON.stringify(parentFolderIDs)];
}


/**
 * Function that brings back a recently deleted client
 *
 * @param {string} deletedClientID: the id of the client that we are bring back
 * @param {object} matters: dictionary of matters, allows us to get matter types for deletion
 * @param {object} parentFolderIdDs: a dictionary of {folderID: [parentFolderIDs]} to be used for undoing deletions
 * @return {object} returns the client that was just recovered
 */
function undoDeleteClient(deletedClientID, matters, parentFolderIDs) {
  // Get the necessary ssIDs and sheetNames
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");
  const matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  const matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  // undo delete client
  var params = ["ID", [deletedClientID]];
  var client = accessDatabase("UNDO_DELETE", clientSSID, clientSheetName, params)[0];
  // recover the folders that were deleted
  Logger.log("Parent Folder IDs: " + parentFolderIDs);
  var folderIDs = Object.keys(parentFolderIDs);
  for (var i = 0; i < folderIDs.length; i++) {
    undoDeleteFolder(folderIDs[i], parentFolderIDs[folderIDs[i]]);
  }
  // undo delete notes
  var deletedNoteIDs = client["NoteID"]
  if (deletedNoteIDs) {
    deletedNoteIDs = deletedNoteIDs.split(',');
    params = ["ID", deletedNoteIDs];
    accessDatabase("UNDO_DELETE", noteSSID, noteSheetName, params);
  }

  // undo delete of all the clients matters from sheets, as well as the matter types
  var matterIDs = client["MatterID"];
  var matter, matterTypeID, matterTypeName;
  var matterTypeDict = {}; // dictionary of {typeName: [corresponding matter ids]}
  if (matterIDs) {
    matterIDs = matterIDs.split(',');
    // populate a dictionary to be used to undo delete matter types by their names
    for (var i = 0; i < matterIDs.length; i++) {
      matter = matters[matterIDs[i]];
      matterTypeID = matter["TypeID"];
      matterTypeName = matter["TypeName"];
      if (matterTypeDict[matterTypeName]) { // this type name already exists in the dictionary
        matterTypeDict[matterTypeName].push(matterTypeID);
      } else {
        matterTypeDict[matterTypeName] = [matterTypeID];
      }
    }
    // undo the delete of the matter types
    var typeNames = Object.keys(matterTypeDict);
    for (var i = 0; i < typeNames.length; i++) {
      params = ["ID", matterTypeDict[typeNames[i]]];
      accessDatabase("UNDO_DELETE", matterSSID, typeNames[i], params);
    }
    // undo the delete of the matters themselves
    params = ["ID", matterIDs];
    accessDatabase("UNDO_DELETE", matterSSID, matterSheetName, params);

    return JSON.parse(JSON.stringify(client));
  }
}

// ------------------------------------------------------------ Proposing Clients ----------------------------------------------------------

/**
 * Function to propose a client in the database
 *
 * @param {object} client: dictionary containing client information
 * @return {object} returns a list of the row that it just created [client]
 *                   each of these rows is a dictionary {field: data}
 */
function proposeClient(client) {
  // create a folder for the proposed client in the In review folder and fill it with any associated contact folders
  var folderID = createClientFolder(client);
  // store folder ID in dictionary
  client["FolderID"] = folderID;
  // get the consts for sheetnamess and ssid
  const ssID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  // add the client
  var params = [[client]];
  var createOutput = accessDatabase("CREATE", ssID, clientSheetName, params);
  var newClient = Object.values(createOutput)[0];
  Logger.log("new client: " + client["ClientName"]);
  return [JSON.parse(JSON.stringify(newClient))];
}


// ------------------------------------------------------ Editing Clients ---------------------------------------------------------------
/**
 * Function to edit a client
 * 
 * @param {object} client: dictionary holding information that we wish to use to update the client with the specified id
 * @return {object} returns a list of the rows that it just updated [updatedClient] each of these rows is a dictionary {field: data}
 */
function editClient(client) {
  // update folder with new client information
  updateClientFolder(client);
  // get the consts for sheetnamess and ssid
  const ssID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  // update the client
  var params = [client];
  var updateOutput = accessDatabase("UPDATE", ssID, clientSheetName, params);
  var updatedClient = Object.values(updateOutput)[0];

  // return the appropriate list
  return [JSON.parse(JSON.stringify(updatedClient))];
}
