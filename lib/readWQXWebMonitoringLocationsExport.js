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


  // The first line is a header.  The rest are tab-delimited lines of site information
  // Hui ID  Status  Area    Site Name       Station Name    Display Name    DOH ID  Surfrider ID    Lat     Long    Dates Sampled^M
  // PFF     Active  Polanui 505 Front Street                505 Front St                    20.86732        -156.67605      ^M

  for (let i = 1; i < lines.length; ++i) 
  {
      const line = lines[i];
      //console.log("line: " + line);

      const pieces = line.split(",");

      //console.log("line " + i + " line length " + pieces.length);
      //for (let j = 0; j < pieces.length; ++j) { console.log(j + "\t" + pieces[j]); }

      if (pieces.length == 7) {
        //console.log("line: " + line);
        obj = {};
        obj['Organization_ID']          = pieces[0].trim();
        obj['Monitoring_Location_ID']   = pieces[1].trim();
        obj['Monitoring_Location_Name'] = pieces[2].trim();
        obj['Monitoring_Location_Type'] = pieces[3].trim();
        obj['Latitude']                 = pieces[4].trim(); // ex: 20.994222
        obj['Longitude']                = pieces[5].trim(); // ex: -156.667417
        obj['Last_Changed']             = pieces[6].trim();

        // create a key-value pair of the hui_abv and the site data for easy of lookup
        // some of the sites in the table have no Hui ID, and we are not interested in them
        if (obj.Monitoring_Location_ID != "") {
          sites[obj.Monitoring_Location_ID] = obj;
        }
      }
      else {
        console.log("ERROR: unexpected number of column: " + pieces.length + ". Expecting 14 or more. Line: " + line);
      }
    };

  //console.log("sites " + util.inspect(sites, false, null));
  return sites;
};


var readWQXWebLocationsCsvFile = function(wQXWebLocationCsvFile) {

  return parseWQXWebLocationsCsvFile(wQXWebLocationCsvFile);

}


exports.readWQXWebLocationsCsvFile = readWQXWebLocationsCsvFile;
