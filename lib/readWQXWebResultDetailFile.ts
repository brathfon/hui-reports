//************************************************************************************************
// This library reads tsv files saved from excel results files downloaded from the WQX web
// environment.  The Excel file is usually named Results Detail Export xxxxx.xlsx.  After doing a "save as"
// from Excel, change the suffix of the file from .txt to .tsv and rename ResultDetailFile.tsv.
// It can be left with DOS newlines or converted over to UNIX newlines.
// Note: when working on the 2023 3rd quarter delivery, the results file report changed
// from 20 to 251 columns
//************************************************************************************************

import * as fs from 'fs';
import * as log from './logFormatter';
import type { LogMessage } from './logFormatter';

// One sample from WQX. A sample is made up of several activities, ex: RPO160614:FM:PS:TS: holds the
// temperature and salinity results and RPO160614:SR:WB: holds the nutrient results.
export interface WQXSample {
  Source: string;
  SampleID: string;
  Monitoring_Location_ID: string;
  Activity_Start_Date: string;   // MM-DD-YYYY
  Detection_Condition: string;
  // key is the characteristic, ex: 'Temperature, water': '25.7'
  results: Record<string, string>;
  // key is the characteristic, value is the ID of the activity the result belongs to,
  // ex: 'Temperature, water': 'RPO160614:FM:PS:TS:'. Needed to delete results from WQX.
  activityIDs: Record<string, string>;
}

export interface WQXResults {
  samples: Record<string, WQXSample>;   // key is sampleID
  log: LogMessage[];
  status: 'SUCCESS' | 'FAILURE';
}

/**
This function goes through the rows from the ResultDetailFile and accumulates the measurements
for a given sample ID. It returns an object with 3 keys: "samples", "log" and "status"
samples is an object with key value pairs of sample IDs and an object that is the collection
of all the measurements for that sample found in the data file.  Note: each row in the data
file is one measurement for that sample set.

 {
  samples: {
    RPO160614: {
      Source: 'wqx',
      SampleID: 'RPO160614',
      Monitoring_Location_ID: 'RPO',
      Activity_Start_Date: '06-14-2016',
      Detection_Condition: '',
      results: {
        'Temperature, water': '25.7',
        Salinity: '33.3',
        'Dissolved oxygen (DO)': '6.86',
        ....
        Ammonium: '2.81'
      },
      activityIDs: {
        'Temperature, water': 'RPO160614:FM:PS:TS:',
        Salinity: 'RPO160614:FM:PS:TS:',
        'Dissolved oxygen (DO)': 'RPO160614:FM:PS:DO:',
        ....
        Ammonium: 'RPO160614:SR:WB:'
      }
    },
....
  },
  log: [
    {
      when: 1699319513419,
      level: 'INFO',
      msg: '43705 lines found in /Users/bill/development/water-quality/water-quality-data/storet/20230721a-wqx-2nd-quarter-2023-sync-prep/ResultsExport.tsv'
    },
    {
      when: 1699319513528,
      level: 'INFO',
      msg: 'Processed 43705 results from WQX resulting in 3721 samples'
    }
  ],
  status: 'SUCCESS'
}
*/



