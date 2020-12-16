//************************************************************************************************
// This library reads tsv files saved from excel results files downloaded from the WQX web
// environment.  The Excel file is usually named ResultsExport.xlsx.  After doing a "save as"
// from Excel, change the suffix of the file from .txt to .tsv.  It can be left with DOS
// newlines or converted over to UNIX newlines.
//************************************************************************************************

var util  = require('util');
var fs    = require('fs');
var path  = require('path');

let log = require('./logFormatter');




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


  // The first line is a header.  The rest are tab-delimited lines of results
  // Organization ID Monitoring Location ID  Monitoring Location Name        Activity ID     Activity Start Date     Activity Type   Media   Media Subdivision       Result UID      Characteristic  Fraction        Statistic       Value   Unit    Value Type      Detection Condition     Biological Intent       Taxon Name      Status  Last Changed

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

      if (pieces.length == 20) {
        ++resultsCount;
        //console.log("line: " + line);
        obj = {};

        obj['Organization_ID']          = pieces[0].trim();
        obj['Monitoring_Location_ID']   = pieces[1].trim();
        obj['Monitoring_Location_Name'] = pieces[2].trim();
        obj['Activity_ID']              = pieces[3].trim();
        obj['Activity_Start_Date']      = pieces[4].trim();
        obj['Activity_Type']            = pieces[5].trim();
        obj['Media']                    = pieces[6].trim();
        obj['Media_Subdivision']        = pieces[7].trim();
        obj['Result_UID']               = pieces[8].trim();
        obj['Characteristic']           = pieces[9].trim().replace(/"/g, "");  // if there is a comma in the field, there are "'s around the string
        obj['Fraction']                 = pieces[10].trim();
        obj['Statistic']                = pieces[11].trim();
        obj['Value']                    = pieces[12].trim();
        obj['Unit']                     = pieces[13].trim();
        obj['Value_Type']               = pieces[14].trim();
        obj['Detection_Condition']      = pieces[15].trim();
        obj['Biological_Intent']        = pieces[16].trim();
        obj['Taxon_Name']               = pieces[17].trim();
        obj['Status']                   = pieces[18].trim();
        obj['Last_Changed']             = pieces[19].trim();

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
        log.error(`unexpected number of column: + ${pieces.length} Expecting 20 : ${line}`, logList);
        returnData.status = 'FAILURE';
        break;
      }
    };
    log.info(`Processed ${resultsCount} results from WQX resulting in ${samplesCount} samples`, logList);

  //console.log("sites " + util.inspect(sites, false, null));
  return returnData;
};


var readWQXWebResultsFile = function(wQXResultsFile) {
  return parseWQXWebResultsFile(wQXResultsFile);

}


exports.readWQXWebResultsFile = readWQXWebResultsFile;
