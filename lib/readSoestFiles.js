var util  = require('util');
var fs    = require('fs');
var path  = require('path');


var isKnownSiteCode = function (siteCode, knownSites) {
  return (knownSites[siteCode]) ? true : false;
}


var getSoestFiles = function(directory) {
  var soestFiles = [];
  //console.log("-- checking directory " + directory);
  try {
     var files = fs.readdirSync(directory);
     files.map(function (file) {
         return path.join(directory, file);
     }).filter(function (file) {
         //console.log("-- checking file " + file);
         return (
                  fs.statSync(file).isFile() &&
                  ((path.basename(file).match(/TNC/) != null) || (path.basename(file).match(/MNMRC/) != null)) &&  // there was a name change
                  (path.basename(file).match(/\.csv$/) != null)
                );
     }).forEach(function (filteredFile) {
         //var hostname = path.basename(filteredFile).replace("\.local", "");
         //console.log("try-catch version %s (%s)", filteredFile, path.extname(filteredFile));
         //var base = path.basename(filteredFile);
         //console.log("adding " + filteredFile);
         soestFiles.push(filteredFile);
     });
  } catch (err) {
     console.log("ERROR CAUGHT in getSoestFiles: " + err);
     console.error("ERROR CAUGHT in getSoestFiles: " + err);
     process.exit(1);
    return null;
  }
  return soestFiles.sort();
}

// The soest ids are supposed to be in this form RPO170103-N-1, with first 3 chars a known site
// and the next four the data.  The final part can be -N-1 or -N-2, if it a reference.

var isValidID = function(ID) {
  return ID.match(/^\w\w\w\d\d\d\d\d\d-N-(1|2)$/);
};


var readSoestFile = function(soestFile, knownSites) {
  var lineList = [];
  var lines;
  var pieces;
  var lineCount = 0;
  var j;
  var contents = fs.readFileSync(soestFile, 'utf8')
  var foundIDLine = false;  // second header line starts with ID
  var siteCode   = null;
  var sampleDate = null;
  var year       = null;
  var mon        = null;
  var day        = null;
  var filename = path.basename(soestFile);

  //console.log("contents: " + contents);
  lines = contents.split("\r");
  lines.forEach( function (line) {
        //console.log("line: " + line);
        ++lineCount;
        pieces = line.split(",");
        // console.log("line " + lineCount + " " + line);
        //console.log("line " + lineCount + " line length " + pieces.length);
        //for (j = 0; j < pieces.length; ++j) {
        //  console.log(pieces[j]);
        //}
        if (pieces[0] === "ID")  {
          foundIDLine = true;
        }
        else if (foundIDLine === true) {
          if (isValidID(pieces[0])) {
            siteCode   = pieces[0].substring(0,3);
            sampleDate = pieces[0].substring(3,9);

            year = sampleDate.substring(0,2);
            mon  = sampleDate.substring(2,4);
            day  = sampleDate.substring(4);

            // strip off leading zeros
            mon = mon.replace(/^0+/g, '');
            day = day.replace(/^0+/g, '');
            //mon = mon.replace(/0+$/g, '').replace(/\.+$/g, '').replace(/^0+/g, '');


            sampleIdExt   = pieces[0].substring(10);
            // console.log("siteCode: " + siteCode +  " sampleData: " + sampleDate + " sampleIdExt: " + sampleIdExt); 
            if (sampleIdExt !== "N-1") {
              console.log("-- replicate sample, skipping. siteCode: " + siteCode +  " sampleData: " + sampleDate + " sampleIdExt: " + sampleIdExt); 
            }
            else if (isKnownSiteCode(siteCode, knownSites)) {
               obj = {};
               obj['SampleID']      = siteCode + sampleDate;
               obj['Location']      = siteCode;
               obj['Date']          = mon + "/" + day + "/" + year;
               obj['TotalN']        = pieces[2];
               obj['TotalP']        = pieces[3];
               obj['Phosphate']     = pieces[4];
               obj['Silicate']      = pieces[5];
               obj['NNN']           = pieces[6];
               obj['NH4']           = pieces[7];
               //console.log("siteSample " + util.inspect(obj, false, null));
               // check some basic things on the measurements to make sure that there are not big problems.
               if (parseFloat(obj['NNN']) + parseFloat(obj['NH4']) > parseFloat(obj['TotalN'])) {
                 console.log("");
                 console.log(`-- WARNING: NNN of ${obj['NNN']} + NH4 of ${obj['NH4']} > TotalN of ${obj['TotalN']} from line ${line}`);
                 console.error("");
                 console.error(`-- WARNING: NNN of ${obj['NNN']} + NH4 of ${obj['NH4']} > TotalN of ${obj['TotalN']} from line ${line}`);
               }
               if (parseFloat(obj['Phosphate'])  > parseFloat(obj['TotalP'])) {
                 console.log("");
                 console.log(`-- WARNING: Phosphate of ${obj['Phosphate']} > TotalP of ${obj['TotalP']} from line ${line}`);
                 console.error("");
                 console.error(`-- WARNING: Phosphate of ${obj['Phosphate']} > TotalP of ${obj['TotalP']} from line ${line}`);
               }
               lineList.push(obj);
            } // is known site
            else {
              console.log("");
              console.log("-- ********************* ERROR ERROR ERROR ERROR ********************* in ",  filename, " line ", lineCount);
              console.log("-- ERROR: found unknown site name of " + siteCode +". from line " + line);
              console.error("");
              console.error("-- ********************* ERROR ERROR ERROR ERROR ********************* in ", filename, " line ", lineCount);
              console.error("-- ERROR: found unknown site name of " + siteCode +". from line " + line);
            }
          } // length greater than 13
          else {
            // there are some lines ofter the ID line that are known to be empty so test for them
            if (line !== "" && 
                ! line.match(/^,*,$/) &&  // finds lines like: ',,,,' ',,,,,,,' 
                line !== ',,110,16,,,3.5,2') {
              console.log("");
              console.log("-- ********************* ERROR ERROR ERROR ERROR ********************* in ", filename, " line ", lineCount);
              console.log("-- ERROR: found invalid ID " + pieces[0] + " Line -> |" + line + "|");
              console.error("");
              console.error("-- ********************* ERROR ERROR ERROR ERROR ********************* in ", filename, " line ", lineCount);
              console.error("-- ERROR: found invalid ID " + pieces[0] + " Line -> |" + line + "|");
            }
          }
        }
        else {
          //console.log("line is not ID line and the ID line has not been found yet");
        }
    });
  return lineList;
};


var readSoestFiles = function(directory, knownSites) {
  var i, j;
  var siteSamples = [];
  var siteSample = null;
  // this is what is returned: an object whos attributes are the combination of the code
  // and the date that site was collected.
  var locDateHash = {};
  var hashID = null;

  var soestFiles = getSoestFiles(directory); // returning a list of paths of the sheet files

  for (i = 0; i < soestFiles.length; ++i) {
    console.log("-- reading Soest file: " + path.basename(soestFiles[i]));
    siteSamples = readSoestFile(soestFiles[i], knownSites);  // returns a list of objects, each object a site sample
    for (j = 0; j < siteSamples.length; ++j) {
      siteSample = siteSamples[j];
      //console.log("siteSample " + util.inspect(siteSample, false, null));
      var hashID = siteSample.Location + "-" + siteSample.Date;
      locDateHash[hashID] = siteSample;
    }
  }
  //console.log("sites " + util.inspect(locDateHash, false, null));
  return locDateHash;
};



exports.readSoestFiles = readSoestFiles;
//exports.getStartDate = getStartDate;
//exports.getLab = getLab;
