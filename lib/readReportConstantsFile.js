const fs    = require('fs');

/**
  This library is for reading the information from the a tab-separated file of
  of information that is used to create the reports that are published to the
  public.
*/


/**
  this function reads the file which is a downloaded, tab-separated spreadsheet
  and returns as an array of arrays.
*/

const reportConstantsFileToArrayOfArrays_ = function(reportConstantsFile) {

  let contents = fs.readFileSync(reportConstantsFile, 'utf8');
  let lines = contents.split(/\r\n|\r|\n/);  // should handle UNIX and DOS newlines

  let returnArray = [];
  lines.forEach( function (line) {
    returnArray.push(line.split('\t'));
  });
  //console.dir(returnArray);
  return returnArray;
};


// returns an array of arrays, each element of the array is a "row" or line of the file
const readFile = function(siteGdriveSheet) {
  return reportConstantsFileToArrayOfArrays_(siteGdriveSheet);
}

exports.readFile = readFile;
