//-------------------------------------------------------------------- Create Folder functions -----------------------------------------------------------

/**
 *Function that creates a folder for a person in the people folder
 * 
 * @param {object} person: the person dictionary for which we are creating a folder
 * @return {string} the id of the newly created folder
 */
function createPersonFolder(person) {
  // get people folder
  var peopleFolderID = PropertiesService.getScriptProperties().getProperty("peopleFolderID");
  var peopleFolder = DriveApp.getFolderById(peopleFolderID);
  // create specific person folder
  var personFolder = peopleFolder.createFolder(person["FirstName"] + " " + person["LastName"]);
  return personFolder.getId();
}

/**
 * Function that creates a folder for an entity in the entities folder
 * 
 * @param {object} entity: the person dictionary for which we are creating a folder
 *
 * @return {string} the id of the newly created folder
 */
function createEntityFolder(entity) {
  Logger.log("Creating Entity Folder");
  // get entities folder
  var entitiesFolderID = PropertiesService.getScriptProperties().getProperty("entitiesFolderID");
  var entitiesFolder = DriveApp.getFolderById(entitiesFolderID);
  // create specific entity folder
  var entityFolder = entitiesFolder.createFolder(entity["Name"]);

  return entityFolder.getId();
}

/**
 * Function that creates a folder for a client in the inReview folder
 * 
 * @param {object} client: the person dictionary for which we are creating a folder
 *
 * @return {string} the id of the newly created folder
 */
function createClientFolder(client) {
  Logger.log("Creating Client Folder");
  // get clients folder
  var inReviewFolderID = PropertiesService.getScriptProperties().getProperty("inReviewFolderID");
  var clientsFolder = DriveApp.getFolderById(inReviewFolderID);
  // create specific entity folder
  var clientFolder = clientsFolder.createFolder(client["ClientName"]);
  var reportFolder = clientFolder.createFolder("Reports");
  return clientFolder.getId();
}

/**
 * Function that creates a folder for a matter in its client folder
 * 
 * @param {object} matter: the matter dictionary for which we are creating a folder
 * @param {object} client: the client dictionary for which we are adding this matter folder to
 * @return {string} the id of the newly created matter folder
 */
function createMatterFolder(matter, client) {
  // get the client folder to put the matter folder in
  var clientFolderID = client["FolderID"];
  var clientFolder = DriveApp.getFolderById(clientFolderID);
  // create this matter folder in the client folder
  var matterFolder = clientFolder.createFolder(matter["DocketNo"]);
  return matterFolder.getId();
}

/**
 * Function that creates a folder for a task in the trash folder
 * 
 * @param {string} folderName: the name of the folder
 * @return {string} the id of the newly created folder
 */
function createTaskFolder(folderName) {
  // get the trash folder
  var trashFolderID = PropertiesService.getScriptProperties().getProperty("trashFolderID");
  var trashFolder = DriveApp.getFolderById(trashFolderID);
  // create the new folder in this trash folder and return its id
  var newFolder = trashFolder.createFolder(folderName);
  return newFolder.getId();
}
//-------------------------------------------------------------------- EDIT FOLDER FUNCTIONS -----------------------------------------------------------

/**
 * Function that updates a folder for a person by changing its name
 * 
 * @param {string} folderID: the id of the folder for a given person
 * @param {string} name: the name of the updated folder
 */
function updateContactFolder(folderID, name) {
  var folder = DriveApp.getFolderById(folderID);
  //update folder name
  folder.setName(name);
}

/**
 *Function that updates a folder for a client by changing its name or moving it to a different parent folder 
 * 
 * @param {object} client: the client dictionary for which we are updating a folder
 *
 */
function updateClientFolder(client) {
  var folder = DriveApp.getFolderById(client["FolderID"]);
  // update folder name
  folder.setName(client["ClientName"]);

  // move folder into parent folder based on status
  var inReviewFolderID = PropertiesService.getScriptProperties().getProperty("inReviewFolderID");
  var inReviewFolder = DriveApp.getFolderById(inReviewFolderID);
  var activeFolderID = PropertiesService.getScriptProperties().getProperty("activeFolderID");
  var activeFolder = DriveApp.getFolderById(activeFolderID);
  var removedFolderID = PropertiesService.getScriptProperties().getProperty("removedFolderID");
  var removedFolder = DriveApp.getFolderById(removedFolderID);

  if (client["Status"] == "In Review") {
    folder.moveTo(inReviewFolder);
  } else if (client["Status"] == "Active") {
    folder.moveTo(activeFolder);
  } else { //client["Status"] == Removed
    folder.moveTo(removedFolder);
  }
}

