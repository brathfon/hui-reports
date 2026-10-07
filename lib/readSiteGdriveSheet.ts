import * as fs from 'fs';
import * as path from 'path';
import { IssueLog, defaultIssueLog } from './issues';

export interface Site {
  Hui_ID: string;        // Hui_ID header in spreadsheet
  siteCode: string;      // some scripts expect for Hui_ID
  Status: string;
  Area: string;
  Site_Name: string;
  long_name: string;     // some scripts expect long_name (from db)
  Station_Name: string;
  Display_Name: string;
  DOH_ID: string;
  Surfrider_ID: string;
  Lat: string;           // ex: 20.994222
  lat: string;           // some scripts expect lower case (from db)
  Long: string;          // ex: -156.667417
  lon: string;           //  some scripts expect lower case (from db)
  Aqualink_ID: string;   // the ID that Aqualink assigned our sites when they were added
}

// key is the hui site id like "RNS"
export type Sites = Record<string, Site>;

const parseSiteGdriveSheet = function(siteGdriveSheet: string, issues: IssueLog): Sites {

  // attribute will the be hui site id like "RNS" and value will be a object of key values of site information
  const sites: Sites = {};
  const filename = path.basename(siteGdriveSheet);

  const contents = fs.readFileSync(siteGdriveSheet, 'utf8')
  //console.log("contents: " + contents);
  const lines = contents.split(/\r\n|\r|\n/);


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

      if (pieces.length == 10 || pieces.length == 11) {
        //console.log("line: " + line);
        const obj: Site = {
          Hui_ID:        pieces[0].trim(),
          siteCode:      pieces[0].trim(),
          Status:        pieces[1].trim(),
          Area:          pieces[2].trim(),
          Site_Name:     pieces[3].trim(),
          long_name:     pieces[3].trim(),
          Station_Name:  pieces[4].trim(),
          Display_Name:  pieces[5].trim(),
          DOH_ID:        pieces[6].trim(),
          Surfrider_ID:  pieces[7].trim(),
          Lat:           pieces[8].trim(),
          lat:           pieces[8].trim(),
          Long:          pieces[9].trim(),
          lon:           pieces[9].trim(),
          Aqualink_ID:   (pieces[10] ?? '').trim(),
        };

        // create a key-value pair of the hui_abv and the site data for easy of lookup
        // some of the sites in the table have no Hui ID, and we are not interested in them
        if (obj.Hui_ID != "") {
          sites[obj.Hui_ID] = obj;
        }
      }
      else if (line.trim() !== "") {  // blank lines, such as at the end of the file, are expected
        issues.error('site-sheet-columns',
          `unexpected number of columns: ${pieces.length}. Expecting 10 or 11. Line: ${line}`,
          { source: `${filename} line ${i + 1}` });
      }
    };

  //console.log("sites " + util.inspect(sites, false, null));
  return sites;
};


export const readSiteGdriveSheet = function(siteGdriveSheet: string, issues: IssueLog = defaultIssueLog): Sites {

  return parseSiteGdriveSheet(siteGdriveSheet, issues);

}
