

var util  = require('util');
var fs    = require('fs');
var path  = require('path');
var validator = require('./validator.js');

var reportError = function (theError, SampleID, filename) {
 console.log("-- " + theError + " sample: " + SampleID + " in " + filename );
 console.error(theError + " sample: " + SampleID + " in " + filename );
  //process.exit(1);
};

/* returns the lines from the spread sheet in a list, one object per line 

The objects look like this:
[ { Nut_Dup: 'no',
    Sed_Sample: 'no',
    Session: '28',
    Team: 'Olowalu',
    Lab: 'LLHS',
    Sampler: 'RN',
    Sampler2: 'MG',
    Sampler3: 'LO',
    Station: 'OPM',
    SampleID: 'OPM171005',
    Location: '2073',
    SiteName: 'Martin Hale',
    ......
*/

var readTeamSheet = function(teamSheetFile) {
  var lineList = [];
  var lines;
  var pieces;
  var lineCount = 0;
  var j;
  var contents = fs.readFileSync(teamSheetFile, 'utf8')
  var filename = path.basename(teamSheetFile);
  //console.log("contents: " + contents);
  lines = contents.split("\n");
  lines.forEach( function (line) {
      //console.log("line: " + line);
      ++lineCount;
      pieces = line.split("\t");
      //console.log("line " + lineCount + " line length " + pieces.length);
      if (lineCount > 3) {  // first three lines are header information
        // for (j = 0; j < pieces.length; ++j) { console.log(j, pieces[j]); }  // print out all pieces for debug
        if (pieces.length === 44) {
          obj = {};
          obj['Added_to_Main'] =  pieces[0];  // not going to use this
          obj['Ver_By_Dana']   =  pieces[1];  // not going to use this
          obj['Nut_Dup']       =  pieces[2];
          obj['Sed_Sample']    =  pieces[3];
          obj['Session']       =  pieces[4];
          obj['Team']          =  pieces[5];
          obj['Lab']           =  pieces[6];
          obj['Sampler']       =  pieces[7];
          obj['Sampler2']      =  pieces[8];
          obj['Sampler3']      =  pieces[9];
          obj['Station']       = pieces[10];
          obj['SampleID']      = pieces[11];
          // had a problem where spreadsheet was changed when sites were changed and had column shifts that mismatched the
          // stationID and SampleID.  Check here and print to stderr
          let stationFromSampleID = obj.SampleID.substr(0,3);
          //console.log(`STATIONID : ${obj.Station}, ID from SampleID : ${stationFromSampleID}`);
          if (obj.Station !== stationFromSampleID) {
            console.error(`Found stationID inconsistance on line ${line}`);
            console.error(`stationID : ${obj.Station} not equal to ID from SampleID : ${obj.SampleID} file: ${filename}`);
          }

          obj['Location']      = pieces[12];
          obj['SiteName']      = pieces[13];

          validator.isDate(pieces[14])       ? obj['Date']    = pieces[14] : reportError("'" + pieces[14] + "' date is not a correctly formed (YYYY-MM-DD)", obj.SampleID, filename);

          // had a problem where date in the SampleID did not the date field
          let dateFromSampleID = `20${obj.SampleID.substr(3,2)}-${obj.SampleID.substr(5,2)}-${obj.SampleID.substr(7,2)}`;    // ex: RSN180622 -> 2018-06-22
          // console.error(`DATES ${obj['Date']} ${dateFromSampleID}`);
          if (obj.Date !== dateFromSampleID) {
            console.error(`Found Date inconsistance on line ${line}`);
            console.error(`date : ${obj.Date} not equal to date from SampleID : ${obj.SampleID}`);
          }
        

          //console.error("TIME : ", pieces[15]);
          if (validator.isHourMinute(pieces[15]) ) {
             obj['Time']    = pieces[15];
          }
          else if (pieces[15] === "") {  // if a site is not sampled due to conditions at the site, etc.  The time will be blank
             reportError("'" + pieces[15] + "' time is blank, which may be a uncollected sample, setting to NULL", obj.SampleID, filename);
             obj['Time']    = "null";
          }
          else {
             reportError("'" + pieces[15] + "' time is not a correctly formed (HH-MM)", obj.SampleID, filename);
          }
          obj['40D#']          = pieces[16];
          obj['2100Q#']        = pieces[17];
          obj['pHInst#']       = pieces[18];
          obj['DOInst#']       = pieces[10];
          obj['SalInst#']      = pieces[20];
          obj['Moon']          = pieces[21];
          obj['Cloud_1_8']     = pieces[22];
          obj['Rain_1_4']      = pieces[23];
          obj['Wind_dir']      = pieces[24];
          obj['SampleID2']     = pieces[25];
          obj['Temp']          = pieces[26];
          obj['Salinity']      = pieces[27];
          obj['DO']            = pieces[28];
          obj['DO%']           = pieces[29];
          obj['pH']            = pieces[30];
          obj['Turb1']         = pieces[31];
          obj['Turb2']         = pieces[32];
          obj['Turb3']         = pieces[33];
          obj['Average Turbidity'] = pieces[34];
          obj['CV Turbidity']      = pieces[35];
          obj['blank']      = pieces[36];    // for some reason getting a blank column
          obj['Waves']      = pieces[37];
          obj['Wind']       = pieces[38];
          obj['Stream']     = pieces[39];
          obj['Swimmers']   = pieces[40];
          obj['On Beach']   = pieces[41];
          obj['Campers']    = pieces[42];
          obj['Comments']   = pieces[43];
          // get rid of the Microsoft end of line char
          obj['Comments']   = obj['Comments'].replace("\r", "");
          lineList.push(obj);
        }
        else {
          console.error("ERROR: unexpected number of column: " + pieces.length + ". Expecting 44.");
          console.error("ERROR: Line: " + line);
        }
      }
    });
  return lineList;
};



