

let fs    = require('fs');
let path  = require('path');


/* readTeamSheet_()

Reads a sheet and returns an array of arrays, each item of the array
corresponds to a line in the file and is an array of the columns of that line.

It is the responsiblity of the reader to handle the specifics of the file
  format and return just an array of arrays of the spread sheet data.

returns:
[
       [
         'yes',       'yes',    'yes',         'no',
         'no',        '8',      'Wailea',      'NMS',
         'HH',        'DM',     'JJ',          'WKD',
         'WKD180223', '',       'Kilohana Dr', '2018-02-23',
         '8:05',      '2',      '2',           '2',
         '2',         '2',      '9',           '7',
         '2',         'Trades', 'WKD180223',   '24.3',
         '35.7',      '6.87',   '100.5',       '8.18',
         '0.68',      '0.73',   '0.73',        '0.71',
         '0.040',     '',       '1',           '0',
         '',          '2',      '20',          '0',
         ''
       ],
       [
         'yes',        'yes',    'yes',
         'no',         'no',     '8',
         'Wailea',     'NMS',    'HH',
         'DM',         'JJ',     'WKB',
         'WKB180223',  '',       'Keawakapu Beach',
         '2018-02-23', '8:42',   '2',
         '2',          '2',      '2',
         '2',          '9',      '7',
         '2',          'Trades', 'WKB180223',
         '24.6',       '35.6',   '6.87',
         '100.9',      '8.16',   '0.87',
         '0.96',       '0.98',   '0.94',
         '0.063',      '',       '1',
         '0',          '',       '8',
         '25',         '0',      ''
       ],
       ..........
]
*/

let readTeamSheet_ = function(teamSheetFile, logger) {
  let linesArray = [];
  let lines;
  let lineCount = 0;
  let contents = fs.readFileSync(teamSheetFile, 'utf8');
  let filename = path.basename(teamSheetFile);
  //logger.debug("contents: " + contents);
  // By using the reqular expression below, most kinds of files, either
  // Mac UNIX, or PS, will create an array where each element is a line
  // of the file.
  // UNIX -> \n or 0xA
  // Windows -> \r\n or OxD 0XA  (two characters)
  lines = contents.split(/\r\n|\r|\n/);
  lines.forEach( function (line) {
    //logger.debug("line: " + line);
    ++lineCount;
    if (lineCount > 3) {  // first three lines are headers and examples

      let lineAsArray = line.split("\t");

      // this is to get rid of a blank line at the end of each file
      //logger.debug("line length: " + lineAsArray.length);
      if (lineAsArray.length != 1) {
        linesArray.push(lineAsArray);
      }
    }
  });
  return linesArray;
};



/* getTeamSheets()

returns an array of full paths to the tab separated exports sheets files
in the provided directory */

let getTeamSheets_ = function(directory, logger) {
  let teamSheets = [];
  logger.debug("checking directory " + directory);
  try {
    let files = fs.readdirSync(directory);
    files.map(function (file) {
      return path.join(directory, file);
    }).filter(function (file) {
      //logger.debug("checking file " + file);
      return (
        fs.statSync(file).isFile() &&
        (path.basename(file).match(/Team/) != null) &&
        (path.basename(file).match(/\.tsv$/) != null)
      );
    }).forEach(function (filteredFile) {
      //let hostname = path.basename(filteredFile).replace("\.local", "");
      //logger.debug("try-catch version %s (%s)", filteredFile, path.extname(filteredFile));
      //let base = path.basename(filteredFile);
      //logger.debug("adding " + filteredFile);
      teamSheets.push(filteredFile);
    });
  } catch (err) {
    logger.error("caught in getTeamSheets: " + err);
    return null;
  }
  return teamSheets.sort();
}

/* readTeamSheets()

   Returns an object with a string attribute that communicates success or failure
   and am array of objects representing the sheets read from Google sheets
   after they were saved as tab delimited files.

   The sheets objects have an string attribute that has the full path of the
   file and the "sheets" attribute, which is an array of arrays (matrix)
   representing the data in the sheet without the header information.
{
  readingSuccessful: true,
  sheets: [
    {
      source: 'one-session-baseline-data/google-drive-downloads/Hui o ka Wai Ola Data Entry - Team Kamaole.tsv',
      sheet: [
        [
          'yes',        'yes',    'yes',
          'no',         'no',     '1',
          'Kamaole',    'NMS',    'MB',
          'AQ',         'DH',     'KWP',
          'KWP171107',  '',       'Waipuilani Park',
          '2017-11-07', '8:20',   '1',
          '1',          '1',      '1',
          '1',          '19',     '0',
          '0',          'Trades', 'KWP171107',
          '26.1',       '33.7',   '5.47',
          '81.5',       '8.19',   '8.31',
          '7.70',       '8.58',   '8.20',
          '0.055',      '',       '0',
          '1',          '',       '0',
          '0',          '2',      ''
        ],
........

     ]
   }

*/

let readTeamSheets = function(directory, logger) {

  let returnObj = {};
  returnObj['readingSuccessful'] = false;
  returnObj['sheets'] = [];

  let teamSheets = getTeamSheets_(directory, logger); // returning a list of paths of the sheet files

  if (teamSheets) {
    for (i = 0; i < teamSheets.length; ++i) {
      //logger.debug("Team sheet: " + teamSheets[i]);
      //
      returnObj['readingSuccessful'] = true;
      let sheetObj = {};
      sheetObj['source'] = teamSheets[i];
      sheetObj['sheetLines'] = readTeamSheet_(teamSheets[i], logger);
      returnObj.sheets.push(sheetObj);  //
    }
  }
  return returnObj;
};


exports.readTeamSheets = readTeamSheets;
