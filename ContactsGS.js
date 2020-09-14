//-------------------------------------------------------------------- Delete Contact functions -----------------------------------------------------------

/**
 * Function that deletes a client as well as the appropriate pointers from it
 *
 * @param {string} personID: the id of the person that we are deleting
 * @return {object} [clientID, parentFolderIDs] - parentFolderIDs: the ids of the person parent folders in drive - to be used for undo
 *                                              - personID: the id of the person so it can be accessed in the onSuccessFunction
 */
function deletePerson(personID) {
  // get the necessary information to retrieve the person
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const personSheetName = PropertiesService.getScriptProperties().getProperty("personSheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");
  var params = ["ID", [personID]];

  // delete the person itself from sheets
  var deletedPerson = accessDatabase("DELETE", clientSSID, personSheetName, params)[personID];

  // delete the person's folder
  var parentFolderIDs = deleteFolder(deletedPerson["FolderID"]);

  // Delete all the persons notes from sheets but leave their IDs in the person row
  var noteIDs = deletedPerson["NoteID"];
  if (noteIDs) {
    noteIDs = noteIDs.split(',');
    params = ["ID", noteIDs];
    accessDatabase("DELETE", noteSSID, noteSheetName, params);
  }
  return [personID, parentFolderIDs];
}

/**
 * Function that recovers a recently deleted person
 *
 * @param {string} deletedPersonID: the id of the person that we are recovering
 * @param {object} parentFolderIDs: the ids of the drive folders the person folder needs to be in 
 * @return {object} returns the person that was just recovered
 */
function undoDeletePerson(deletedPersonID, parentFolderIDs) {
  // Get the necessary ss and sheet info
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const personSheetName = PropertiesService.getScriptProperties().getProperty("personSheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");
  // call the server to undo the deletion
  var params = ["ID", [deletedPersonID]];
  var person = accessDatabase("UNDO_DELETE", clientSSID, personSheetName, params)[0];
  // undo delete person folder
  undoDeleteFolder(person["FolderID"], parentFolderIDs);
  // undo delete notes
  var deletedNoteIDs = person["NoteID"];
  if (deletedNoteIDs) {
    deletedNoteIDs = deletedNoteIDs.split(',');
    params = ["ID", deletedNoteIDs];
    accessDatabase("UNDO_DELETE", noteSSID, noteSheetName, params);
  }
  return JSON.parse(JSON.stringify(person));
}

/**
 * Function that deletes a entity as well as the appropriate pointers from it
 *
 * @param {string} entityID: the id of the entity that we are deleting
 * @return {object} [entityID, parentFolderIDs] - parentFolderIDs: the ids of the entity parent folders in drive - to be used for undo
 *                                              - entityID: the id of the entity so it can be accessed in the onSuccessFunction
 */
function deleteEntity(entityID) {
  // get the necessary information to retrieve the person
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const entitySheetName = PropertiesService.getScriptProperties().getProperty("entitySheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");
  var params = ["ID", [entityID]];

  // delete the entity from the server
  var deletedEntity = accessDatabase("DELETE", clientSSID, entitySheetName, params)[entityID]; // null check?

  // delete the entity folder
  var parentFolderIDs = deleteFolder(deletedEntity["FolderID"]);
  // Delete all the clients notes from sheets
  var noteIDs = deletedEntity["NoteID"];
  if (noteIDs) {
    noteIDs = noteIDs.split(',');
    params = ["ID", noteIDs];
    accessDatabase("DELETE", noteSSID, noteSheetName, params);
  }
  return [entityID, parentFolderIDs];
}

/**
 * Function that brings back a recently deleted Entity
 *
 * @param {string} deletedEntityID: the id of the entity that we are bring back
 * @param {object} parentFolderIDs: the ids of the drive folders the entity folder needs to be in 
 * @return {object} returns the entity that was just recovered
 */