/* gets the paths to the team sheets */

var getTeamSheets = function(directory) {
  var teamSheets = [];
  //console.log("checking directory " + directory);
  try {
     var files = fs.readdirSync(directory);
     files.map(function (file) {
         return path.join(directory, file);
     }).filter(function (file) {
         //console.log("checking file " + file);
         return (
                  fs.statSync(file).isFile() &&
                  (path.basename(file).match(/^Team/) != null) &&
                  (path.basename(file).match(/\.tsv$/) != null)
                );
     }).forEach(function (filteredFile) {
         //var hostname = path.basename(filteredFile).replace("\.local", "");
         //console.log("try-catch version %s (%s)", filteredFile, path.extname(filteredFile));
         //var base = path.basename(filteredFile);
         //console.log("adding " + filteredFile);
         teamSheets.push(filteredFile);
     });
  } catch (err) {
     console.log("ERROR CAUGHT in getTeamSheets: " + err);
    return null;
  }
  return teamSheets.sort();
}

/* returns an array of session objects */

var readTeamSheets = function(directory) {
  var i, j;
  var sessions = {};
  var session  = null;
  var siteSamples = [];
  var siteSample = null;
  var teamSheets = getTeamSheets(directory); // returning a list of paths of the sheet files
  var startDate = null;
  var endDate   = null;


  for (i = 0; i < teamSheets.length; ++i) {
    //console.log("Team sheet: " + teamSheets[i]);
    siteSamples = readTeamSheet(teamSheets[i]);  // returns a list of objects, each object a site sample
    for (j = 0; j < siteSamples.length; ++j) {
      siteSample = siteSamples[j];
      //console.log("siteSample " + util.inspect(siteSample, false, null));
      // make the key to the list a combination of Lab ID and Session since the labs have their own independent Sessions number
      session = siteSample.Lab + ":" + siteSample.Session;
      //console.log("session: " + session);
      if (sessions[session] == null) {
        sessions[session] = [];
      }
      sessions[session].push(siteSample);
    }
  }
  return sessions;
};


/*
takes a list of siteSamples and returns the earliest date. This will probably need to come from the sessions
   data sheet some time, but currently not in there.
*/
var getStartDate = function(siteSamples) {

  var startDate = '9999-99-99';
  for (j = 0; j < siteSamples.length; ++j) {
    siteSample  = siteSamples[j];
    //console.log("DATE : = " + siteSample['Date']);
    if (siteSample['Date'] < startDate) {
      startDate = siteSample['Date'];
    }
  }
  return startDate;
};


var getLab = function(siteSamples) {

  let lab = null;
  for (j = 0; j < siteSamples.length; ++j) {
    let siteSample  = siteSamples[j];
    //console.log("LAB : = " + siteSample['Lab']);
    if (! lab ) {
      lab = siteSample['Lab'];
    } 
    else {
      if (lab != siteSample['Lab']) {
        console.log("ERROR: expecting all lab values to be the same for this set of samples");
        console.log(`expecting ${lab} but found ${siteSample['Lab']} for sampleID ${siteSample['SampleID']} session ${siteSample['Session']}`);
        console.error("ERROR: expecting all lab values to be the same for this set of samples");
        console.error(`expecting ${lab} but found ${siteSample['Lab']} for sampleID ${siteSample['SampleID']} session ${siteSample['Session']}`);
      }
    }
  }
  return lab;
};

exports.readTeamSheets = readTeamSheets;
exports.getStartDate = getStartDate;
exports.getLab = getLab;



