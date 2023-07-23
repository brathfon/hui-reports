let fs    = require('fs');
let path  = require('path');

// General function for writing files from strings

var writeStringToFile = function (filePath, aString, logger) {

  logger.info(`Writing file to ${filePath}`);

  try {
    fs.writeFileSync(filePath, aString);
    logger.info("The file was saved to " + filePath);
  } catch (err){
    logger.error(`problem writing ${filePath}`);
    logger.error(err);
  }
};


exports.writeStringToFile = writeStringToFile;
