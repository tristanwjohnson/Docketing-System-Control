/**
 * Function that delete notes from the database and removes their IDs from the object storing each note
 *
 * @param {Array} noteIDs: a list of noteIDs to be deleted
 * @param {object} object: a dictionary storing the (person/entity/client/matter?) who we want to remove the note FK from
 * @param {string} noteAssociation: a string to say what type(person/entity/client/matter?) object is
 * 
 * @return {object} returns the updated object (now missing the noteIDs)
 */
function deleteNote(noteIDs, object, noteAssociation) {
  // get the consts for sheetnamess and ssid
  const ssID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const sheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");
  var objectSSID, objectSheetName;
  // remove note from database
  var params = ["ID", noteIDs];
  var deletedNotes = accessDatabase("DELETE", ssID, sheetName, params);
  // remove ids from object passed in
  // pull the correct sheet to update
  if (noteAssociation == "person") {
    objectSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
    objectSheetName = PropertiesService.getScriptProperties().getProperty("personSheetName");
  } else if (noteAssociation == "entity") {
    objectSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
    objectSheetName = PropertiesService.getScriptProperties().getProperty("entitySheetName");
  } else if (noteAssociation == "client") {
    objectSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
    objectSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  } else if (noteAssociation == "matter") {
    objectSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
    objectSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  } else {
    Logger.log("Unable to remove this noteID from any existing type in the json data.");
  }
  // filter out deleted note ids from objects FKs
  var oldNoteList = object["NoteID"].split(",");
  var removedNoteSet = new Set(noteIDs);
  var newNoteList = oldNoteList.filter(function (id) { return (!removedNoteSet.has(id)); });
  //update object dictionary with new list of noteID FKs
  object["NoteID"] = newNoteList.join(',');
  // update sheet with new dictionary
  params = [object];
  var newObject = accessDatabase("UPDATE", objectSSID, objectSheetName, params)[object["ID"]];
  return JSON.parse(JSON.stringify(newObject));
}

/**
 * Function that creates a note from a note dictionary passed in
 *
 * @param {object} note: a dictionary storing the information that the user wishes to store in a note
 * @return {object} returns a dictionary holding the newly created note 
 */
function addNote(note) {
  // get the consts for sheetnamess and ssid
  const ssID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const sheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");
  // add the note to the sheet
  var params = [[note]];
  var createOutput = accessDatabase("CREATE", ssID, sheetName, params);
  var newNote = Object.values(createOutput)[0];
  return JSON.parse(JSON.stringify(newNote));
}

/**
 * Function to update the (person, client, matter, etc) by associating a note with it
 *
 * @param {string} noteID: ID of the note that we wish to associate with the object
 * @param {object} dictionary: dictionary of the object we wish to associate the note with
 * @param {string} type: string representing the typ of object (ensures we use the correct sheet for updating)
 * 
 * @return {object} the object that was updated with the note association
 */
function addNoteAssociation(noteID, dictionary, type) {
  // get the vars for sheetnamess and ssid
  var ssID;
  var sheetName;
  if (type == "person") {
    ssID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
    sheetName = PropertiesService.getScriptProperties().getProperty("personSheetName");
  } else if (type == "entity") {
    ssID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
    sheetName = PropertiesService.getScriptProperties().getProperty("entitySheetName");
  } else if (type == "client") {
    ssID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
    sheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  } else if (type == "matter") {
    ssID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
    sheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  } else {
    Logger.log("Type: " + type + " does not exist. so could not add note association");
    return;
  }
  // Add the noteID to the object dictionary
  if (dictionary["NoteID"]) {
    dictionary["NoteID"] += "," + noteID;
  } else {
    dictionary["NoteID"] = noteID;
  }
  // update the object in the database
  var params = [dictionary];
  var updateOutput = accessDatabase("UPDATE", ssID, sheetName, params);
  var updatedObject = Object.values(updateOutput)[0];
  return JSON.parse(JSON.stringify(updatedObject));
}

/**
 * Function that edits a note in the database
 *
 * @param {object} note: takes in the note to be edited
 * @return {object} returns the edited note
 */
function editNote(note) {
  // get the consts for sheetnamess and ssid
  const ssID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const sheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");
  // update the note
  var params = [note];
  var updateOutput = accessDatabase("UPDATE", ssID, sheetName, params);
  var updatedNote = Object.values(updateOutput)[0];
  // return the appropriate list
  return JSON.parse(JSON.stringify(updatedNote));
}