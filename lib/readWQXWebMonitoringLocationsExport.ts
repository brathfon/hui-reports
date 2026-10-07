//************************************************************************************************
// This library reads the tab separated saved from the MonitoringLocationDetailExport.xlsx
// file unzipped from thei MonitoringLocationDetailExport XXXXX.zip exported from WQX.
//************************************************************************************************

import * as fs from 'fs';

const EXPECTED_COLUMNS = 56;

export interface WQXLocation {
  Organization_ID: string;
  Monitoring_Location_UID: string;   // internal ID
  Monitoring_Location_ID: string;    // Hui id: example KCP
  Monitoring_Location_Name: string;
  Monitoring_Location_Type: string;
  Latitude: string;                  // ex: 20.994222
  Longitude: string;                 // ex: -156.667417
}

// key is the Hui site id, ex: KCP
export type WQXLocations = Record<string, WQXLocation>;


const parseWQXWebLocationsCsvFile = function(wQXWebLocationCsvFile: string): WQXLocations {

  // attribute will the be hui site id like "RNS" and value will be a object of key values of site information
  const sites: WQXLocations = {};

  const contents = fs.readFileSync(wQXWebLocationCsvFile, 'utf8')
  //console.log("contents: " + contents);
  const lines = contents.split(/\r\n|\r|\n/); // splits UNIX or Windows files


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

      const pieces = line.split("\t");

      if (pieces.length == EXPECTED_COLUMNS) {
        //console.log("line: " + line);
        const obj: WQXLocation = {
          Organization_ID:          pieces[0].trim(),
          Monitoring_Location_UID:  pieces[1].trim(),
          Monitoring_Location_ID:   pieces[2].trim(),
          Monitoring_Location_Name: pieces[3].trim(),
          Monitoring_Location_Type: pieces[4].trim(),
          Latitude:                 pieces[5].trim(),
          Longitude:                pieces[6].trim(),
        };

        // create a key-value pair of the hui_abv and the site data for easy of lookup
        // some of the sites in the table have no Hui ID, and we are not interested in them
        if (obj.Monitoring_Location_ID != "") {
          sites[obj.Monitoring_Location_ID] = obj;
        }
      }
      else if (line.trim() !== "") {  // blank lines, such as at the end of the file, are expected
        console.log(`ERROR: unexpected number of columns: ${pieces.length}. Expecting ${EXPECTED_COLUMNS}. Line ${i + 1}: ${line}`);
      }
    };

  //console.log("sites " + util.inspect(sites, false, null));
  return sites;
};


export const readWQXWebLocationsCsvFile = function(wQXWebLocationCsvFile: string): WQXLocations {

  return parseWQXWebLocationsCsvFile(wQXWebLocationCsvFile);

}
