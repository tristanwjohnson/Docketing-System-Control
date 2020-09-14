/**
 * If you ever change the database spreadsheets or copy this project, be sure to run initializeProperties so that
 * the script can properly access these spreadsheets.
 */

// global variables that reference the configuration spreadsheet (allows you to initialize properties)
var configSSID = "1MyL3csK8w63rAE9fDK-pamiToTv6UUgdboe58X2oTy8";
var configSheetName = "configSheet";

/**
 * General function for handling GET requests. Integral to our webapp.
 */
function doGet(e) {
  var templateName;
  var title;
  var jsonData;
  if ('page' in e.parameters) {
    if (e.parameters['page'][0] == 'Contacts') { // Load the Contacts page
      templateName = 'Contacts';
      title = "Manage Contacts"
      jsonData = initializeContactsJSON_(e); // initialize the data
    } else if (e.parameters['page'][0] == 'Matters') { // Load the Matters page
      templateName = 'Matters';
      title = "Matters"
      jsonData = initializeMattersJSON_(e); // initialize the data
    } else if (e.parameters['page'][0] == 'Team') { // Load the Team page
      templateName = 'Team';
      title = "Team";
      jsonData = initializeTeamJSON_(e);
    } else { // Load the Dashboard page
      templateName = 'Dashboard';
      title = "Dashboard";
      jsonData = initializeDashboardJSON_(e); // initialize the data
    }
    // else ifs for every other page
  }
  else { // Load the Dashboard page
    // if no page, go to dashboard
    templateName = 'Dashboard';
    title = "Dashboard";
    jsonData = initializeDashboardJSON_(e); // initialize the data
  }
  // create the template
  var template = HtmlService.createTemplateFromFile(templateName);
  // assign the template data
  template.jsonData = jsonData;
  // evaluate the template
  try {
    var html = template.evaluate();
    html.setTitle(title);
    return html;
  }
  catch (e) { // return text/json output if template fails to evaluate
    Logger.log(e);
    return ContentService.createTextOutput(
      JSON.stringify({ "error": e }))
      .setMimeType(ContentService.MimeType.JSON
      );
  }
}


/**
 * Function that initializes the properties of the project.
 * This function must be called upon creation and whenever any of the database spreadsheets are added/modified/deleted.
 *
 * The configuration sheet is formatted such that, for each row, the first column holds the property name, and the second column 
 * holds the property value.
 */
function initializeProperties() {
  // clear the existing properties
  PropertiesService.getScriptProperties().deleteAllProperties();
  // Get the config sheet and the data stored within
  var configSheet = SpreadsheetApp.openById(configSSID).getSheetByName(configSheetName);
  var data = configSheet.getDataRange().getValues();
  // iterate through each row in the config sheet and assign the properties
  for (var i = 0; i < data.length; i++) {
    PropertiesService.getScriptProperties().setProperty(data[i][0], data[i][1]);
  }
}

/**
 * Get the URL for the Google Apps Script running as a WebApp.
 */
function getScriptUrl() {
  var url = ScriptApp.getService().getUrl();
  return url;
}
//--------------------------------------------------------- Init Data for pages ---------------------------------------------------------

function initializeDashboardJSON_(e) {
  // pull all sheet names and ssIDs
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  const personSheetName = PropertiesService.getScriptProperties().getProperty("personSheetName");
  const entitySheetName = PropertiesService.getScriptProperties().getProperty("entitySheetName");
  const memberSSID = PropertiesService.getScriptProperties().getProperty("memberSpreadsheetID");
  const memberSheetName = PropertiesService.getScriptProperties().getProperty("memberSheetName");
  const matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  const matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  const taskSSID = PropertiesService.getScriptProperties().getProperty("taskSpreadsheetID");
  const taskSheetName = PropertiesService.getScriptProperties().getProperty("taskSheetName");
  const taskTypeSheetName = PropertiesService.getScriptProperties().getProperty("taskTypeSheetName");

  // pull the current user email from google
  var currentEmail = getUserEmail_();
  //read member sheet to get dictionary 
  var param = ["Email", [currentEmail]]
  // pulls current user in nested dictionary
  var currentUserDict = accessDatabase("READ", memberSSID, memberSheetName, param);

  // stores user information as base dictionary
  var currentUser = Object.values(currentUserDict)[0];
  // cast permission as an int
  currentUser["Privileges"] = parseInt(currentUser["Privileges"], 10);

  // Load all tasks
  param = ["ID", []];
  var tasks = accessDatabase("READ", taskSSID, taskSheetName, param);

  // Load all task types
  param = ["ID", []];
  var taskTypes = accessDatabase("READ", taskSSID, taskTypeSheetName, param);
  // get all member information
  var members = accessDatabase("READ", memberSSID, memberSheetName, param); // dict of dicts, each a different member
  // get all client information
  var clients = accessDatabase("READ", clientSSID, clientSheetName, param); // dict of dicts, each a different client
  // get all person information
  var persons = accessDatabase("READ", clientSSID, personSheetName, param);
  // get all entity information
  var entities = accessDatabase("READ", clientSSID, entitySheetName, param);
  // Load all matters
  var matters = accessDatabase("READ", matterSSID, matterSheetName, param);

  var matterTypes = getMatterTypes_(matterSSID);

  var matterTypeData = getMatterTypeData_(matterSSID, Object.keys(matterTypes));

  // Initialize the page parameters
  var initParams = {};
  if ("initialClientID" in e.parameters) {
    var clientID = e.parameters['initialClientID'][0];
    initParams["initialClientID"] = clientID;
  }
  if ("initialMatterID" in e.parameters) {
    var matterID = e.parameters['initialMatterID'][0];
    initParams["initialMatterID"] = matterID;
  }
  initParams["url"] = getScriptUrl();
  // Set the page title in json data
  var page;
  if ('page' in e.parameters) {
    page = e.parameters['page'][0];
  } else {
    page = "Dashboard";
  }
  initParams["pageTitle"] = page;
  // store info as dictionaries and return
  var json = { "user": currentUser, "members": members, "clients": clients, "persons": persons, "entities": entities, "matters": matters, "matterTypes": matterTypes, "matterTypeData": matterTypeData, "tasks": tasks, "taskTypes": taskTypes, "initParams": initParams };
  return json;
}

