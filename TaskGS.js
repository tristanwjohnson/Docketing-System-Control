/**
 * Function that adds a task type to the server
 *
 * @param {object} taskType: a dictionary representing the task type being added to the database
 * 
 * @return {object} returns a dictionary representing the task type that was just added to the database
 */
function addTaskType(taskType) {
  // get the consts for sheetnamess and ssid
  const ssID = PropertiesService.getScriptProperties().getProperty("taskSpreadsheetID");
  const sheetName = PropertiesService.getScriptProperties().getProperty("taskTypeSheetName");
  // add the task type to the sheet
  var params = [[taskType]];
  var createOutput = accessDatabase("CREATE", ssID, sheetName, params);
  var newTaskType = Object.values(createOutput)[0];
  return JSON.parse(JSON.stringify(newTaskType));
}

/**
 * Function that adds a task to the server, sends an email if one given, and updates a matter if one given
 *
 * @param {object} task: a dictionary representing the task being added to the database
 * @param {object} email: a dictionary representing the email to be sent or {} if no email to send
 * @param {object} matter: a dictionary representing the matter to be updated in the database or {} if no associated matter
 * @param {object} assignedMember: a dictionary representing the member to be assigned to the task
 * @param {object} responsibleMember: a dictionary representing the member to be responsible for the task
 * @param {object} tasks: dictionary of all of the tasks (to be used for sorting the tasks in the matter)
 * 
 * @return {object} returns a list of dictionary representing: [newTask, updatedMatter, emailMessage, updatedAssignedMember, updatedResponsibleMember]
 */
