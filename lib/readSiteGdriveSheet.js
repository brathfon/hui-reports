var util  = require('util');
var fs    = require('fs');
var path  = require('path');


var parseSiteGdriveSheet = function(siteGdriveSheet) {

  // attribute will the be hui site id like "RNS" and value will be a object of key values of site information
  var sites = {};
  var lines;

  var contents = fs.readFileSync(siteGdriveSheet, 'utf8')
  //console.log("contents: " + contents);
  lines = contents.split(/\r\n|\r|\n/);


  // The first line is a header.  The rest are tab-delimited lines of site information
  // Hui ID  Status  Area    Site Name       Station Name    Display Name    DOH ID  Surfrider ID    Lat     Long    Dates Sampled^M
  // PFF     Active  Polanui 505 Front Street                505 Front St                    20.86732        -156.67605      ^M

  for (let i = 1; i < lines.length; ++i) 
  {
      const line = lines[i];
      //console.log("line: " + line);

      const pieces = line.split("\t");

      //console.log("line " + i + " line length " + pieces.length);
      //for (let j = 0; j < pieces.length; ++j) { console.log(j + "\t" + pieces[j]); }

      if (pieces.length == 11) {
        //console.log("line: " + line);
        obj = {};
        obj['Hui_ID']        = pieces[0].trim();  // Hui_ID header in spreadsheet
        obj['siteCode']      = pieces[0].trim();  // some scripts expect for Hui_ID
        obj['Status']        = pieces[1].trim();
        obj['Area']          = pieces[2].trim();
        obj['Site_Name']     = pieces[3].trim();
        obj['long_name']     = pieces[3].trim();  // some scripts expect long_name (from db)
        obj['Station_Name']  = pieces[4].trim();
        obj['Display_Name']  = pieces[5].trim();
        obj['DOH_ID']        = pieces[6].trim();
        obj['Surfrider_ID']  = pieces[7].trim();
        obj['Lat']           = pieces[8].trim();  // ex: 20.994222
        obj['lat']           = pieces[8].trim();  // some scripts expect lower case (from db)
        obj['Long']          = pieces[9].trim(); // ex: -156.667417
        obj['lon']           = pieces[9].trim(); //  some scripts expect lower case (from db)
        obj['Aqualink_ID'] = pieces[10].trim();  // the ID that Aqualink assigned our sites when they were added

        // create a key-value pair of the hui_abv and the site data for easy of lookup
        // some of the sites in the table have no Hui ID, and we are not interested in them
        if (obj.Hui_ID != "") {
          sites[obj.Hui_ID] = obj;
        }
      }
      else {
        console.log("ERROR: unexpected number of column: " + pieces.length + ". Expecting 11 Line: " + line);
      }
    };

  //console.log("sites " + util.inspect(sites, false, null));
  return sites;
};


var readSiteGdriveSheet = function(siteGdriveSheet) {

  return parseSiteGdriveSheet(siteGdriveSheet);

}


exports.readSiteGdriveSheet = readSiteGdriveSheet;