function initializeContactsJSON_(e) {
  // pull all sheet names and IDs
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  const personSheetName = PropertiesService.getScriptProperties().getProperty("personSheetName");
  const entitySheetName = PropertiesService.getScriptProperties().getProperty("entitySheetName");
  const addressSheetName = PropertiesService.getScriptProperties().getProperty("addressSheetName");
  const memberSSID = PropertiesService.getScriptProperties().getProperty("memberSpreadsheetID");
  const memberSheetName = PropertiesService.getScriptProperties().getProperty("memberSheetName");
  const matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  const matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");

  //Load info from sheets


  // pull the current user email from google
  var currentEmail = getUserEmail_();
  //read member sheet to get dictionary 
  var param = ["Email", [currentEmail]]
  // pulls current user in nested dictionary
  var currentUserDict = accessDatabase("READ", memberSSID, memberSheetName, param);

  // stores user information as base dictionary
  var currentUser = Object.values(currentUserDict)[0];
  // cast permission as an int
  currentUser["Privileges"] = parseInt(currentUser["Privileges"], 10);

  // Load all task types
  param = ["ID", []];
  //var taskTypes = accessDatabase("READ", taskSSID, taskTypeSheetName, param);
  // get all member information
  var members = accessDatabase("READ", memberSSID, memberSheetName, param); // dict of dicts, each a different member
  // get all client information
  var clients = accessDatabase("READ", clientSSID, clientSheetName, param); // dict of dicts, each a different client
  // get all person information
  var persons = accessDatabase("READ", clientSSID, personSheetName, param);
  // get all entity information
  var entities = accessDatabase("READ", clientSSID, entitySheetName, param);
  // Load all matters
  var matters = accessDatabase("READ", matterSSID, matterSheetName, param);
  // get all note information
  var noteDict = accessDatabase("READ", noteSSID, noteSheetName, param);
  // get all address information
  var addressDict = accessDatabase("READ", clientSSID, addressSheetName, param);

  // Initialize the page parameters
  var initParams = {};
  if ("initialClientID" in e.parameters) {
    var clientID = e.parameters['initialClientID'][0];
    initParams["initialClientID"] = clientID;
  }
  if ("initialMatterID" in e.parameters) {
    var matterID = e.parameters['initialMatterID'][0];
    initParams["initialMatterID"] = matterID;
  }
  initParams["url"] = getScriptUrl();
  // Set the page title in json data
  var page;
  if ('page' in e.parameters) {
    page = e.parameters['page'][0];
  } else {
    page = "Dashboard";
  }
  initParams["pageTitle"] = page;
  // store info as dictionaries and return
  var json = { "user": currentUser, "addresses": addressDict, "members": members, "clients": clients, "persons": persons, "entities": entities, "notes": noteDict, "matters": matters, "initParams": initParams };
  return json;
}