function addTask(task, email, matter, assignedMember, responsibleMember, tasks) {
  // Get the necessary sheet information
  var taskSSID = PropertiesService.getScriptProperties().getProperty("taskSpreadsheetID");
  var taskSheetName = PropertiesService.getScriptProperties().getProperty("taskSheetName");
  var matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  var matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  var memberSSID = PropertiesService.getScriptProperties().getProperty("memberSpreadsheetID");
  var memberSheetName = PropertiesService.getScriptProperties().getProperty("memberSheetName");
  // create event in DCS calendar and add ID to task
  var calStr = task["DueDate"];
  var offCalDate = new Date(calStr);
  var calDate = new Date(offCalDate.setDate(offCalDate.getDate() + 1)); // update date taking into account OBO error when initially pulled from HTML
  var event = { "title": task["Title"], "description": task["Description"], "date": calDate, "members": assignedMember["Email"] + "," + responsibleMember["Email"] };
  task["EventID"] = createEvent(event);
  // add the task to the database
  var params = [[task]];
  var createOutput = accessDatabase("CREATE", taskSSID, taskSheetName, params);
  var newTask = Object.values(createOutput)[0];
  // fix task dates from OBO errors that occure when initially pulling from HTML
  var offStr = newTask["StartDate"];
  var offDate = new Date(offStr);
  newTask["StartDate"] = new Date(offDate.setDate(offDate.getDate() + 1));
  offStr = newTask["DueDate"];
  offDate = new Date(offStr);
  newTask["DueDate"] = new Date(offDate.setDate(offDate.getDate() + 1));
  // Next, add this new task to the assigned and responsible members
  var updatedAssignedMember, updatedResponsibleMember;
  if (assignedMember["TaskAssignedID"] == null || assignedMember["TaskAssignedID"] == "") {
    assignedMember["TaskAssignedID"] = newTask["ID"];
  } else {
    var assignedMemberTaskIDs = assignedMember["TaskAssignedID"].split(",");
    var sortedTaskIDs = insertSort_(assignedMemberTaskIDs, newTask, tasks); //insert task ID in list based on due date
    assignedMember["TaskAssignedID"] = sortedTaskIDs;
  }
  // if the members are the same, then only one instance of them should be updated to include both the assigned task id and responsible task id
  if (assignedMember["ID"] == responsibleMember["ID"]) {
    // update the assigned member to also include the appropriate responsible task id
    if (assignedMember["TaskResponsibleID"] == null || assignedMember["TaskResponsibleID"] == "") {
      assignedMember["TaskResponsibleID"] = newTask["ID"];
    } else {
      var assignedMemberTaskIDs = assignedMember["TaskResponsibleID"].split(",");
      var sortedTaskIDs = insertSort_(assignedMemberTaskIDs, newTask, tasks); //insert task ID in list based on due date
      assignedMember["TaskResponsibleID"] = sortedTaskIDs;
    }
    updatedResponsibleMember = null;
  } else { // if the assigned & responsible members are different, update both of them separately
    if (responsibleMember["TaskResponsibleID"] == null || assignedMember["TaskResponsibleID"] == null) {
      responsibleMember["TaskResponsibleID"] = newTask["ID"];
    } else {
      var responsibleMemberTaskIDs = responsibleMember["TaskResponsibleID"].split(",");
      var sortedTaskIDs = insertSort_(responsibleMemberTaskIDs, newTask, tasks); //insert task ID in list based on due date
      responsibleMember["TaskResponsibleID"] = sortedTaskIDs;
    }
    // assign the responsible member in database
    params = [responsibleMember];
    createOutput = accessDatabase("UPDATE", memberSSID, memberSheetName, params);
    updatedResponsibleMember = Object.values(createOutput)[0];
  }
  // update the assigned member in database
  params = [assignedMember];
  createOutput = accessDatabase("UPDATE", memberSSID, memberSheetName, params);
  updatedAssignedMember = Object.values(createOutput)[0];

  // Next, add the matter to the database (if there is a matter to be added)
  var updatedMatter;
  if (Object.keys(matter).length > 0) {
    // add the id of the new task to the matter
    if (matter["TaskID"] == null) {
      matter["TaskID"] = newTask["ID"];
    } else {
      var matterTaskIDs = matter["TaskID"].split(",");
      var sortedTaskIDs = insertSort_(matterTaskIDs, newTask, tasks); //insert task ID in list based on due date
      matter["TaskID"] = sortedTaskIDs;
    }
    // update the matter in the database
    params = [matter];
    createOutput = accessDatabase("UPDATE", matterSSID, matterSheetName, params);
    updatedMatter = Object.values(createOutput)[0];
  }
  // update the folders in Drive
  if (newTask["FolderID"]) {
    updateTaskFolder(newTask, updatedMatter);
  }
  // try and send the email if one given, return an error message if it fails and false if it doesnt
  try {
    if (Object.keys(email).length > 0) {
      sendEmail(email);
    }
    var emailMessage = false;
  } catch (err) {
    var emailMessage = "addTaskFailedEmailMessage";
    Logger.log("email failed to send with this error message: " + err)
  }

  // Email the assigned member and cc the responsible member
  var memberEmail = {};
  memberEmail["TO"] = updatedAssignedMember["Email"];
  memberEmail["Subject"] = "You Have Been Assigned a New Task in the Docketing System"
  memberEmail["Message"] = "You have been assigned the following task: " + newTask["Title"] + "\n\nThis task is due on: " + newTask["DueDate"];
  if (updatedResponsibleMember) {
    memberEmail["CC"] = updatedResponsibleMember["Email"];
    memberEmail["Message"] += "\n\nThe member responsible for this task is: " + updatedResponsibleMember["FirstName"] + " " + updatedResponsibleMember["LastName"];
  }
  // try and send the member email
  try {
    sendEmail(memberEmail);
  } catch (err) {
    Logger.log("Assignment Email failed to send: " + err);
  }

  // return the new task and updated matter and string/bool representing status of the email
  newTask = JSON.parse(JSON.stringify(newTask));
  if (updatedMatter) {
    updatedMatter = JSON.parse(JSON.stringify(updatedMatter));
  }
  updatedAssignedMember = JSON.parse(JSON.stringify(updatedAssignedMember));
  if (updatedResponsibleMember) {
    updatedResponsibleMember = JSON.parse(JSON.stringify(updatedResponsibleMember));
  }
  return [newTask, updatedMatter, updatedAssignedMember, updatedResponsibleMember, emailMessage];
}


