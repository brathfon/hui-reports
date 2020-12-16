//************************************************************************************************
// This library makes sure there is consistent creation of log strings.  It also appends it
// to the supplied list if present.
//************************************************************************************************


// levels will be ERROR, WARN, INFO, DEBUG, VERBOSE

var createMsg = function(level, msg, list) {
  let obj = {};
  obj['when'] = Date.now();
  obj['level'] = level;
  obj['msg'] = msg;
  if (list) {

    list.push(obj);
  }
  return obj;
}

// user can either use the return value or send in a list to have the message appended to it
var error = function(msg, list) {
  return createMsg('ERROR', msg, list);
}

var warn = function(msg, list) {
  return createMsg('WARN', msg, list);
}

var info = function(msg, list) {
  return createMsg('INFO', msg, list);
}

var debug = function(msg, list) {
  return createMsg('DEBUG', msg, list);
}

var verbose = function(verbose, list) {
  return createMsg('VERBOSE', msg, list);
}

exports.error   = error;
exports.warn    = warn;
exports.info    = info;
exports.debug   = debug;
exports.verbose = verbose;