function initializeMattersJSON_(e) {
  // pull all sheet names and IDs
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  const personSheetName = PropertiesService.getScriptProperties().getProperty("personSheetName");
  const entitySheetName = PropertiesService.getScriptProperties().getProperty("entitySheetName");
  const addressSheetName = PropertiesService.getScriptProperties().getProperty("addressSheetName");
  const memberSSID = PropertiesService.getScriptProperties().getProperty("memberSpreadsheetID");
  const memberSheetName = PropertiesService.getScriptProperties().getProperty("memberSheetName");
  const matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  const matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  const taskSSID = PropertiesService.getScriptProperties().getProperty("taskSpreadsheetID");
  const taskSheetName = PropertiesService.getScriptProperties().getProperty("taskSheetName");
  const taskTypeSheetName = PropertiesService.getScriptProperties().getProperty("taskTypeSheetName");
  const noteSSID = PropertiesService.getScriptProperties().getProperty("noteSpreadsheetID");
  const noteSheetName = PropertiesService.getScriptProperties().getProperty("noteSheetName");

  //Load info from sheets


  // pull the current user email from google
  var currentEmail = getUserEmail_();
  //read member sheet to get dictionary 
  var param = ["Email", [currentEmail]]
  // pulls current user in nested dictionary
  var currentUserDict = accessDatabase("READ", memberSSID, memberSheetName, param);

  // stores user information as base dictionary
  var currentUser = Object.values(currentUserDict)[0];
  // cast permission as an int
  currentUser["Privileges"] = parseInt(currentUser["Privileges"], 10);

  // load address of current user
  param = ["ID", [currentUser["AddressID"]]];
  var userAddressDict = accessDatabase("READ", clientSSID, addressSheetName, param);
  // stores user information as base dictionary
  var userAddress = Object.values(userAddressDict)[0];

  // Load all tasks
  param = ["ID", []];
  var tasks = accessDatabase("READ", taskSSID, taskSheetName, param);

  // Load all task types
  param = ["ID", []];
  var taskTypes = accessDatabase("READ", taskSSID, taskTypeSheetName, param);
  // get all member information
  var members = accessDatabase("READ", memberSSID, memberSheetName, param); // dict of dicts, each a different member
  // get all client information
  var clients = accessDatabase("READ", clientSSID, clientSheetName, param); // dict of dicts, each a different client
  // get all person information
  var persons = accessDatabase("READ", clientSSID, personSheetName, param);
  // get all entity information
  var entities = accessDatabase("READ", clientSSID, entitySheetName, param);
  // Load all matters
  var matters = accessDatabase("READ", matterSSID, matterSheetName, param);
  // get all note information
  var noteDict = accessDatabase("READ", noteSSID, noteSheetName, param);
  // get all address information
  var addressDict = accessDatabase("READ", clientSSID, addressSheetName, param);

  var matterTypes = getMatterTypes_(matterSSID);

  var matterTypeData = getMatterTypeData_(matterSSID, Object.keys(matterTypes));

  // Initialize the page parameters
  var initParams = {};
  if ("initialClientID" in e.parameters) {
    var clientID = e.parameters['initialClientID'][0];
    initParams["initialClientID"] = clientID;
  }
  if ("initialMatterID" in e.parameters) {
    var matterID = e.parameters['initialMatterID'][0];
    initParams["initialMatterID"] = matterID;
  }
  initParams["url"] = getScriptUrl();
  // Set the page title in json data
  var page;
  if ('page' in e.parameters) {
    page = e.parameters['page'][0];
  } else {
    page = "Dashboard";
  }
  initParams["pageTitle"] = page;
  // store info as dictionaries and return
  var json = { "user": currentUser, "address": userAddress, "addresses": addressDict, "members": members, "clients": clients, "persons": persons, "entities": entities, "notes": noteDict, "matters": matters, "matterTypes": matterTypes, "matterTypeData": matterTypeData, "tasks": tasks, "taskTypes": taskTypes, "initParams": initParams };
  return json;
}

