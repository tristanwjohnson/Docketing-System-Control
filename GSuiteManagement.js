/**
 * Function to create and send an email based on a passed in dictionary
 *
 * @param {object} email: dictionary storing all the information needed to send an email
 */
function sendEmail(email) {
  // get the ids of the files to be attached as a list
  var fileIDs = email["Files"];
  if (fileIDs) {
    fileIDs = fileIDs.split(",");
  } else {
    fileIDs = [];
  }
  // get the files from drive as PDFS if they are not images
  var attachments = [];
  var file, convertedFile;
  for (var i = 0; i < fileIDs.length; i++) {
    file = DriveApp.getFileById(fileIDs[i]);
    // try to convert the file to a pdf and attach as is if error
    try {
      var convertedFile = file.getAs(MimeType.PDF);
    } catch (e) {
      convertedFile = file.getBlob();
    }
    // push this file to the attachments list
    attachments.push(convertedFile);
  }
  // actually send the email
  GmailApp.sendEmail(email["TO"], email["Subject"], email["Message"], { attachments: attachments, name: 'Adibi IP Docket System', cc: email["CC"] });
}

/**
 * Function to create an event in the DMS calendar
 *
 * @param {object} event: dictionary storing all the information needed to send an email
 */
function createEvent(event) {
  // Get the calendar id
  var calID = PropertiesService.getScriptProperties().getProperty("DCSCalID");
  // create an event in the google calendar
  var calEvent = CalendarApp.getCalendarById(calID).createAllDayEvent(event["title"], event["date"], { guests: event["members"], description: event["description"] });
  return calEvent.getId();

}

/**
 * Function to delete an event from the DMS calendar
 *
 * @param {string} event: ID of the event to be deleted
 */
function deleteEvent(eventID) {
  var calID = PropertiesService.getScriptProperties().getProperty("DCSCalID");
  CalendarApp.getCalendarById(calID).getEventById(eventID).deleteEvent();
}