var util  = require('util');
var fs    = require('fs');
var path  = require('path');


// the key is the site code, which will be the key
var knownSites = [];
knownSites['OCO'] = 'Camp Olowalu';
knownSites['OLP'] = 'Launiupoko';
knownSites['OMM'] = 'Mile Marker 14';
knownSites['OPB'] = 'Papalaua Beach Park';
knownSites['OPM'] = 'Peter Martin Hale';
knownSites['OPP'] = 'Papalaua Pali';
knownSites['OSF'] = 'Olowalu Shore Front';
knownSites['OUB'] = 'Ukumehame Beach';
knownSites['PFF'] = '505 Front Street';
knownSites['PLH'] = 'Lindsey Hale';
knownSites['PLT'] = 'Lahaina Town';
knownSites['PPU'] = 'Puamana';
knownSites['RAB'] = 'Airport Beach';
knownSites['RCB'] = 'Canoe Beach';
knownSites['RFN'] = 'Fleming North';
knownSites['RFS'] = 'Fleming South';
knownSites['RHL'] = 'Honolua Bay';
knownSites['RKO'] = 'Ka\'opala Bay';
knownSites['RKS'] = 'Kaanapali Shores';
knownSites['RKV'] = 'Kahana Village';
knownSites['RNS'] = 'Napili south';
knownSites['RON'] = 'Oneloa Bay';
knownSites['RPO'] = 'Pohaku';
knownSites['RWA'] = 'Wahikuli Beach';

var isKnownSiteCode = function (siteCode) {
  return (knownSites[siteCode]) ? true : false;
}



var readWebExportFile = function(teamFileFile) {
  var siteSamples = [];
  var lines;
  var pieces;
  var lineCount = 0;
  var i;
  var j;
  var locDateHash = {};
  var hashID = null;

  var contents = fs.readFileSync(teamFileFile, 'utf8')
  //console.log("contents: " + contents);
  lines = contents.split("\n");
  for (i = 0; i < lines.length; ++i) {
     // console.log("line: " + line);
      ++lineCount;
      pieces = lines[i].split("\t");
     // console.log("line " + lineCount + " line length " + pieces.length + " : " + lines[i]);
     // for (j = 0; j < pieces.length; ++j) { console.log(j + "\t" + pieces[j]); }
      if ((lineCount > 1) && (pieces.length > 4)){  // skip the header line some short last line
        //console.log("knownSites['" + pieces[2] + "'] = '" + pieces[3] + "';" + " known -> " + isKnownSiteCode(pieces[3]));
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
        obj['Lat']           = pieces[19];
        obj['Long']          = pieces[20];
        obj['QA_Issues']     = pieces[21];
        //obj['SiteNum']       = pieces[23];  no longer using this as of 2/7/18
        siteSamples.push(obj);
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
  }

  for (j = 0; j < siteSamples.length; ++j) {
    siteSample = siteSamples[j];
    //console.log("siteSample " + util.inspect(siteSample, false, null));
    var hashID = siteSample.Location + "-" + siteSample.Date;
    locDateHash[hashID] = siteSample;
  }
  //console.log("sites " + util.inspect(locDateHash, false, null));
  return locDateHash;
};


// save this function in case it is needed and just have the other function return the list
var oldreadSiteFiles = function(directory) {
  var i, j;
  var siteSamples = [];
  var siteSample = null;
  // this is what is returned: an object whos attributes are the combination of the code
  // and the date that site was collected.
  var locDateHash = {};
  var hashID = null;

  var siteFiles = getSiteFiles(directory); // returning a list of paths of the sheet files

  for (i = 0; i < siteFiles.length; ++i) {
    //console.log("Site file: " + siteFiles[i]);
    siteSamples = readSiteFile(siteFiles[i]);  // returns a list of objects, each object a site sample
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



exports.readWebExportFile = readWebExportFile;
//exports.getStartDate = getStartDate;
//exports.getLab = getLab;
