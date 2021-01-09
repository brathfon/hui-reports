//************************************************************************************************
// This library is for printing logging information to the command line. This is a factory
// function that takes advantage of closure: the ability of a function to access variables
// and parameters from the other function even as the other function has exited.
//
// levels will be ERROR, WARN, INFO, DEBUG, VERBOSE
//************************************************************************************************


function ListOfMessagesLogger () {



  const oldcreateMessage_ = function(level, Message) {
    //console.log(`DUH ${addSQLComment}`)
    console.log(`${sqlComment}${level}: ${Message}`);
    if (alsoPrintToStdErr) console.error(`${sqlComment}${level}: ${Message}`)
  }

  var createMessage_ = function(level, Message, list) {
    messageList.push([Date.now(), level, Message]);
  }


// defaults for
  let printErrors = true;
  let printWarnings = true;
  let printInfo = true;
  let printDebug = false;
  let printVerbose = false;

  let messageList = [];

  // functions to call to log the various message levels
  const error = function(message) {
    if (printErrors) createMessage_('ERROR', message, messageList);
  }

  const warn = function(message) {
    if (printWarnings) createMessage_('WARNING', message, messageList);
  }

  const info = function(message) {
    if (printInfo) createMessage_('INFO', message, messageList);
  }

  const debug = function(message) {
    if (printDebug) createMessage_('DEBUG', message);
  }

  const verbose = function(message) {
    if (printVerbose) createMessage_('VERBOSE', message);
  }


// setters for printing options
  const setPrintErrors = function(doPrintErrors) { printErrors = doPrintErrors;}

  const setPrintWarnings = function(doPrintWarnings){ printWarnings = doPrintWarnings;}

  const setPrintInfo = function (doPrintInfo) {printInfo = doPrintInfo;}

  const setPrintDebug = function(doPrintDebug) {printDebug = doPrintDebug;}

  const setPrintVerbose = function(doPrintVerbose) {printVerbose = doPrintVerbose;}

  const getMessages = function () {return messageList};

  return {
    error,
    warn,
    info,
    debug,
    verbose,
    setPrintInfo,
    setPrintWarnings,
    setPrintErrors,
    setPrintDebug,
    setPrintVerbose,
    getMessages
  }

}

module.exports.ListOfMessagesLogger   = ListOfMessagesLogger;
