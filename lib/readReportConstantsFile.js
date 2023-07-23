const reportUtils = require('./reportUtils');

/**
  This library is for reading the information from the a tab-separated file of
  of information that is used to create the reports that are published to the
  public.

  It is the responsiblity of the reader to handle the specifics of the file
  format and return just an array of arrays of the spread sheet data.
*/

/**
 * const readFile - calls the reportUtils.tsvFileToArrayOfArrays to
 * obtain a 2D array representing the rows and columns of the google sheet.
 * It's file has a header line, which should be ignored, so that param
 * to tsvFileToArrayOfArrays is passed as "true".
 *
 * @param  {type} constantsGdriveSheet full path to a tab separated file exported from a Google Spreadsheet
 * @return {type}                      report constants values as an array of arrays
 *
 *  Example of the data returned:
 [
  [ 'AREA_TO_REPORT_REGION', 'Hāna', 'N/A' ],
  [ 'AREA_TO_REPORT_REGION', 'Kīhei', 'South' ],
  [ 'AREA_TO_REPORT_REGION', 'Māʻalaea', 'South' ],
  [ 'AREA_TO_REPORT_REGION', 'Olowalu to Pali', 'West' ],
  [ 'AREA_TO_REPORT_REGION', 'Polanui', 'West' ],
  [ 'AREA_TO_REPORT_REGION', 'Pā‘ia', 'N/A' ],
  [ 'AREA_TO_REPORT_REGION', 'Ridge to Reef', 'West' ],
  [ 'AREA_TO_REPORT_REGION', 'Waihe‘e-Waiehu', 'South' ],
  [ 'AREA_TO_REPORT_REGION', 'Wailea-Mākena', 'South' ]
 ]
 */

const readFile = function(constantsGdriveSheet) {
  return reportUtils.tsvFileToArrayOfArrays(constantsGdriveSheet, true);  // true is to ignore first line
}

exports.readFile = readFile;