function undoDeleteEntity(deletedEntityID, parentFolderIDs) {
  // Get the necessary sheet and ss info
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const entitySheetName = PropertiesService.getScriptProperties().getProperty("entitySheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");
  // undo the deletion of the entity
  var params = ["ID", [deletedEntityID]];
  var entity = accessDatabase("UNDO_DELETE", clientSSID, entitySheetName, params)[0];
  // undo delete entity folder
  undoDeleteFolder(entity["FolderID"], parentFolderIDs);
  // undo delete notes
  var deletedNoteIDs = entity["NoteID"];
  if (deletedNoteIDs) {
    deletedNoteIDs = deletedNoteIDs.split(',');
    params = ["ID", deletedNoteIDs];
    accessDatabase("UNDO_DELETE", noteSSID, noteSheetName, params);
  }
  // return the un-deleted entity
  return JSON.parse(JSON.stringify(entity));
}

// ------------------------------------------------------------ Adding Contacts ----------------------------------------------------------


/**
 * Function to add an address, mailing address, and person to the database.
 *
 * @param {object} address: dictionary containing address information
 * @param {object} mailingAddress: dictionary containing mailing address information (may also be null)
 * @param {object} person: dictionary containing person information
 * @return {object} returns a list of the three rows that it just created [newAddress, newMailingAddress (may be null), newPerson]
 *                   each of these rows is a dictionary {field: data}
 */
function addPerson(address, mailingAddress, person) {
  // create person folder & add folder id
  var folderID = createPersonFolder(person);
  person["FolderID"] = folderID;
  // add id to person dict
  return addContact_(address, mailingAddress, person, "person");
}

/**
 * Function to add an address, mailing address, and person to the database.
 *
 * @param {object} address: dictionary containing address information
 * @param {object} mailingAddress: dictionary containing mailing address information (may also be null)
 * @param {object} entity: dictionary containing entity information
 * @param {object} persons: dictionary of dictionaries containing all person information
 *
 * @return {object} returns a list of the three rows that it just created [newAddress, newMailingAddress (may be null), newPerson]
 *                   each of these rows is a dictionary {field: data}
 */
function addEntity(address, mailingAddress, entity, persons) {
  // create entity folder & add folder id
  var folderID = createEntityFolder(entity);
  entity["FolderID"] = folderID;
  // add the entity (and the addresses) to the server 
  return addContact_(address, mailingAddress, entity, "entity");
}

/**
 * Function to add an address, mailing address, and contact to the database.
 *
 * @param {object} address: dictionary containing address information
 * @param {object} mailingAddress: dictionary containing mailing address information (may also be null)
 * @param {object} person: dictionary containing person information
 * @param {string} contactType: a string representing the type of contact (person or entity)
 * @return {object} returns a list of the three rows that it just created [newAddress, newMailingAddress (may be null), newContact]
 *                   each of these rows is a dictionary {field: data}
 */
function addContact_(address, mailingAddress, contact, contactType) {
  // get the consts for sheetnamess and ssid
  const ssID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const addressSheetName = PropertiesService.getScriptProperties().getProperty("addressSheetName");
  const contactSheetName = PropertiesService.getScriptProperties().getProperty(contactType + "SheetName");
  // first add the address
  var params = [[address]];
  var createOutput = accessDatabase("CREATE", ssID, addressSheetName, params);
  var newAddress = Object.values(createOutput)[0];
  // add this address id to the contact
  contact["AddressID"] = newAddress["ID"];
  // check if mailing address is null: if so, do nothing, if not, add mailing address
  var newMailingAddress = null;
  if (mailingAddress) { // if there is a different mailing address
    // add the mailing address to the database
    params = [[mailingAddress]];
    createOutput = accessDatabase("CREATE", ssID, addressSheetName, params);
    newMailingAddress = Object.values(createOutput)[0];
    contact["MailingAddressID"] = newMailingAddress["ID"];
  }

  // add the contact to the database
  params = [[contact]];
  createOutput = accessDatabase("CREATE", ssID, contactSheetName, params);
  var newContact = Object.values(createOutput)[0];
  return [JSON.parse(JSON.stringify(newAddress)), JSON.parse(JSON.stringify(newMailingAddress)), JSON.parse(JSON.stringify(newContact))];
}