/**
 * Function that updates a folder for a matter by changing its name and puting it inside its associated client folder 
 * 
 * @param {object} matter: the matter dictionary for which we are updating a folder
 */
function updateMatterFolder(matter, oldClient, newClient) {
  // change the name of the matter folder
  var folder = DriveApp.getFolderById(matter["FolderID"]);
  //update folder name
  folder.setName(matter["DocketNo"]);
  // If we changed clients, move this client to the new client folder
  if (oldClient["ID"] != newClient["ID"]) {
    var newFolderID = newClient["FolderID"];
    var newFolder = DriveApp.getFolderById(newFolderID);
    folder.moveTo(newFolder);
  }
}

/**
 * Function that updates a task folder by removing it from the trash and moving into the tasks directory or a matter directory)
 * 
 * @param {object} task: the task whose folder we are updating 
 * @param {object} matter: the matter that the task is associated with (null if its not associated)
 */
function updateTaskFolder(task, matter) {
  // Get the necessary folders
  var trashFolderID = PropertiesService.getScriptProperties().getProperty("trashFolderID");
  var trashFolder = DriveApp.getFolderById(trashFolderID);
  var tasksFolderID = PropertiesService.getScriptProperties().getProperty("tasksFolderID");
  var tasksFolder = DriveApp.getFolderById(tasksFolderID);
  // update the name of the folder
  var folderID = task["FolderID"];
  if (!folderID) {
    return;
  }
  var folder = DriveApp.getFolderById(folderID);
  folder.setName(task["FolderName"]);

  // put the folder into the specific matter directory (if it exists)
  if (matter) {
    var matterFolder = DriveApp.getFolderById(matter["FolderID"]);
    folder.moveTo(matterFolder);
  } else {
    // put the folder into the tasks directory
    folder.moveTo(tasksFolder);
  }
}

//-------------------------------------------------------------------- Delete Folder functions -----------------------------------------------------------

/**
 *  sets a folder with the given id to trashed and pulls ever inner folder out of trash
 *
 * @param {string} folderID: the id of the folder to be sent to trash
 * @return {array} the ids of the folders parent folders to be used for undo
 */
function deleteFolder(folderID) {
  // get trash folder
  var trashFolderID = PropertiesService.getScriptProperties().getProperty("trashFolderID");
  var trash = DriveApp.getFolderById(trashFolderID);
  // delete main folder and save internal folder
  var folder = DriveApp.getFolderById(folderID);
  var parentFolders = folder.getParents();
  // pull folder out of all parent folders and place in our trash folder
  folder.moveTo(trash)
  var parent;
  var parentIDs = [];
  while (parentFolders.hasNext()) {
    parent = parentFolders.next();
    parentIDs.push(parent.getId());
  }
  return parentIDs;
}

//-------------------------------------------------------------------- undo Delete Folder functions -----------------------------------------------------------

/**
 *  brings a folder with the given id out of trash back to where it existed before
 *
 * @param {string} folderID: the id of the folder to be pulled out of trash
 * @param {Array} parentIDs: the ids of the parent folders the folder will be placed back in
 */
function undoDeleteFolder(folderID, parentIDs) {
  // get trash folder
  Logger.log("We're in undoDeleteFolder");
  var trashFolderID = PropertiesService.getScriptProperties().getProperty("trashFolderID");
  var trash = DriveApp.getFolderById(trashFolderID);
  // get recently deleted folder
  var folder = DriveApp.getFolderById(folderID);
  var parent = DriveApp.getFolderById(parentIDs[0]);
  // move from trash to new folder
  folder.moveTo(parent);

}
//-------------------------------------------------------------------- Files in Folder functions -----------------------------------------------------------

/**
 * Gets the basic info of each file in a folder
 *
 * @param {string} folderID: the id of the folder to be pulled from
 * @return {object} a dictionary of info from each file in the given folder with the form {fileID: fileName}
 */
function getFilesFromFolder(folderID) {
  var folder = DriveApp.getFolderById(folderID);
  // get the files
  var files = folder.getFiles();
  var fileInfo = {};
  var file;
  // make a dictionary of {fileID: fileName} for each file in the folder
  while (files.hasNext()) {
    file = files.next();
    fileInfo[file.getId()] = file.getName();
  }
  // return the dictionary
  return fileInfo;
}