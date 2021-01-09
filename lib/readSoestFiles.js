var util  = require('util');
var fs    = require('fs');
var path  = require('path');

const sdsp = require('./soestDataSheetParser');




var getSoestFiles = function(directory) {
  var soestFiles = [];
  //logger.debug("checking directory " + directory);
  try {
     var files = fs.readdirSync(directory);
     files.map(function (file) {
         return path.join(directory, file);
     }).filter(function (file) {
         //logger.debug("checking file " + file);
         return (
                  fs.statSync(file).isFile() &&
                  ((path.basename(file).match(/TNC/) != null) || (path.basename(file).match(/MNMRC/) != null)) &&  // there was a name change
                  (path.basename(file).match(/\.csv$/) != null)
                );
     }).forEach(function (filteredFile) {
         //var hostname = path.basename(filteredFile).replace("\.local", "");
         //logger.debug("try-catch version %s (%s)", filteredFile, path.extname(filteredFile));
         //var base = path.basename(filteredFile);
         //logger.debug("adding " + filteredFile);
         soestFiles.push(filteredFile);
     });
  } catch (err) {
     logger.error("ERROR CAUGHT in getSoestFiles: " + err);
     process.exit(1);
    return null;
  }
  return soestFiles.sort();
}

let sheetFileToArrayOfArrays = function(soestFile, logger) {
  let filename = path.basename(soestFile);
  let contents = fs.readFileSync(soestFile, 'utf8');
  //logger.debug("contents: " + contents);
  lines = contents.split(/\r\n|\r|\n/);  // should handle UNIX and DOS newlines
  let returnArray = [];
  lines.forEach( function (line) {
    pieces = line.split(",");
    returnArray.push(line.split(','));
  });
  //console.dir(returnArray);
  return returnArray;
}

var readSoestFiles = function(directory, logger) {
  var i, j;
  var siteSamples = [];
  var siteSample = null;
  // this is what is returned: an object whos attributes are the combination of the code
  // and the date that site was collected.
  var locDateHash = {};
  var hashID = null;

  var soestFiles = getSoestFiles(directory, logger); // returning a list of paths of the sheet files

  for (i = 0; i < soestFiles.length; ++i) {
    logger.info("reading Soest file: " + path.basename(soestFiles[i]));
    let filename = path.basename(soestFiles[i]);
    siteSamples = sdsp.parseSoestSheet(sheetFileToArrayOfArrays(soestFiles[i], logger), filename, logger);  // returns a list of objects, each object a site sample
    for (j = 0; j < siteSamples.length; ++j) {
      siteSample = siteSamples[j];
      //logger.debug("siteSample " + util.inspect(siteSample, false, null));
      var hashID = siteSample.Location + "-" + siteSample.Date;
      locDateHash[hashID] = siteSample;
    }
  }
  //logger.debug("sites " + util.inspect(locDateHash, false, null));
  return locDateHash;
};



exports.readSoestFiles = readSoestFiles;
