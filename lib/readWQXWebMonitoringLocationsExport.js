//************************************************************************************************
// This library reads the csv CsvFiles saved from excel CsvFiles download from the WQX web
// environment.
//************************************************************************************************

var util  = require('util');
var fs    = require('fs');
var path  = require('path');


var parseWQXWebLocationsCsvFile = function(wQXWebLocationCsvFile) {

  // attribute will the be hui site id like "RNS" and value will be a object of key values of site information
  var sites = {};
  var lines;

  var contents = fs.readFileSync(wQXWebLocationCsvFile, 'utf8')
  //console.log("contents: " + contents);
  //lines = contents.split("\n");
  lines = contents.split(/\r\n|\r|\n/);


/* the first line of the file is a header file.  We are only interested in the first 7 fields
  header:
    Organization Formal Name,Monitoring Location UID,Monitoring Location ID,Monitoring Location Name,Monitoring Location Type,Monitoring Location Latitude,Monitoring Location Longitude

  example line:
   HUIWAIOLA_WQX-The Nature Conservancy - Honolulu (Volunteer)*,965633,KCP,Cove Park,BEACH Program Site-Ocean,20.727434,-156.450077
*/


  for (let i = 1; i < lines.length; ++i) 
  {
      const line = lines[i];
      //console.log("line: " + line);

      const pieces = line.split(",");

      //console.log("line " + i + " line length " + pieces.length);
      //for (let j = 0; j < pieces.length; ++j) { console.log(j + "\t" + pieces[j]); }

      if (pieces.length == 56) {
        //console.log("line: " + line);
        obj = {};
        obj['Organization_ID']          = pieces[0].trim();
        obj['Monitoring_Location_UID']  = pieces[1].trim();  // internal ID
        obj['Monitoring_Location_ID']   = pieces[2].trim();  // Hui id: example KCP
        obj['Monitoring_Location_Name'] = pieces[3].trim();
        obj['Monitoring_Location_Type'] = pieces[4].trim();
        obj['Latitude']                 = pieces[5].trim(); // ex: 20.994222
        obj['Longitude']                = pieces[6].trim(); // ex: -156.667417

        // create a key-value pair of the hui_abv and the site data for easy of lookup
        // some of the sites in the table have no Hui ID, and we are not interested in them
        if (obj.Monitoring_Location_ID != "") {
          sites[obj.Monitoring_Location_ID] = obj;
        }
      }
      else {
        console.log("ERROR: unexpected number of column: " + pieces.length + ". Expecting 56 or more. Line: " + line);
      }
    };

  console.log("sites " + util.inspect(sites, false, null));
  return sites;
};


var readWQXWebLocationsCsvFile = function(wQXWebLocationCsvFile) {

  return parseWQXWebLocationsCsvFile(wQXWebLocationCsvFile);

}


exports.readWQXWebLocationsCsvFile = readWQXWebLocationsCsvFile;
