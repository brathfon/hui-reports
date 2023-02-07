const reportUtils    = require('./reportUtils');

/**
  This library is for reading the information from the a tab-separated file of
  of information that is used to modify the comments field of reports that are published to the
  public.
*/


/**
 * [readFile description]
 * @type {[type]}
 */


const readFile = function(siteGdriveSheet, ignoreFirstLine) {
  return reportUtils.tsvFileToArrayOfArrays(siteGdriveSheet, ignoreFirstLine);
}

exports.readFile = readFile;
