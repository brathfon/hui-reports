var util  = require('util');
var fs    = require('fs');
var path  = require('path');


var isKnownSiteCode = function (siteCode, knownSites) {
  return (knownSites[siteCode]) ? true : false;
}



var parseWebExportFile = function(webExportFile, knownSites) {
  var samples = [];
  var lines;
  var pieces;
  var lineCount = 0;
  var j;

  var contents = fs.readFileSync(webExportFile, 'utf8')
  //console.log("contents: " + contents);
  lines = contents.split("\r");
  lines.forEach( function (line) {
     // console.log("line: " + line);
      ++lineCount;
      pieces = line.split("\t");
     // console.log("line " + lineCount + " line length " + pieces.length);
     // for (j = 0; j < pieces.length; ++j) { console.log(j + "\t" + pieces[j]); }
        if ((pieces.length >= 4) && isKnownSiteCode(pieces[3], knownSites)) {
          //console.log("knownSites['" + pieces[2] + "'] = '" + pieces[3] + "';" + " known -> " + isKnownSiteCode(pieces[3], knownSites));
          //console.log("line: " + line);
          obj = {};
          obj['SampleID']      = pieces[1];
          obj['SiteName']      = pieces[2];
          obj['Location']      = pieces[3];
          obj['Session']       = pieces[4];
          obj['Date']          = pieces[5];
          obj['Time']          = pieces[6];
          obj['Temp']          = pieces[7];
          obj['Salinity']      = pieces[8];
          obj['DO']            = pieces[9];
          obj['DO%']           = pieces[10];
          obj['pH']            = pieces[11];
          obj['Turbidity']     = pieces[12];
          obj['TotalN']        = pieces[13];
          obj['TotalP']        = pieces[14];
          obj['Phosphate']     = pieces[15];
          obj['Silicate']      = pieces[16];
          obj['NNN']           = pieces[17];
          obj['NH4']           = pieces[18];
          obj['NNN_']          = pieces[19];
          obj['NH4_']          = pieces[20];
          obj['Lat']           = pieces[21];
          obj['Long']          = pieces[22];
          //obj['SiteNum']       = pieces[23];  no longer using this as of 2/7/18
          samples.push(obj);
          /*
          console.log("SITE {location: '" + obj.Location  + "', " 
                              + "siteName: '" + obj.SiteName  + "', "
                              + "lat: " + obj.Lat  + ", "
                              + "lon: " + obj.Long  + ", "
                              + "siteNum: " + obj.SiteNum + "},");
          */
        }
        else {
          //console.log("ERROR: unexpected number of column: " + pieces.length + ". Expecting 44.");
        }
    });

  //console.log("sites " + util.inspect(samples, false, null));
  return samples;
};


var readWebExportFile = function(webExportFile, knownSites) {

  var samples = parseWebExportFile(webExportFile, knownSites);
  var j;
  var sessions = {};
  var sample = null;

  for (j = 0; j < samples.length; ++j) {
    sample = samples[j];
    //console.log("sample " + util.inspect(sample, false, null));
    session = sample.Session;
    //console.log("session: " + session);
    if (sessions[session] == null) {
      sessions[session] = [];
    }
    sessions[session].push(sample);
  }
  //console.log("sessions " + util.inspect(sessions, false, null));
  return sessions;
}

/*
takes a list of samples and returns the earliest date. This will probably need to come from the sessions
   data sheet some time, but currently not in there.
*/
var getStartDate = function(samples) {

  var startDate = '9999-99-99';
  for (j = 0; j < samples.length; ++j) {
    siteSample  = samples[j];
    //console.log("DATE : = " + siteSample['Date']);
    if (siteSample['Date'] < startDate) {
      startDate = siteSample['Date'];
    }
  }
  return startDate;
};



exports.readWebExportFile = readWebExportFile;
exports.getStartDate = getStartDate;
//exports.getLab = getLab;
