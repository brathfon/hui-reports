//************************************************************************************************
// This library reads tsv files saved from excel results files downloaded from the WQX web
// environment.  The Excel file is usually named Results Detail Export xxxxx.xlsx.  After doing a "save as"
// from Excel, change the suffix of the file from .txt to .tsv and rename ResultDetailFile.tsv.
// It can be left with DOS newlines or converted over to UNIX newlines.
// Note: when working on the 2023 3rd quarter delivery, the results file report changed
// from 20 to 251 columns
//************************************************************************************************

var util  = require('util');
var fs    = require('fs');
var path  = require('path');

let log = require('./logFormatter');

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
      Activity_ID: 'RPO160614:FM:PS:TS:',
      Monitoring_Location_ID: 'RPO', 
      Activity_Start_Date: '06-14-2016', 
      Detection_Condition: '',
      'Temperature, water': '25.7',
      Salinity: '33.3',
      'Dissolved oxygen (DO)': '6.86',
      'Dissolved oxygen saturation': '102.1',
      Turbidity: '13.90',
      pH: '8.11',
      'Total Nitrogen, mixed forms': '311.07',
      'Total Phosphorus, mixed forms': '26.26',
      Orthophosphate: '18.72',
      Silicate: '1697.47', 
      'Nitrate + Nitrite': '233.11', 
      Ammonium: '2.81' 
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



var parseWQXWebResultsFile = function(wQXResultsFile) {


  // this is the overall object that will be returned.  There will be several attribute/value pairs in that object
  // obj['samples'] = object containing samples with the key being the sampleID, value being the measurements from that sample 
  // obj['status'] = string that is an overall status: SUCCESS, FAILURE
  // obj['log'] = array of logging messages
  let returnData = {};

  // results object: attribute will the be hui sample ID like "RCB160614" and value will be a object of key values of site information
  let samples = {};                      // use this reference for convenience
  let logList = [];                      // use this reference for convenience
  returnData['samples'] = samples;
  returnData['log'] = logList; 
  returnData['status'] = 'SUCCESS';    // will assume all went well

  let lines;
  let contents = fs.readFileSync(wQXResultsFile, 'utf8')
  //console.log("contents: " + contents);
  //lines = contents.split("\n");
  lines = contents.split(/\r\n|\r|\n/);

  log.info(`${lines.length - 1} lines found in ${wQXResultsFile}`, logList);

  const columnNames = {
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
  }, {});

  if (returnData.status === 'FAILURE') {
    return returnData;
  }

  let resultsCount = 0;
  let samplesCount = 0;
  for (let i = 1; i < lines.length; ++i) 
  {
      const line = lines[i];

      // tab delimited
      const pieces = line.split("\t");

      ++resultsCount;
      obj = Object.keys(columnIndices).reduce((acc, key) => {
        acc[key] = pieces[columnIndices[key]].trim();
        if (acc[key].startsWith('"') && acc[key].endsWith('"')) {
          acc[key] = acc[key].slice(1, -1);
        }
        return acc;
      }, {});

      // the Activity_ID coming from WQX includes the sampleID used by the HUI.  For example, it is
      // from WQX RCB160614:SR:WB:  
      // Hui ID is: RCB160614
      // note: the WQX Activity_ID can vary in number of parts separated by :
      let idParts = obj.Activity_ID.split(":");
      let sampleID = idParts[0];
      if (! samples[sampleID]) {
          //log.info(`Found new sampleID of ${sampleID}`, logList);
          ++samplesCount;
          samples[sampleID] = {};
          samples[sampleID]['Source'] = "wqx";
          samples[sampleID]['SampleID'] = sampleID;
          samples[sampleID]['Activity_ID'] = obj['Activity_ID'];  // this is really only needed for deleting activities
          samples[sampleID]['Monitoring_Location_ID'] = obj['Monitoring_Location_ID'];
          samples[sampleID]['Activity_Start_Date'] = obj['Activity_Start_Date'];
          samples[sampleID]['Detection_Condition'] = obj['Detection_Condition'];
      }
      // really only interested in the Characteristic and it's value.
      if (obj.Detection_Condition === "") {
          samples[sampleID][obj.Characteristic] = obj.Value;
      }
      else { //Some values might be under the detection limit and must be handled differently
          samples[sampleID][obj.Characteristic] = "<Below-Method-Detection-Limit";
      }
    };
    log.info(`Processed ${resultsCount} results from WQX resulting in ${samplesCount} samples`, logList);

  //console.log("return data " + util.inspect(returnData, false, null));
  return returnData;
};


var readWQXWebResultsFile = function(wQXResultsFile) {
  return parseWQXWebResultsFile(wQXResultsFile);

}


exports.readWQXWebResultsFile = readWQXWebResultsFile;
