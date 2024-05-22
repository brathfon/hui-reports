var util  = require('util');
var fs    = require('fs');
var path  = require('path');


// this script provides a function to read the tab-delimited files from WQP/STORET
// when you download them from the portal.  In Feb of 2022 the format of the spread-sheet
// changed, which added latitude and longitude and changed the position of some of the
// data.


// a little helper function
// look up attribute name from Storet to find the one for doing the comparison

var attrLookup = function(attr) {

  var storetToCommon = {
       'Temperature, water'           : 'Temp',
       'Ammonium'                      : 'NH4',
       Salinity                        : 'Salinity',
       'Nitrate + Nitrite'             : 'NNN',
       'Total Nitrogen, mixed forms'   : 'TotalN',
       'Orthophosphate'                : 'Phosphate',
       'Total Phosphorus, mixed forms' : 'TotalP',
       Silicate                        : 'Silicate',
       Turbidity                       : 'Turbidity',
       'Dissolved oxygen saturation'   : 'DO%',
       'Dissolved oxygen (DO)'         : 'DO',
       'pH'                            : 'pH'
  };

  if (storetToCommon[attr] === undefined ) {
    console.error(`Could not find a attribute lookup for ${attr}.  Exiting`);
    process.exit(1);
  }
    return storetToCommon[attr];
};


var readStoretFile = function(storetFile) {
  var allSamples = [];
  var lines;
  var pieces;
  var lineCount = 0;
  var i;
  var j;
  var locDateHash = {};
  var hashID = null;
  const expectedLineLength = 81;  // new length as of 2/2022

  // as of 2/2022, the lat and lon are part of each record in the physicalchemical spread sheet that gets downloaded.
  // Since each row is 1 measurement, the lat and lon is repeated many times for each set of samples for a site,
  // so it needs to be handled a bit differently than the other measurements.

  let latKV = {}; // keys are sample ids, value latitude of the sample site
  let lonKV = {}; // keys are sample ids, value is longitude of the sample site

  var contents = fs.readFileSync(storetFile, 'utf8')
  //console.log("contents: " + contents);
  lines = contents.split("\n");
  for (i = 0; i < lines.length; ++i) {
     // console.log("line: " + line);
      ++lineCount;
      pieces = lines[i].split("\t");
      //console.log("line " + lineCount + " line length " + pieces.length + " : " + lines[i]);
      //console.log("line " + lineCount + " line length " + pieces.length);
      //for (j = 0; j < pieces.length; ++j) { console.log(j + "\t" + pieces[j]); }
      if (lineCount > 1){ // skip the header line
        if (pieces.length == expectedLineLength){
          //console.log("knownSites['" + pieces[2] + "'] = '" + pieces[3] + "';" + " known -> " + isKnownSiteCode(pieces[3]));
          obj = {};
          var imbeddedSampleID = pieces[2]; // ActivityIdentifier
          obj['SampleID']      = imbeddedSampleID.substring(14,23);  // ex: PPU161019
          obj['Location']      = imbeddedSampleID.substring(14,17);  // hui_abv ex: PPU
          var imbeddedDate     = "20" + imbeddedSampleID.substring(17,23);   // HUIWAIOLA_WQX-PPU170419PO4, date from this is 170419
          var dateEntryNoDashes = pieces[6].substring(0,4) + pieces[6].substring(5,7) + pieces[6].substring(8);  // ActivityStartDate
          obj['Date'] = pieces[6].substring(5,7) + "/" + pieces[6].substring(8) + "/" + pieces[6].substring(2,4);  // MM/DD/YY
          obj['Time']          = pieces[7].substring(0,5);  // convert from HH:MM:SS to HH:MM from ActivityStartTime/Time

          // handle the latitude and longitude

          let lat  = pieces[29];   // ActivityLocation/LatitudeMeasure
          let lon  = pieces[30];   // ActivityLocation/LongitudeMeasure

          if (! latKV[obj.SampleID]) {
            latKV[obj.SampleID] = lat;
          }
          else { // if it already exists, make sure it is the same
        
            if (latKV[obj.SampleID] !== lat) {
              console.error(`ERROR: the latitude already found for ${obj.SampleID} of ${latKV[obj.SampleID]} does not equal the current one of ${lat}`);
            }
          }

          if (! lonKV[obj.SampleID]) {
            lonKV[obj.SampleID] = lon;
          }
          else { // if it already exists, make sure it is the same
        
            if (lonKV[obj.SampleID] !== lon) {
              console.error(`ERROR: the longitude already found for ${obj.SampleID} of ${lonKV[obj.SampleID]} does not equal the current one of ${lon}`);
            }
          }
        

          // not used
          //var sampleTypeFromCode = imbeddedSampleID.substring(23);  // HUIWAIOLA_WQX-PPU170419PO4, last chars after the date
          //console.log("SAMPLE TYPE " + pieces[31] + ", "  + sampleTypeFromCode + ", " + obj.sampleType);

          if (pieces.length == expectedLineLength) { 
            obj['sampleType']     = attrLookup(pieces[39]);  // CharacteristicName
            obj['sampleValue']    = pieces[41];              // ResultMeasureValue
            obj['sampleUnits']    = pieces[42];              // ResultMeasure/MeasureUnitCode, not really used

          }
          else {
            console.error(`Found a line length other than ${expectedLineLength} of ${pieces.length}`);
            process.exit(1);
          }
          if (imbeddedDate !== dateEntryNoDashes) {
            console.error("DATE DIFF SAME ENTRY WARNING " + obj.Location +  " " + imbeddedDate + " " + dateEntryNoDashes + " " + obj.sampleType + " " + obj.sampleValue);
            //console.log("DATE DIFF SAME ENTRY " + obj.Location +  " " + imbeddedDate + " " + dateEntryNoDashes + " " + obj.sampleType + " " + obj.sampleValue);
          }

          allSamples.push(obj);

          /*
          console.log("SITE {location: '" + obj.Location  + "', " 
                              + "siteName: '" + obj.SiteName  + "', "
                              + "lat: " + obj.Lat  + ", "
                              + "lon: " + obj.Long  + ", "
                              + "siteNum: " + obj.SiteNum + "},");
          */
      }
      else {
        console.log(`ERROR: unexpected number of columns: ${pieces.length}. Expecting ${expectedLineLength}.`);
      }
    }
  }

  for (j = 0; j < allSamples.length; ++j) {
    aMeasurement = allSamples[j];
    //console.log("aMeasurement " + j + " " + util.inspect(aMeasurement, false, null));
    var hashID = aMeasurement.Location + "-" + aMeasurement.Date;
    if (! locDateHash[hashID]) {  // first time seeing this hash id
      locDateHash[hashID] = {};
    }
    var sample = locDateHash[hashID];
    sample['SampleID'] = aMeasurement.SampleID;
    sample['Location'] = aMeasurement.Location;
    sample['Date'] = aMeasurement.Date;
    sample['Time'] = aMeasurement.Time;
    sample[aMeasurement.sampleType] = aMeasurement.sampleValue;

    // handle the latitude and longitude
    if (latKV[sample.SampleID]) {
      sample['Lat'] = latKV[aMeasurement.SampleID];
    }

    if (lonKV[sample.SampleID]) {
      sample['Long'] = lonKV[aMeasurement.SampleID];
    }
  }
  //console.log("sites " + util.inspect(locDateHash, false, null));
  return locDateHash;
};


// save this function in case it is needed and just have the other function return the list



exports.readStoretFile = readStoretFile;