/**
 * Function to edit a task in the database, updating members and matters associated with it
 *
 * @param {object} data: a list of all of the task (and its associated) data being passed into the function, entries described below
 *  - @param {object} task: the actual task being edited
 *  - @param {object} email: the email contents (should be an empty dictionary if not being sent)
 *  - @param {object} oldMatter: the former matter associated with the task (may be an empty dictionary if no matter associated before)
 *  - @param {object} matter: the new matter being associated with this task (may be an empty dictionary if we aren't associating a matter)
 *  - @param {object} oldAssignedMember: the previously assigned member
 *  - @param {object} assignedMember: the member we wish to assign this task to
 *  - @param {object} oldResponsibleMember: the previously responsible member
 *  - @param {object} responsibleMember: the member we wish to make responsible for this task
 * @param {object} tasks: the dictionary of all tasks (to be used for sorting tasks in matter/members)
 * 
 * @return {object} returns a list of useful dictionaries: 
 *                  [updatedTask, updatedOldMatter, updatedMatter, updatedOldAssignedMember, updatedAssignedMember, updatedOldResponsibleMember, updatedResponsibleMember, emailMessage]
 */
function editTask(data, tasks) {
  // Get the necessary sheet information
  var taskSSID = PropertiesService.getScriptProperties().getProperty("taskSpreadsheetID");
  var taskSheetName = PropertiesService.getScriptProperties().getProperty("taskSheetName");
  var matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  var matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  var memberSSID = PropertiesService.getScriptProperties().getProperty("memberSpreadsheetID");
  var memberSheetName = PropertiesService.getScriptProperties().getProperty("memberSheetName");
  // unpack the data array
  var task = data[0];
  var email = data[1];
  var oldMatter = data[2];
  var matter = data[3];
  var oldAssignedMember = data[4];
  var assignedMember = data[5];
  var oldResponsibleMember = data[6];
  var responsibleMember = data[7];
  // fix dates in task
  if (task["DateViewed"]) {
    task["DateViewed"] = new Date(task["DateViewed"]);
  }
  if (task["DateCompleted"]) {
    task["DateCompleted"] = new Date(task["DateCompleted"]);
  }
  // update the task in the database
  var params = [task];
  var createOutput = accessDatabase("UPDATE", taskSSID, taskSheetName, params);
  var updatedTask = Object.values(createOutput)[0];
  // fix task inputted dates from OBO errors
  var offStr = updatedTask["StartDate"];
  var offDate = new Date(offStr);
  updatedTask["StartDate"] = new Date(offDate.setDate(offDate.getDate() + 1));
  offStr = updatedTask["DueDate"];
  offDate = new Date(offStr);
  updatedTask["DueDate"] = new Date(offDate.setDate(offDate.getDate() + 1));
  // create a dictionary of members {memberID: member} to prevent extraneous calls to the database or overwriting taskIDs in the database
  var members = {};
  members[oldAssignedMember["ID"]] = oldAssignedMember;
  members[oldResponsibleMember["ID"]] = oldResponsibleMember;
  members[assignedMember["ID"]] = assignedMember;
  members[responsibleMember["ID"]] = responsibleMember;
  // update the old members to not include the task id
  // remove the taskID from the oldAssignedMember
  var oldAssignedTaskIDs = members[oldAssignedMember["ID"]]["TaskAssignedID"].split(",");
  // filter out old task ID
  var updatedOldAssignedTaskIDs = oldAssignedTaskIDs.filter(function (id) { return (id != this); }, updatedTask["ID"]);
  members[oldAssignedMember["ID"]]["TaskAssignedID"] = updatedOldAssignedTaskIDs.join(",");
  if (members[oldAssignedMember["ID"]]["TaskAssignedID"] == "") { // set value to null if empty for ease of use
    members[oldAssignedMember["ID"]]["TaskAssignedID"] = null;
  }
  // remove the taskID from the oldResponsibleMember
  var oldResponsibleTaskIDs = members[oldResponsibleMember["ID"]]["TaskResponsibleID"].split(",");
  // filter out task ID
  var updatedOldResponsibleTaskIDs = oldResponsibleTaskIDs.filter(function (id) { return (id != this); }, updatedTask["ID"]);
  members[oldResponsibleMember["ID"]]["TaskResponsibleID"] = updatedOldResponsibleTaskIDs.join(",");
  if (members[oldResponsibleMember["ID"]]["TaskResponsibleID"] == "") { // set value to null if empty for ease of use
    members[oldResponsibleMember["ID"]]["TaskResponsibleID"] = null;
  }
  // update the new members to include the task ID
  // add the taskID to the assignedMember
  if (members[assignedMember["ID"]]["TaskAssignedID"] == null) {
    members[assignedMember["ID"]]["TaskAssignedID"] = updatedTask["ID"];
  } else {
    var assignedMemberTaskIDs = members[assignedMember["ID"]]["TaskAssignedID"].split(",");
    var sortedTaskIDs = insertSort_(assignedMemberTaskIDs, updatedTask, tasks); //insert task ID in list based on due date
    members[assignedMember["ID"]]["TaskAssignedID"] = sortedTaskIDs;
  }
  // add the taskID to the responsibleMember
  if (members[responsibleMember["ID"]]["TaskResponsibleID"] == null) {
    members[responsibleMember["ID"]]["TaskResponsibleID"] = updatedTask["ID"];
  } else {
    var responsibleMemberTaskIDs = members[responsibleMember["ID"]]["TaskResponsibleID"].split(",");
    var sortedTaskIDs = insertSort_(responsibleMemberTaskIDs, updatedTask, tasks); //insert task ID in list nased on due date
    members[responsibleMember["ID"]]["TaskResponsibleID"] = sortedTaskIDs;
  }

  // loop through the members dictionary to update the database - will always to atleast on write
  var memberIDsToUpdate = Object.keys(members);
  var updatedMember, member;
  for (var i = 0; i < memberIDsToUpdate.length; i++) {
    var member = members[memberIDsToUpdate[i]];
    params = [member];
    createOutput = accessDatabase("UPDATE", memberSSID, memberSheetName, params);
    updatedMember = Object.values(createOutput)[0];
    members[updatedMember["ID"]] = updatedMember;
  }
  // update matter and oldMatter in sheet if changed
  var updatedMatter = null;
  var updatedOldMatter = null;
  var writeMatterToSheet = false;
  var writeOldMatterToSheet = false;
  var oldMatterTaskIDs, matterTaskIDs, sortedTaskIDs;
  if (matter) {
    if (oldMatter) {
      if (matter["ID"] != oldMatter["ID"]) { // if there is an old matter and a new matter that are different update both
        // update the Old matter in the server
        writeOldMatterToSheet = true;
        // update the matter in the server
        writeMatterToSheet = true;
      } else { // if there is an old matter and a new matter that are the same pass only the new matter
        updatedMatter = matter;
      }
    } else { // if there is no old matter but a new matter just update matter
      writeMatterToSheet = true;
    }
  } else {
    if (oldMatter) { // if the is an old matter but no new matter just update the old matter
      //no new matter just update old matter
      writeOldMatterToSheet = true;
    }
  }
  // write matter to sheet if logic says so
  if (writeMatterToSheet) {
    if (matter["TaskID"] == null || matter["TaskID"] == "") {
      matter["TaskID"] = updatedTask["ID"];
    } else {
      matterTaskIDs = matter["TaskID"].split(",");
      sortedTaskIDs = insertSort_(matterTaskIDs, updatedTask, tasks); //insert task ID in list based on due date
      matter["TaskID"] = sortedTaskIDs;
    }
    // make call to update matter in database
    params = [matter];
    createOutput = accessDatabase("UPDATE", matterSSID, matterSheetName, params);
    updatedMatter = Object.values(createOutput)[0];
  }
  // write old matter to sheet if logic says so
  if (writeOldMatterToSheet) {
    if (oldMatter["TaskID"]) {
      oldMatterTaskIDs = oldMatter["TaskID"].split(",");
    } else {
      oldMatterTaskIDs = [];
    }
    oldMatterTaskIDs = oldResponsibleTaskIDs.filter(function (id) { return (id != this); }, updatedTask["ID"]);
    oldMatter["TaskID"] = updatedOldResponsibleTaskIDs.join(",");
    // update old matter in database
    params = [oldMatter];
    createOutput = accessDatabase("UPDATE", matterSSID, matterSheetName, params);
    updatedOldMatter = Object.values(createOutput)[0];
  }
  // update the task folder if one exists
  if (updatedTask["FolderID"]) {
    updateTaskFolder(updatedTask, updatedMatter);
  }
  // try and send the email if one given, return an error message if it fails and false if it doesnt
  try {
    if (Object.keys(email).length > 0) {
      sendEmail(email);
    }
    var emailMessage = false;
  } catch (e) {
    var emailMessage = "addTaskFailedEmailMessage";
    Logger.log("email failed to send with this error message: " + e)
  }
  // Email the assigned member and cc the responsible member (only if either of them have changed)
  if (oldAssignedMember["ID"] != assignedMember["ID"] || oldResponsibleMember["ID"] != responsibleMember["ID"]) {
    var memberEmail = {};
    memberEmail["TO"] = assignedMember["Email"];
    memberEmail["Subject"] = "A Task Has Been Reassigned in the Docketing System"
    memberEmail["Message"] = "The following task has been reassigned: " + updatedTask["Title"] + "\n\nThis task is due on: " + updatedTask["DueDate"];
    memberEmail["Message"] += "\n\nThis task has been assigned to: " + assignedMember["FirstName"] + " " + assignedMember["LastName"];
    memberEmail["Message"] += "\n\nThe member responsible for this task is: " + responsibleMember["FirstName"] + " " + responsibleMember["LastName"];
    if (responsibleMember["ID"] != assignedMember["ID"]) {
      memberEmail["CC"] = responsibleMember["Email"];
    }
    // try and send the member email
    try {
      sendEmail(memberEmail);
    } catch (e) {
      Logger.log("Reassignment Email failed to send: " + e);
    }
  }
  // return all updated values to be placed into JSON
  updatedTask = JSON.parse(JSON.stringify(updatedTask));
  if (updatedMatter) {
    updatedMatter = JSON.parse(JSON.stringify(updatedMatter));
  }
  if (updatedOldMatter) {
    updatedOldMatter = JSON.parse(JSON.stringify(updatedOldMatter));
  }
  var updatedAssignedMember = JSON.parse(JSON.stringify(members[assignedMember["ID"]]));
  var updatedOldAssignedMember = JSON.parse(JSON.stringify(members[oldAssignedMember["ID"]]));
  var updatedResponsibleMember = JSON.parse(JSON.stringify(members[responsibleMember["ID"]]));
  var updatedOldResponsibleMember = JSON.parse(JSON.stringify(members[oldResponsibleMember["ID"]]));

  return [updatedTask, updatedOldMatter, updatedMatter, updatedOldAssignedMember, updatedAssignedMember, updatedOldResponsibleMember, updatedResponsibleMember, emailMessage];
}

