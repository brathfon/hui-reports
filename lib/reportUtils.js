const fs    = require('fs');

/**
  This library is utilities for reporting.
*/



/**
 * const delimitedFileToArrayOfArrays_ - Sends back array of arrays, or 2D array
 * that represents the ascii file passed in file that has data that has delimited columns
 * of data.  The line delimiter of the file can be the common UNIX and DOS delimiters.
 *
 * @param  {string} delimitedFile   full path the to ascii file with delimiters for columns
 * @param  {string} delimitingChar   char (maybe even group of chars, not tested) that delimites the columns
 * @param  {boolean} ignoreFirstLine  useful if the first line is a header
 * @return {2D array of strings}      array of arrays of strings
 *
 * example input file (happens to be tab separated, but could be commas, pipes ):
 *
 *
SampleID        Override or Append      Comment^M
NKP210311       Override        nutrient data QA'ed out, hold time 47 days^M
RCB220906       Override        nutrient data QA'ed out, sample bottle contaminated^M
RKS221108       Override        nutrient data QA'ed out, ambiguous sample ID^M
RKT221108       Override        nutrient data QA'ed out, ambiguous sample ID

 * example return
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


/**
 * const tsvFileToArrayOfArrays - wrapper function for converting tab delimited
 * files.  See comments above for function delimitedFileToArrayOfArrays_
 *
 * @param  {String} tsvFile         full path the to ascii file with delimiters for columns
 * @param  {boolean} ignoreFirstLine useful if the first line is a header
 * @return {type}                 array of arrays of strings
 *
 */
const tsvFileToArrayOfArrays = function(tsvFile, ignoreFirstLine) {
  return delimitedFileToArrayOfArrays_(tsvFile, '\t', ignoreFirstLine);

};

exports.tsvFileToArrayOfArrays = tsvFileToArrayOfArrays;
