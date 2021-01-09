//************************************************************************************************
// This library is for printing logging information to the command line. This is a factory
// function that takes advantage of closure: the ability of a function to access variables
// and parameters from the other function even as the other function has exited.
//
// levels will be ERROR, WARN, INFO, DEBUG, VERBOSE
//************************************************************************************************


function CommandLineLogger () {


  const createMsg_ = function(level, msg, alsoPrintToStdErr) {
    //console.log(`DUH ${addSQLComment}`)
    let sqlComment = "";
    if (addSQLComment) {
      sqlComment = "-- "
    }
    console.log(`${sqlComment}${level}: ${msg}`);
    if (alsoPrintToStdErr) console.error(`${sqlComment}${level}: ${msg}`)
  }

  // this is for add a "--" at the beginning of each line so that if the area
  // included a file that is create sql statements, they will be ignored.
  // "--" is the comment indicator for mySQL
  let addSQLComment = false;

// defaults for
  let printErrors = true;
  let printWarnings = true;
  let printInfo = true;
  let printDebug = false;
  let printVerbose = false;

  // functions to call to log the various message levels
  const error = function(msg) {
    if (printErrors) createMsg_('ERROR', msg, true);
  }

  const warn = function(msg) {
    if (printWarnings) createMsg_('WARNING', msg, true);
  }

  const info = function(msg) {
    if (printInfo) createMsg_('INFO', msg);
  }

  const debug = function(msg) {
    if (printDebug) createMsg_('DEBUG', msg);
  }

  const verbose = function(msg) {
    if (printVerbose) createMsg_('VERBOSE', msg);
  }

  const setAddSQLComment = function(addComment) {
    addSQLComment = addComment;
  }

// setters for printing options
  const setPrintErrors = function(doPrintErrors) { printErrors = doPrintErrors;}

  const setPrintWarnings = function(doPrintWarnings){ printWarnings = doPrintWarnings;}

  const setPrintInfo = function (doPrintInfo) {printInfo = doPrintInfo;}

  const setPrintDebug = function(doPrintDebug) {printDebug = doPrintDebug;}

  const setPrintVerbose = function(doPrintVerbose) {printVerbose = doPrintVerbose;}

  return {
    error,
    warn,
    info,
    debug,
    verbose,
    setAddSQLComment,
    setPrintInfo,
    setPrintWarnings,
    setPrintErrors,
    setPrintDebug,
    setPrintVerbose
  }

}

module.exports.CommandLineLogger   = CommandLineLogger;