// ------------------------------------------------------ Editing Contacts ---------------------------------------------------------------

/**
 * Function to edit a person, calls the general editContact_ function
 *
 * @param {object} address: dictionary holding information that we wish to use to update the address with the specified id
 * @param {object} mailingAddress: dictionary holding information that we wish to use to update the mailing address with the specified id
 * @param {object} person: dictionary holding information that we wish to use to update the person with the specified id
 * @return {object} returns a list of the three rows that it just updated [updatedAddress, updatedMailingAddress (may be null), updatedPerson]
 *                   each of these rows is a dictionary {field: data}
 */
function editPerson(address, mailingAddress, person) {
  //update person folder with new name 
  var folderName = person["FirstName"] + " " + person["LastName"];
  updateContactFolder(person["FolderID"], folderName);
  // edit person and return output
  return editContact_(address, mailingAddress, person, "person");
}

/**
 * Function to edit an entity, calls the general editContact_ function
 *
 * @param {object} address: dictionary holding information that we wish to use to update the address with the specified id
 * @param {object} mailingAddress: dictionary holding information that we wish to use to update the mailing address with the specified id
 * @param {object} entity: dictionary holding information that we wish to use to update the entity with the specified id
 * @return {object} returns a list of the three rows that it just updated [updatedAddress, updatedMailingAddress (may be null), updatedEntity]
 *                   each of these rows is a dictionary {field: data}
 */
function editEntity(address, mailingAddress, entity) {
  //update entity folder with new name and new associated folders
  updateContactFolder(entity["FolderID"], entity["Name"]);
  //edit entity and return output
  return editContact_(address, mailingAddress, entity, "entity");
}

/**
 * Function to edit an address, mailing address, and contact in the database. Called by editPerson and editEntity
 *
 * @param {object} address: dictionary containing address information
 * @param {object} mailingAddress: dictionary containing mailing address information (may also be null)
 * @param {object} person: dictionary containing person information
 * @param {string} contactType: a string representing the type of contact (person or entity)
 * @return {object} returns a list of the three rows that it just created [newAddress, newMailingAddress (may be null), newContact]
 *                   each of these rows is a dictionary {field: data}
 */
function editContact_(address, mailingAddress, contact, contactType) {
  // get the consts for sheetnamess and ssid
  const ssID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const addressSheetName = PropertiesService.getScriptProperties().getProperty("addressSheetName");
  const contactSheetName = PropertiesService.getScriptProperties().getProperty(contactType + "SheetName");
  // update the address
  var params = [address];
  var updateOutput = accessDatabase("UPDATE", ssID, addressSheetName, params);
  var updatedAddress = Object.values(updateOutput)[0];
  contact["AddressID"] = updatedAddress["ID"];
  // update the mailing address
  var updatedMailingAddress = null;
  if (mailingAddress) {
    // update the mailing address in the database
    params = [mailingAddress];
    updateOutput = accessDatabase("UPDATE", ssID, addressSheetName, params);
    updatedMailingAddress = Object.values(updateOutput)[0];
    contact["MailingAddressID"] = updatedMailingAddress["ID"];
  }
  // update the contact in the database
  params = [contact];
  updateOutput = accessDatabase("UPDATE", ssID, contactSheetName, params);
  var updatedContact = Object.values(updateOutput)[0];
  // return the appropriate list
  return [JSON.parse(JSON.stringify(updatedAddress)), JSON.parse(JSON.stringify(updatedMailingAddress)), JSON.parse(JSON.stringify(updatedContact))];
}