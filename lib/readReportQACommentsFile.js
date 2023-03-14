const reportUtils = require('./reportUtils');

/**
  This library is for reading the information from the tab-separated file
   that is used to modify the comments field of reports that are published to the
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
 * @param  {type} qaCommentsGdriveSheet full path to a tab separated file exported from a Google Spreadsheet
 * @return {2D array of strings}        QA comments information as an array of arrays
 *
 * Example of turned data:
 *
 [
  [
    'NKP210311',
    'Override',
    "nutrient data QA'ed out, hold time 47 days"
  ],
  [
    'RCB220906',
    'Override',
    "nutrient data QA'ed out, sample bottle contaminated"
  ],
  [
    'RKS221108',
    'Override',
    "nutrient data QA'ed out, ambiguous sample ID"
  ],
  [
    'RKT221108',
    'Override',
    "nutrient data QA'ed out, ambiguous sample ID"
  ]
]

 */
const readFile = function(qaCommentsGdriveSheet) {
  return reportUtils.tsvFileToArrayOfArrays(qaCommentsGdriveSheet, true);  // true is to ignore first line
}

exports.readFile = readFile;