/**
 * Updates a task in the database to either be acknowledged or closed based on action iput
 * 
 * @param {object} task: the dictionary with the task infomation we wish toupdate
 * @param {string} action: the action we wish to do with the task (either acknowledge or close)
 * 
 * @return {object} return a dictionary of the updated Task
 */
function acknowledgeOrCloseTask(task, action) {
  // Get the appropriate ssid and sheetname
  var taskSSID = PropertiesService.getScriptProperties().getProperty("taskSpreadsheetID");
  var taskSheetName = PropertiesService.getScriptProperties().getProperty("taskSheetName");
  // update either the dateViewed or dateClosed field of the task
  if (action == "acknowledge") {
    task["DateViewed"] = new Date();
  } else if (action == "close") {
    task["DateViewed"] = new Date(task["DateViewed"]);
    task["DateCompleted"] = new Date();
  }
  // update the start and due date fields so they are stored in the sheet properly
  var retStartDate = new Date(task["StartDate"]);
  var retDueDate = new Date(task["DueDate"]);
  // format start and due date in YYYY-MM-DD also fixing month indexing by 0 format
  task["StartDate"] = retStartDate.getFullYear() + "-" + (retStartDate.getMonth() + 1) + "-" + retStartDate.getDate();
  task["DueDate"] = retDueDate.getFullYear() + "-" + (retDueDate.getMonth() + 1) + "-" + retDueDate.getDate();
  // update the task in the database
  var params = [task];
  var createOutput = accessDatabase("UPDATE", taskSSID, taskSheetName, params);
  var updatedTask = Object.values(createOutput)[0];
  updatedTask["StartDate"] = retStartDate;
  updatedTask["DueDate"] = retDueDate;
  // return updated task
  return JSON.parse(JSON.stringify(updatedTask));
}