const parseWQXWebResultsFile = function(wQXResultsFile: string): WQXResults {


  // this is the overall object that will be returned.  There will be several attribute/value pairs in that object
  // obj['samples'] = object containing samples with the key being the sampleID, value being the measurements from that sample 
  // obj['status'] = string that is an overall status: SUCCESS, FAILURE
  // obj['log'] = array of logging messages
  // results object: attribute will the be hui sample ID like "RCB160614" and value will be a object of key values of site information
  const samples: Record<string, WQXSample> = {};   // use this reference for convenience
  const logList: LogMessage[] = [];                // use this reference for convenience
  const returnData: WQXResults = {
    samples,
    log: logList,
    status: 'SUCCESS',    // will assume all went well
  };

  const contents = fs.readFileSync(wQXResultsFile, 'utf8')
  //console.log("contents: " + contents);
  const lines = contents.split(/\r\n|\r|\n/);

  log.info(`${lines.length - 1} lines found in ${wQXResultsFile}`, logList);

  const columnNames: Record<string, string> = {
    Organization_ID: "Organization Formal Name",
    Monitoring_Location_ID: "Monitoring Location ID",
    Monitoring_Location_Name: "Monitoring Location Name",
    Activity_ID: "Activity ID",
    Activity_Start_Date: "Activity Start Date",
    Activity_Type: "Activity Type",
    Media: "Activity Media Name",
    Media_Subdivision: "Activity Media Subdivision Name",
    Result_UID: "Result UID",
    Characteristic: "Characteristic Name",
    Fraction: "Result Sample Fraction Text",
    Statistic: "Statistical Base Code",
    Value: "Result Measure Value",
    Unit: "Result Measure Unit Code",
    Value_Type: "Result Value Type Name",
    Detection_Condition: "Result Detection Condition Text",
    Biological_Intent: "Biological Intent Name",
    Taxon_Name: "Subject Taxonomic Name",
    Status: "Result Status Identifier",
    Last_Changed: "Last Change Date" 
  };
  const columns = lines[0].split("\t");
  const columnIndices = Object.keys(columnNames).reduce((acc, key) => {
    acc[key] = columns.indexOf(columnNames[key]);
    if (acc[key] === -1) {
      console.error(`Column ${columnNames[key]} not found in the file`);
      log.error(`Column ${columnNames[key]} not found in the file`, logList);
      returnData.status = 'FAILURE';
    }
    return acc;
  }, {} as Record<string, number>);

  if (returnData.status === 'FAILURE') {
    return returnData;
  }

  let resultsCount = 0;
  let samplesCount = 0;
  for (let i = 1; i < lines.length; ++i) 
  {
      const line = lines[i];
      if (line.trim() === "") {  // skip blank lines, such as one at the end of the file
        continue;
      }

      // tab delimited
      const pieces = line.split("\t");

      ++resultsCount;
      const obj = Object.keys(columnIndices).reduce((acc, key) => {
        acc[key] = (pieces[columnIndices[key]] ?? "").trim();
        if (acc[key].startsWith('"') && acc[key].endsWith('"')) {
          acc[key] = acc[key].slice(1, -1);
        }
        return acc;
      }, {} as Record<string, string>);

      if (addResult(samples, obj)) {
        ++samplesCount;
      }
    };
    log.info(`Processed ${resultsCount} results from WQX resulting in ${samplesCount} samples`, logList);

  //console.log("return data " + util.inspect(returnData, false, null));
  return returnData;
};


/**
 * Adds one result row from a WQX results file to the sample it belongs to, creating the sample if
 * this is its first result. Returns true if a new sample was created.
 */
export const addResult = function(samples: Record<string, WQXSample>, row: Record<string, string>): boolean {
  // the Activity_ID coming from WQX includes the sampleID used by the HUI.  For example, it is
  // from WQX RCB160614:SR:WB:
  // Hui ID is: RCB160614
  // note: the WQX Activity_ID can vary in number of parts separated by :
  const sampleID = row.Activity_ID.split(":")[0];
  let isNew = false;
  if (! samples[sampleID]) {
    isNew = true;
    samples[sampleID] = {
      Source: "wqx",
      SampleID: sampleID,
      Monitoring_Location_ID: row['Monitoring_Location_ID'],
      Activity_Start_Date: row['Activity_Start_Date'],
      Detection_Condition: row['Detection_Condition'],
      results: {},
      activityIDs: {},
    };
  }
  const sample = samples[sampleID];
  // really only interested in the Characteristic and it's value.
  if (row.Detection_Condition === "") {
    sample.results[row.Characteristic] = row.Value;
  }
  else { //Some values might be under the detection limit and must be handled differently
    sample.results[row.Characteristic] = "<Below-Method-Detection-Limit";
  }
  sample.activityIDs[row.Characteristic] = row.Activity_ID;
  return isNew;
};


export const readWQXWebResultsFile = function(wQXResultsFile: string): WQXResults {
  return parseWQXWebResultsFile(wQXResultsFile);

}
