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


  let resultsCount = 0;
  let samplesCount = 0;
  for (let i = 1; i < lines.length; ++i) 
  {
      const line = lines[i];
      //returnData.log.push({"line: " + line);

      // tab delimited
      const pieces = line.split("\t");

      //console.log("line " + i + " line length " + pieces.length);
      //for (let j = 0; j < pieces.length; ++j) { console.log(j + "\t" + pieces[j]); }

      if (pieces.length == 251) {
        ++resultsCount;
        //console.log("line: " + line);
        obj = {};

        obj['Organization_ID']          = pieces[0].trim();
        obj['Monitoring_Location_ID']   = pieces[28].trim();
        obj['Monitoring_Location_Name'] = pieces[29].trim();
        obj['Activity_ID']              = pieces[2].trim();
        obj['Activity_Start_Date']      = pieces[7].trim();
        obj['Activity_Type']            = pieces[4].trim();
        obj['Media']                    = pieces[5].trim();
        obj['Media_Subdivision']        = pieces[6].trim();
        obj['Result_UID']               = pieces[90].trim();
        obj['Characteristic']           = pieces[93].trim().replace(/"/g, "");  // if there is a comma in the field, there are "'s around the string
        obj['Fraction']                 = pieces[96].trim();
        obj['Statistic']                = pieces[110].trim();
        obj['Value']                    = pieces[97].trim();
        obj['Unit']                     = pieces[98].trim();
        obj['Value_Type']               = pieces[112].trim();
        obj['Detection_Condition']      = pieces[92].trim();
        obj['Biological_Intent']        = pieces[131].trim();
        obj['Taxon_Name']               = pieces[133].trim();
        obj['Status']                   = pieces[109].trim();
        obj['Last_Changed']             = pieces[248].trim();

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
      }
      else {
        log.error(`unexpected number of column: + ${pieces.length} Expecting 251 : ${line}`, logList);
        returnData.status = 'FAILURE';
        break;
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
