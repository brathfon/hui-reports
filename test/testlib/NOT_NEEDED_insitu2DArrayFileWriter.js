let fs    = require('fs');
let path  = require('path');

// General function for writing files.  May want to move to lib
// and use other places.

var writeFile_ = function (filePath, dataToWrite, logger) {

  logger.info(`Writing file to ${filePath}`);

  try {
    fs.writeFileSync(filePath, dataToWrite);
    logger.info("The file was saved to " + filePath);
  } catch (err){
    logger.error(`problem writing ${filePath}`);
    logger.error(err);
  }
};


let writeTeamSheets = function(filePath, textToWrite, logger) {

  writeFile_(filePath, textToWrite, logger);
};


exports.writeTeamSheets = writeTeamSheets;