/**
 * Function that inserts a task id into a (presorted) list based on its due date.
 *
 * @param {object} taskIDs: list of task ids for the current matter
 * @param {object} newTask: the new task we wish to add to the matter
 * @param {object} tasks: a dictionary of dictionary storing all task information (to be used to access task dates)
 * 
 * @return {string} returns a commma separated string of the sorted task ids
 */
function insertSort_(taskIDs, newTask, tasks) {
  var retList = [];
  var currTask;
  var newTaskAdded = false;
  var date1, date2;
  date1 = Date.parse(newTask["DueDate"]);
  // iterate through the given tasks and insert new ID in correct spot
  for (var i = 0; i < taskIDs.length; i++) {
    if (newTaskAdded) { // if the new task has already been added, just pass on the next ID in taskIDs
      retList.push(taskIDs[i]);
    } else {
      currTask = tasks[taskIDs[i]];
      date2 = Date.parse(currTask["DueDate"]);
      if (date1 < date2) { // if the new task comes before the current task, add it to retList
        retList.push(newTask["ID"]);
        // add the current task ID after
        retList.push(taskIDs[i]);
        // set added flag to true
        newTaskAdded = true;
      } else { // only add the current task id
        retList.push(taskIDs[i]);
      }
    }
  }
  // add the new task to the end of the list if it was never added
  if (!newTaskAdded) {
    retList.push(newTask["ID"]);
  }
  // return the string version of this list
  return retList.join(",");
}