function initializeTeamJSON_(e) {
  // pull all sheet names and IDs
  const clientSSID = PropertiesService.getScriptProperties().getProperty("clientSpreadsheetID");
  const clientSheetName = PropertiesService.getScriptProperties().getProperty("clientSheetName");
  const personSheetName = PropertiesService.getScriptProperties().getProperty("personSheetName");
  const entitySheetName = PropertiesService.getScriptProperties().getProperty("entitySheetName");
  const memberSSID = PropertiesService.getScriptProperties().getProperty("memberSpreadsheetID");
  const memberSheetName = PropertiesService.getScriptProperties().getProperty("memberSheetName");
  const matterSSID = PropertiesService.getScriptProperties().getProperty("matterSpreadsheetID");
  const matterSheetName = PropertiesService.getScriptProperties().getProperty("matterSheetName");
  const taskSSID = PropertiesService.getScriptProperties().getProperty("taskSpreadsheetID");
  const taskSheetName = PropertiesService.getScriptProperties().getProperty("taskSheetName");
  const taskTypeSheetName = PropertiesService.getScriptProperties().getProperty("taskTypeSheetName");

  //Load info from sheets


  // pull the current user email from google
  var currentEmail = getUserEmail_();
  //read member sheet to get dictionary 
  var param = ["Email", [currentEmail]]
  // pulls current user in nested dictionary
  var currentUserDict = accessDatabase("READ", memberSSID, memberSheetName, param);

  // stores user information as base dictionary
  var currentUser = Object.values(currentUserDict)[0];
  // cast permission as an int
  currentUser["Privileges"] = parseInt(currentUser["Privileges"], 10);


  // Load all tasks
  param = ["ID", []];
  var tasks = accessDatabase("READ", taskSSID, taskSheetName, param);

  // Load all task types
  param = ["ID", []];
  var taskTypes = accessDatabase("READ", taskSSID, taskTypeSheetName, param);
  // get all member information
  var members = accessDatabase("READ", memberSSID, memberSheetName, param); // dict of dicts, each a different member
  // get all client information
  var clients = accessDatabase("READ", clientSSID, clientSheetName, param); // dict of dicts, each a different client
  // get all person information
  var persons = accessDatabase("READ", clientSSID, personSheetName, param);
  // get all entity information
  var entities = accessDatabase("READ", clientSSID, entitySheetName, param);
  // Load all matters
  var matters = accessDatabase("READ", matterSSID, matterSheetName, param);

  //var matterTypes = getMatterTypes_(matterSSID);

  //var matterTypeData = getMatterTypeData_(matterSSID, Object.keys(matterTypes));

  // Initialize the page parameters
  var initParams = {};
  if ("initialClientID" in e.parameters) {
    var clientID = e.parameters['initialClientID'][0];
    initParams["initialClientID"] = clientID;
  }
  if ("initialMatterID" in e.parameters) {
    var matterID = e.parameters['initialMatterID'][0];
    initParams["initialMatterID"] = matterID;
  }
  initParams["url"] = getScriptUrl();
  // Set the page title in json data
  var page;
  if ('page' in e.parameters) {
    page = e.parameters['page'][0];
  } else {
    page = "Dashboard";
  }
  initParams["pageTitle"] = page;
  // store info as dictionaries and return
  var json = { "user": currentUser, "members": members, "clients": clients, "persons": persons, "entities": entities, "matters": matters, "tasks": tasks, "taskTypes": taskTypes, "initParams": initParams };
  return json;
}


/**
 * Function to get a dictionary of all of the created matter types.
 *
 * @param {string} matterSSID: the ID of the matter spreadsheet
 * @return {object} a dictionary of matter type info {matter type: [field name 1, field name 2, ...]}
 */
function getMatterTypes_(matterSSID) {
  // get the ss and sheets
  var matterSpreadsheet = SpreadsheetApp.openById(matterSSID);
  var sheets = matterSpreadsheet.getSheets();
  var sheetName, data, colNames;
  var matterTypes = {}; //{matterType(sheetName), fields(col values)}
  // iterate through each sheet to get the sheetname and the fields
  for (var i = 0; i < sheets.length; i++) {
    sheetName = sheets[i].getSheetName();
    if (sheetName != "Matters") {
      data = sheets[i].getDataRange().getValues()
      // pull field names in first row skipping over general database col names
      colNames = data[0].slice(6, data[0].length);
      matterTypes[sheetName] = colNames;
    }
  }
  return matterTypes;
}


/**
 * Function that initializes the data for specific matter types (patents, trademarks, etc)
 *
 * @param {string} matterSSID: the id of the matter spreadsheet
 * @param {object} sheetNames: a list of sheetnames in the matter spreadsheet we wish to pull from 
 * @return {object} returns a dictionary of dictionaries {ID: {data}} containing all data of specific matter types
 */
function getMatterTypeData_(matterSSID, sheetNames) {
  var matterSpreadsheet = SpreadsheetApp.openById(matterSSID);
  var currSheetDict;
  var matterTypeDict = {};
  var params = ["ID", []];
  for (var i = 0; i < sheetNames.length; i++) {
    // Get all rows from this sheet
    currSheetDict = accessDatabase("READ", matterSSID, sheetNames[i], params);
    // Combine this dictionary with the aggregate dictionary
    matterTypeDict = Object.assign({}, matterTypeDict, currSheetDict);
  }
  return matterTypeDict;
}

//--------------------------------------------------------- Get Basic INFO ---------------------------------------------------------

/**
 * Function to get the datetime (default rendering: LA/pacific time, dates are not dependent on timezone thought)
 */
function getDatetime_() {
  return new Date();
}

/**
 * Function to return the email address of the current user
 */
function getUserEmail_() {
  var email = Session.getActiveUser().getEmail()
  return email;
}


/**
 * Function to return the user name the current user
 * 
 */
function getUserName_() {
  return getUserEmail_();
}
