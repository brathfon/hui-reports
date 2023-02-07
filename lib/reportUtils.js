const fs    = require('fs');

/**
  This library is utilities for reporting.
*/


/**
  this function reads the file which is a downloaded, tab-separated spreadsheet
  and returns as an array of arrays.
*/

const delimitedFileToArrayOfArrays_ = function(delimitedFile, delimitingChar, ignoreFirstLine) {

  let contents = fs.readFileSync(delimitedFile, 'utf8');
  let lines = contents.split(/\r\n|\r|\n/);  // should handle UNIX and DOS newlines

  let returnArray = [];
  lines.forEach( function (line) {
    returnArray.push(line.split(delimitingChar));
  });
  //console.dir(returnArray);
  let startingIndex = ignoreFirstLine ? 1 : 0;
  return returnArray.slice(startingIndex);
};

const tsvFileToArrayOfArrays = function(tsvFile, ignoreFirstLine) {
  return delimitedFileToArrayOfArrays_(tsvFile, '\t', ignoreFirstLine);

};

exports.tsvFileToArrayOfArrays = tsvFileToArrayOfArrays;