/**
 * Function that deletes a task from the server and updates all of the members and matters pointing to it to reflect this deletion
 * 
 * @param {object} task: dictionary of the task to be deleted
 * @param {object} oldAssignedMember: dictionary of the assigned member to be updated to not point to task
 * @param {object} oldResponsibleMember: dictionary of the responsible member to be updated to not point to task
 * @param {object} oldMatter: dictionary of the matter to be updated to not point to task
 * 
 * @return {object} returns an info list with info used to update JSON: [deletedTask, updatedAssignedMember, updatedResponsibleMember, updatedMatter]
 */
function deleteTask(task, oldAssignedMember, oldResponsibleMember, oldMatter) {
  // get the necessary ssids and sheetnames
  var taskSSID = PropertiesService.getScriptProperties().getProperty("taskSpreadsheetID");
  var taskSheetName = PropertiesService.getScriptProperties().getProperty("taskSheetName");
  var matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  var matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  var memberSSID = PropertiesService.getScriptProperties().getProperty("memberSpreadsheetID");
  var memberSheetName = PropertiesService.getScriptProperties().getProperty("memberSheetName");
  // delete the task folder if one exists
  if (task["FolderID"]) {
    deleteFolder(task["FolderID"]);
  }
  // delete google calendar event
  deleteEvent(task["EventID"]);
  // delete the task
  var taskID = task["ID"];
  var params = ["ID", [taskID]];
  var deletedTask = accessDatabase("DELETE", taskSSID, taskSheetName, params)[taskID];
  // update the members to not have the deleted task ID
  var updatedAssignedMember, updatedResponsibleMember, createOutput;
  if (oldAssignedMember["ID"] == oldResponsibleMember["ID"]) {
    // only update one of these in the sheet (since they're the same)
    var oldAssignedTaskIDs = oldAssignedMember["TaskAssignedID"].split(",");
    var updatedOldAssignedTaskIDs = oldAssignedTaskIDs.filter(function (id) { return (id != this); }, taskID);
    oldAssignedMember["TaskAssignedID"] = updatedOldAssignedTaskIDs.join(",");
    var oldResponsibleTaskIDs = oldAssignedMember["TaskResponsibleID"].split(",");
    var updatedOldResponsibleTaskIDs = oldResponsibleTaskIDs.filter(function (id) { return (id != this); }, taskID);
    oldAssignedMember["TaskResponsibleID"] = updatedOldResponsibleTaskIDs.join(",");
    updatedResponsibleMember = null;
  } else {
    // update both members in the sheet as they are different
    var oldAssignedTaskIDs = oldAssignedMember["TaskAssignedID"].split(",");
    var updatedOldAssignedTaskIDs = oldAssignedTaskIDs.filter(function (id) { return (id != this); }, taskID);
    oldAssignedMember["TaskAssignedID"] = updatedOldAssignedTaskIDs.join(",");
    var oldResponsibleTaskIDs = oldResponsibleMember["TaskResponsibleID"].split(",");
    var updatedOldResponsibleTaskIDs = oldResponsibleTaskIDs.filter(function (id) { return (id != this); }, taskID);
    oldResponsibleMember["TaskResponsibleID"] = updatedOldResponsibleTaskIDs.join(",");
    // make the database call to update the responsible member
    params = [oldResponsibleMember];
    createOutput = accessDatabase("UPDATE", memberSSID, memberSheetName, params);
    updatedResponsibleMember = Object.values(createOutput)[0];
  }
  // make the database call to update the assigned member
  params = [oldAssignedMember];
  createOutput = accessDatabase("UPDATE", memberSSID, memberSheetName, params);
  updatedAssignedMember = Object.values(createOutput)[0];
  // update the matter (if necessary)
  var updatedMatter = null;
  if (oldMatter) {
    var oldMatterIDs = oldMatter["TaskID"].split(",");
    var updatedOldMatterIDs = oldMatterIDs.filter(function (id) { return (id != this); }, taskID);
    oldMatter["TaskID"] = updatedOldMatterIDs.join(",");
    // make the database call to update the matter
    params = [oldMatter];
    createOutput = accessDatabase("UPDATE", matterSSID, matterSheetName, params);
    updatedMatter = Object.values(createOutput)[0];
  }
  deletedTask = JSON.parse(JSON.stringify(deletedTask));
  updatedAssignedMember = JSON.parse(JSON.stringify(updatedAssignedMember));
  if (updatedResponsibleMember) {
    updatedResponsibleMember = JSON.parse(JSON.stringify(updatedResponsibleMember));
  }
  if (updatedMatter) {
    updatedMatter = JSON.parse(JSON.stringify(updatedMatter));
  }
  return [deletedTask, updatedAssignedMember, updatedResponsibleMember, updatedMatter];
}