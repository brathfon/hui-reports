#!/usr/bin/env node
  

"use strict";

const util  = require('util');
const fs    = require('fs');
const path  = require('path');

//const readline = require('readline');   for checking to see if files already exit, but not using now



const scriptname = path.basename(process.argv[1]);

var argv = require('minimist')(process.argv.slice(2));
console.dir(`arguments passed in ${argv}`);
console.dir(`arguments passed in ${util.inspect(argv, false, null)}`);

const printUsage = function () {
  console.log(`Usage: ${scriptname} --odir <directory to write report files> --bname <basename for the files> --gsdir <Google sheets directory> --ndir <nutrient data directory [--inns]`);
  console.log(`optional:`);
  console.log(`  --inns     Ignore no nutrient data lines. They will not be included in the report.`);
}

if (argv.help || argv.h ) {
  printUsage();
  process.exit();
}

if (! (argv.o || argv.odir )) {
  console.log("ERROR: you must specify an output directory to write the report files");
  printUsage();
  process.exit();
}

if (! (argv.b || argv.bname )) {
  console.log("ERROR: you must specify a basename to write the report files");
  printUsage();
  process.exit();
}

if (! (argv.g || argv.gsdir )) {
  console.log("ERROR: you must specify a google spread sheet directory for reading the exported data");
  printUsage();
  process.exit();
}

if (! (argv.n || argv.ndir )) {
  console.log("ERROR: you must specify a directory to find nutrient data csv files");
  printUsage();
  process.exit();
}

// This is sort of the global data.  It will be passed from function to function to store temporary results
// It will also have the args in it.
var data = {};

if (argv.o)     data['directoryForFiles'] = argv.o;
if (argv.odir)  data['directoryForFiles'] = argv.odir;

if (argv.b)     data['basenameForFiles']  = argv.b;
if (argv.bname) data['basenameForFiles']  = argv.bname;

if (argv.g)     data['googleSheetsDirectory']  = argv.g;
if (argv.gsdir) data['googleSheetsDirectory']  = argv.gsdir;

// the site information comes from a downloaded sheet of the google drive spreadsheet where the insitu data is recorded
data['siteFile'] = data['googleSheetsDirectory'] + '/' + "Hui o ka Wai Ola Data Entry - Site Codes.tsv";

if (argv.n)     data['nutrientDirectory']  = argv.n;
if (argv.ndir)  data['nutrientDirectory']  = argv.ndir;

// initialize the ignoreNoNutrientSamples to false.  Default behavior will be to report samples without nutrient data
data['ignoreNoNutrientSamples']  = false;
// if the option is passed in, do not report samples without nutrient data
if (argv.i)     data['ignoreNoNutrientSamples']  = true;
if (argv.inns)  data['ignoreNoNutrientSamples']  = true;

data['samples'] = {};  // the key of samples is the sample ID. ex: RWA190716, which encode the site and the date
                       // the value is an object with the information about the sample


var rsgs   = require('../lib/readSiteGdriveSheet');
var rss   = require('../lib/readSpreadSheets');
var rnf   = require('../lib/readSoestFiles');


// this is mapping how the measurement or column names are stored in the structures as they are read
// and how they should be printed out in QA commments, etc.  Most are the same.
const reportMeasurementNames = {};

reportMeasurementNames['Temp']      = 'Temp';
reportMeasurementNames['Salinity']  = 'Salinity';
reportMeasurementNames['DO']        = 'DO';
reportMeasurementNames['DO%']       = 'DO_sat';  // only one that is different
reportMeasurementNames['pH']        = 'pH';
reportMeasurementNames['Turbidity'] = 'Turbidity';
reportMeasurementNames['TotalN']    = 'TotalN';
reportMeasurementNames['TotalP']    = 'TotalP';
reportMeasurementNames['Phosphate'] = 'Phosphate';
reportMeasurementNames['Silicate']  = 'Silicate';
reportMeasurementNames['NNN']       = 'NNN';
reportMeasurementNames['NH4']       = 'NH4';


var reportName = function (dataName) {
  return reportMeasurementNames[dataName];
};

// this is how many significate digits should be printed in the report
const reportPrecision = {};

reportPrecision['Temp']      = 1;
reportPrecision['Salinity']  = 1;
reportPrecision['DO']        = 2;
reportPrecision['DO%']       = 1;
reportPrecision['pH']        = 2;
reportPrecision['Turbidity'] = 2;

reportPrecision['TotalN']    = 2;
reportPrecision['TotalP']    = 2;
reportPrecision['Phosphate'] = 2;
reportPrecision['Silicate']  = 2;
reportPrecision['NNN']       = 2;
reportPrecision['NH4']       = 2;

reportPrecision['Lat']       = 6;
reportPrecision['Long']      = 6;

var getPrecisionForMeasurement = function (column) {
  return reportPrecision[column];
};


var getSiteData = function (data, callback) {

  console.log("In getSiteData");
  data['sites'] = rsgs.readSiteGdriveSheet(data.siteFile);

  //console.log("sites " + util.inspect(data.sites, false, null));

  if (callback) {
    callback();
  }

};


// return the latitude for this site. Set the precision of the value before returning
// It is a critical error if there is a site called out that does data, so exit the program

var getLatFor = function (siteCode, data) {
   if (data.sites[siteCode]) {
     return setPrecision('Lat', data.sites[siteCode].lat);
   }
   else {
     console.error(`site code ${siteCode} not found in site data.  Exiting script.`);
     process.exit(1);
   }
}


// do the same for longitude

var getLongFor = function (siteCode, data) {
   if (data.sites[siteCode]) {
     return setPrecision('Long', data.sites[siteCode].lon);
   }
   else {
     console.error(`site code ${siteCode} not found in site data.  Exiting script.`);
     process.exit(1);
   }
}


// return the long name for this site. example: Kaanapali Shores
// It is a critical error if there is a site called out that does data, so exit the program

var getSiteNameFor = function (siteCode, data) {
   if (data.sites[siteCode]) {
     return  data.sites[siteCode].long_name;
   }
   else {
     console.error(`site code ${siteCode} not found in site data.  Exiting script.`);
     process.exit(1);
   }
}


// Read the tab separated data from the Google Sheets for each team.


var readSpreadSheetData = function (data, callback) {

  console.log("In readSpreadSheetData");

  let sessions = rss.readTeamSheets(data.googleSheetsDirectory);

  //console.log("spread sheet samples " + util.inspect(sessions, false, null));

  //  the spread sheet reader returns an object whose attibutes (keys) are a combo of the lab code and the session number
  // and it's value is a list of samples for that session. These need to be flattened to just samples.
  // What is returned
  // { 'NMS:1':
  //    [ { Added_to_Main: 'yes',
  //        Ver_By_Dana: 'yes',
  //        Nut_Sample: 'yes', .....
  //

  for ( let labSessionCode in sessions ) {
    let i = 0;
    for (i = 0; i < sessions[labSessionCode].length; ++i) {
      // translate the keys from the spread sheet data into keys from the legacy web export file
      //data.samples.push(sessions[labSessionCode][i]);
      let obj = {};
      obj['NutSampled'] = sessions[labSessionCode][i].Nut_Sample;
      obj['SampleID']   = sessions[labSessionCode][i].SampleID;
      obj['SiteName']   = sessions[labSessionCode][i].SiteName;
      obj['Location']   = sessions[labSessionCode][i].Station;
      obj['Session']    = sessions[labSessionCode][i].Session;
      obj['Date']       = fixDateFormat(sessions[labSessionCode][i]['Date']); // put the date in the MM/DD/YY format
      obj['Time']       = fixTimeFormat(sessions[labSessionCode][i].Time);    // put the time in the HH:MM format
      obj['Temp']       = sessions[labSessionCode][i].Temp;
      obj['Salinity']   = sessions[labSessionCode][i].Salinity;
      obj['DO']         = sessions[labSessionCode][i].DO;
      obj['DO%']        = sessions[labSessionCode][i]['DO%'];;
      obj['pH']         = sessions[labSessionCode][i].pH;
      obj['Turb1']      = sessions[labSessionCode][i].Turb1;
      obj['Turb2']      = sessions[labSessionCode][i].Turb2;
      obj['Turb3']      = sessions[labSessionCode][i].Turb3;
      obj['Turbidity']  = calculateAvgTurbidity(sessions[labSessionCode][i]);
      obj['Lab']        = sessions[labSessionCode][i].Lab;
      // set the nutrient data to blanks.  It may or may not get updated later when the nutrient data results are received
      obj['TotalN']     = '';
      obj['TotalP']     = '';
      obj['Phosphate']  = '';
      obj['Silicate']   = '';
      obj['NNN']        = '';
      obj['NH4']        = '';
      //data.samples.push(obj);
      data.samples[obj.SampleID] = obj;
    }

    //console.log("spread sheet samples " + util.inspect(data.samples, false, null));
  }

  //console.log("data now  " + util.inspect(data.samples, false, null));
  if (callback) {
    callback();
  }

};



var readNutrientData = function (data, callback) {

  var westMaui = rnf.readSoestFiles(data.nutrientDirectory +  '/west-maui', data.sites);
  var southMaui = rnf.readSoestFiles(data.nutrientDirectory + '/south-maui', data.sites);

  console.log("-- Number of west Maui nutrient samples : " + Object.keys(westMaui).length);
  console.log("-- Number of south Maui nutrient samples : " + Object.keys(southMaui).length);

  let combined = Object.assign({}, westMaui, southMaui);

  console.log("-- Combined : " + Object.keys(combined).length);

  // the nutrient data comes back from the reader in an object where the keys are SITECODE-M/D/YY
  // 
  // nutrient  { 'RNS-6/5/18':
  //  { SampleID: 'RNS180605',
  //    Location: 'RNS',
  //    Date: '6/5/18',
  //    TotalN: '84.62',
  //    TotalP: '13.20',
  //    Phosphate: '8.60',
  //    Silicate: '483.89',
  //    NNN: '27.07',
  //    NH4: '3.64' },

  // Store them with keys of SITECODEYYMMDD like the SampleID so they can be looked up quickly
  // to update the samples with the nutrient data

  data.nutrientSamples = {};  // key will be SampleID, value will be object with location information
  for (let weirdCode in combined) {
    data.nutrientSamples[combined[weirdCode].SampleID] = combined[weirdCode];
  }

  //console.log("nutrient  " + util.inspect(data.nutrientSamples, false, null));

  if (callback) {
    callback();
  }

};



var updateSamplesWithNutrientData = function (data, callback) {

  // Check to make sure all nutrient sampleIDs have a matching insitu sample to join to if not, report a problem.

  for (let sampleID in data.nutrientSamples) {
    if (! data.samples[sampleID]) {
      console.log("-- WARNING: did not find matching insitu sample ID for nutrient sample ID: " + data.nutrientSamples[sampleID].SampleID + " site: " + data.nutrientSamples[sampleID].Location + " date: " + data.nutrientSamples[sampleID].Date);
      console.error("-- WARNING: did not find matching insitu sample ID for nutrient sample ID: " + data.nutrientSamples[sampleID].SampleID + " site: " + data.nutrientSamples[sampleID].Location + " date: " + data.nutrientSamples[sampleID].Date);
    }
  }

  console.log("In updateSamplesWithNutrientData");
  console.log("Number of samples:          " + Object.keys(data.samples).length);
  console.log("Number of nutrient samples: " + Object.keys(data.nutrientSamples).length);

  //for (let i = 0; i < data.samples.length; ++i) {
  for (let sampleID in data.samples) {
    if (data.nutrientSamples[sampleID]) {
      // will need a check here for "<" stuff maybe, or it could end up in the printing out part
      data.samples[sampleID].TotalN    = data.nutrientSamples[sampleID].TotalN;
      data.samples[sampleID].TotalP    = data.nutrientSamples[sampleID].TotalP;
      data.samples[sampleID].Phosphate = data.nutrientSamples[sampleID].Phosphate;
      data.samples[sampleID].Silicate  = data.nutrientSamples[sampleID].Silicate;
      data.samples[sampleID].NNN       = data.nutrientSamples[sampleID].NNN;
      data.samples[sampleID].NH4       = data.nutrientSamples[sampleID].NH4;
    }
  }

  if (callback) {
    callback();
  }
};


var isNutrientMeasurement = function (columnName) {
  return (( columnName === "TotalN") ||
          ( columnName === "TotalP") ||
          ( columnName === "Phosphate") ||
          ( columnName === "Silicate") ||
          ( columnName === "NNN") ||
          ( columnName === "NH4"));
};


var isEmptyNutrientData = function (sample) {

  if (sample.NutSampled.toLowerCase() === "no") return true;  // they will never have values

  return ((sample.TotalN === "") &&
          (sample.TotalP === "") &&
          (sample.Phosphate === "") &&
          (sample.Silicate === "") &&
          (sample.NNN === "") &&
          (sample.NH4 === ""));
};


var isInsituMeasurement = function (columnName) {
  return (( columnName === "Temp") ||
          ( columnName === "Salinity") ||
          ( columnName === "DO") ||
          ( columnName === "DO%") ||
          ( columnName === "pH") ||
          ( columnName === "Turbidity"));
};


var isEmptyInsituData = function (sample) {

  return ((sample.Temp === "") &&
          (sample.Salinity === "") &&
          (sample.DO === "") &&
          (sample['DO%'] === "") &&
          (sample.pH === "") &&
          (sample.Turbidity === ""));
};


var calculateAvgTurbidity = function (sample) {

  // if the turbidity has been QAed out, it might have #N/A as its value
  if ( (sample.Turb1 === "#N/A") &&
       (sample.Turb2 === "#N/A") &&
       (sample.Turb3 === "#N/A") ) {
    return "#N/A";
  }

  let numTurbs = 0;
  let total = 0.0;
  if (sample.Turb1 !== "" && sample.Turb1 !== "#N/A") {
    total += parseFloat(sample.Turb1);
    ++ numTurbs;
  }
  if (sample.Turb2 !== "" && sample.Turb2 !== "#N/A") {
    total += parseFloat(sample.Turb2);
    ++ numTurbs;
  }
  if (sample.Turb3 !== "" && sample.Turb3 !== "#N/A") {
    total += parseFloat(sample.Turb3);
    ++ numTurbs;
  }

  //console.log(`numTurbs = ${numTurbs} total = ${total} id = ${sample.SampleID}`);
  if (numTurbs !== 0) {
    return total / numTurbs;
  }
  else {
    return "";
  }

};


var formatSampleWithSigFigs = function(theSample, numSigFigs) {

  var newSample = "";
  if ((theSample !== null) && (theSample !== undefined) && theSample !== "") {
    //newSample = parseFloat(parseFloat(theSample).toFixed(numSigFigs));
    newSample = parseFloat(theSample).toFixed(numSigFigs);
  } else {
    newSample = "";
  }
  return newSample;
};

var setPrecision = function(attribute, value) {
  return formatSampleWithSigFigs(value, getPrecisionForMeasurement(attribute));
};


// This function checks to see if any values have been flagged by QA and are not included.
// If that is true, instead of a value it will have '#N/A' in place of it's value.
// There are 2 ways that QAed data is denoted:
//    1) Data from the legacy spread sheets is already '#N/A'
//    2) Data from the Google Drive spread sheets is blank.
//
// This function is also reponsible for setting the precision of the data, which it gets
// from lookup data near the top of the script

var checkForQAIssues = function(sample, column, issueDescriptions) {

  var returnValue = sample[column];
  var c;
  var issues = {};


  // There are two cases where the current value is just return without even looking at it to
  // see if it was QAed out.
  // 1) All the insitu data is blank, indicating that no data was taken
  // 2) All the nutrient data is blank, indicating
  //     a) Nutrient data was skipped for this site
  //     b) Nutrient data samples were shipped to the lab and the results are not in yet
  

  //console.log(`column ${column}`);

  // these measurements are probably just blank
  if (isNutrientMeasurement(column) && isEmptyNutrientData(sample)) {  // nothing to do, ok to be blank
    return returnValue;
  }
  if (isInsituMeasurement(column) && isEmptyInsituData(sample)) {  // nothing to do, ok to be blank
    return returnValue;
  }

  // There are two cases for measurements being QAed out.  The legacy data had "#N/A" as values
  // and the Google Drive spreadsheet has just blanks.
  if ((sample[column] === "") || (String(sample[column]).toUpperCase() === "#N/A")) {
      let msg = reportName(column) + " QA'ed out";
      // add this to the descriptions of qa issues
      issueDescriptions[msg] = true;  // this will eliminate dups as in the case of turbidity
      returnValue = "#N/A";
  }
  // if the string begins with <, as in <1.5, this indicates the measurement was below the limits
  // of the measuring equipment (usually found with nutrient data).
  else if (String(sample[column]).indexOf("<") === 0 ) {
      let msg = reportName(column) + " below detectable limit";
      // add this to the descriptions of qa issues
      issueDescriptions[msg] = true;  // this will eliminate dups as in the case of turbidity
      returnValue = setPrecision(column, String(sample[column]).substring(1));  // return the number without the "<" on the front
  }
  else {  // seems to be a normal number so set the precision
    returnValue = setPrecision(column, returnValue);
  }
  return returnValue;
};


var descriptionObjToString = function (obj) {

  var keys = Object.keys(obj);
  var i;
  var str = "";

  for (i = 0; i < keys.length; ++i) {
     str += keys[i];
   if (i !== (keys.length - 1)) {
     str +=  "; ";
   }
  }
  return str;
}




var fixDateFormat = function (aDate) {

  let returnValue = aDate;
  //console.log(`TEST trying ${aDate}`);
  let shortPattern = /[0-9]*\/[0-9]*\/[1-9][1-9]/; // example: 6/16/18
  let isoPattern   = /[1-9][0-9][0-9][0-9]\-[0-9][0-9]\-[0-9][0-9]/; // example: 2019-06-28

  //console.log(`TEST ${aDate.search(pattern)}`);

  if (aDate.search(shortPattern) === 0) {   // it matches
    //console.log(`TEST ${aDate} matches`);
    let month = "";
    let day   = "";
    let year  = "";
    [month, day, year] = aDate.split("/");
    //console.log(`TEST month ${month} day ${day}`);
    if (month < 10) {
      month = `0${month}`;
    }
    if (day < 10) {
      day = `0${day}`;
    }
    returnValue = `${month}/${day}/${year}`;
    //console.log(`TEST returning ${returnValue}`);
  }
  else if (aDate.search(isoPattern) === 0) {   // it matches
    //console.log(`TEST ${aDate} matches iso`);
    let month = "";
    let day   = "";
    let year  = "";
    [year, month, day] = aDate.split("-");
    year = year.substring(2);
    //console.log(`TEST month ${month} day ${day} year ${year}`);
    returnValue = `${month}/${day}/${year}`;

    //console.log(`TEST returning ${returnValue}`);
  }
  else {
    console.log(`ERROR: unrecognized date format of ${aDate}.  Exiting ....`);
    console.error(`ERROR: unrecognized date format of ${aDate}.  Exiting ....`);
    process.exit();
  }

  return returnValue;
};


var fixTimeFormat = function (aTime) {

  let returnValue = aTime;

  // some samples do not have a time associated with them if for some reason the sample was not taken
  if (aTime === "null") {
    return returnValue;
  }
  //console.log(`TEST trying ${aTime}`);
  let needsFixedPattern = /[1-9]:[0-9][0-9]/; // example: 9:56
  let okPattern = /[0-2][0-9]:[0-9][0-9]/; // example: 9:56

  //console.log(`TEST ${aTime.search(pattern)}`);
  if (aTime.search(okPattern) === 0) {   // it matches and OK
    returnValue = aTime;
  }
  else if (aTime.search(needsFixedPattern) === 0) {   // it matches
    //console.log(`TEST ${aTime} matches`);
    let hours = "";
    let minutes   = "";
    [hours, minutes] = aTime.split(":");
    //console.log(`TEST hours ${hours} minutes ${minutes}`);
    if (hours < 10) {
      hours = `0${hours}`;
    }
    returnValue = `${hours}:${minutes}`;
    //console.log(`TEST returning ${returnValue}`);
  }
  else {
    console.error(`ERROR: unrecognized time format of ${aTime}.  Exiting ....`);
    console.log(`ERROR: unrecognized time format of ${aTime}.  Exiting ....`);
    process.exit();
  }
  return returnValue;
}


// This function adds a comment to the msgObj that reports when the nutrient data is empty.
// It reports that there is data pending (not back from the lab) if the nutrient data is empty
// but samples were taken according to the database. If the database says not samples were
// taken, then it reports that.

var addMissingNutrientDataMsg = function(sample, msgObj) {

  if (isEmptyNutrientData(sample)) {
    if (sample["NutSampled"] === "yes") {
      //console.log("nutrient empty YES, samples taken YES");
      msgObj["nutrient data pending"] = true;
    }
    else if (sample["NutSampled"] === "no") {
      //console.log("nutrient empty YES, samples taken NO");
      msgObj["nutrient samples not taken"] = true;
    }
    else {
      console.error(`ERROR: unexpected value for nutrient_sample_taken of ${sample["nutrient_sample_taken"]} .  exiting .....`);
      process.exit(1);
    }
  }
}



var createReportFromList = function (samples, ignoreNoNutrientSamples) {

  console.log("In createReport From List");

  //console.log("samples " + util.inspect(samples , false, null));

  let header = "\t";
  header += "SampleID" + "\t";
  header += "SiteName" + "\t";
  header += "Station" + "\t";
  header += "Session" + "\t";
  header += "Date" + "\t";
  header += "Time" + "\t";
  header += "Temp" + "\t";
  header += "Salinity" + "\t";
  header += "DO" + "\t";
  header += "DO_sat" + "\t";
  header += "pH" + "\t";
  header += "Turbidity" + "\t";
  header += "TotalN" + "\t";
  header += "TotalP" + "\t";
  header += "Phosphate" + "\t";
  header += "Silicate" + "\t";
  header += "NNN" + "\t";
  header += "NH4" + "\t";
  header += "Lat" + "\t";
  header += "Long" + "\t";
  header += "QA issues or comments" + "\n";

  let report = header;

  let count = 0;
  for (let i = 0; i < samples.length; ++i) {

    // will not be reporting on any empty samples
    if ( ! isEmptyInsituData(samples[i])) {

      // check special case of ignoring empty nutrient data and it is empty.  If so skip this line
      if (  ( ignoreNoNutrientSamples ) && ( isEmptyNutrientData(samples[i]) ) ) {
        continue;
      }

      ++count;

      let issueDescriptions = {};
      let row = `${count}\t`;
      row += samples[i].SampleID + "\t";
      row += getSiteNameFor(samples[i].Location, data) + "\t";
      row += samples[i].Location + "\t";
      row += samples[i].Session + "\t";
      row += samples[i].Date + "\t";
      row += samples[i].Time + "\t";
      row += checkForQAIssues(samples[i], "Temp",             issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "Salinity",         issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "DO",               issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "DO%",              issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "pH",               issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "Turbidity",        issueDescriptions) + "\t";  // this is the average turbidity
      row += checkForQAIssues(samples[i], "TotalN",           issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "TotalP",           issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "Phosphate",        issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "Silicate",         issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "NNN",              issueDescriptions) + "\t";
      row += checkForQAIssues(samples[i], "NH4",              issueDescriptions) + "\t";
      row += getLatFor(samples[i].Location, data) + "\t";
      row += getLongFor(samples[i].Location, data) + "\t";

      addMissingNutrientDataMsg(samples[i], issueDescriptions);

      row += descriptionObjToString(issueDescriptions);

      // finish the row
      row += "\n";
      report += row;
    }

  }

  return report;

}

/*  Returns a file path with basename to create the files for each geo area */

var getFilePathForGeoArea = function (data, GeoArea) {
  return path.join(data.directoryForFiles, data.basenameForFiles + `.${GeoArea}-maui.tsv`);
};

/* get the full file path for the file that has data for all the areas */
var getFilePathForAllAreas = function (data) {
  return path.join(data.directoryForFiles, data.basenameForFiles + ".all-areas.tsv");
};


var fileExists = function (data, GeoArea) {

  let filePath = getFilePath(data, GeoArea);
  return fs.existsSync(filePath);
};


var writeFile = function (filePath, dataToWrite) {

  console.log(`Writing file to ${filePath}`);

  fs.writeFileSync(filePath, dataToWrite, function(err) {
    if(err) {
        console.error(`ERROR writing ${filePath}`);
        console.log(`ERROR writing ${filePath}`);
        console.error(err);
        return console.log(err);
    }
    console.log("The file was saved to " + filePath);
  }); 
};


var createReports = function (data, callback) {

  console.log("In createReports");

  let baseDir = "/tmp";

  console.log("Creating report for all samples");

  let filePath = getFilePathForAllAreas(data);
  writeFile(filePath, createReportFromList(data.sortedSamples, data.ignoreNoNutrientSamples));

  for (let geoArea in data.samplesByGeoArea) {
     console.log("Creating report for area " + geoArea);
     filePath = getFilePathForGeoArea(data, geoArea);
     writeFile(filePath, createReportFromList(data.samplesByGeoArea[geoArea], data.ignoreNoNutrientSamples));
     //if (fs.existsSync(filePath))
  }

  if (callback) {
    callback();
  }

};

var printLookupData = function (data, callback) {

  console.log("In printLookupData");
  console.log("Number of sites: " + Object.keys(data.sites).length);
  console.log("sites loop:");

  for (let siteCode in data.sites) {
    console.log(`siteCode : ${siteCode}`);
    console.log(util.inspect(data.sites[siteCode], false, null));
  }

  
  console.log("");
  console.log("Report Measurement Names:");
  console.log(util.inspect(reportMeasurementNames, false, null));

  console.log("");
  console.log("Report Precision:");
  console.log(util.inspect(reportPrecision, false, null));

  if (callback) {
    callback();
  }
};


var printSamples = function (data, callback) {

/* LEAVE THIS FUNCTION IN PLACE AND COMMENT THIS BACK IN IF YOU WANT TO PRINT OUT SAMPLES
  console.log("In printSamples");
  console.log("Number of samples: " + Object.keys(data.samples).length);

  console.log("sample loop:");
  for (let i = 0; i < data.sortedSamples.length; ++i) {
    console.log(`sorted sample ${i + 1}: \n`  + util.inspect(data.sortedSamples[i], false, null));
  }

*/
  if (callback) {
    callback();
  }
};


var sortAscendingByDateAndTime = function(a,b) {

  //console.log(`comparing ${a.Date} ${a.Time} to ${b.Date} ${b.Time}`);

  // first compare days

  let aYear  = "";
  let aMonth = "";
  let aDay   = "";
  [aMonth, aDay, aYear] = a.Date.split('/');


  let bYear  = "";
  let bMonth = "";
  let bDay   = "";
  [bMonth, bDay, bYear] = b.Date.split('/');

   if (aYear < bYear)
     return -1;
   if (aYear > bYear)
     return 1;

   if (aMonth < bMonth)
     return -1;
   if (aMonth > bMonth)
     return 1;

   if (aDay < bDay)
     return -1;
   if (aDay > bDay)
     return 1;

   // next compare time
   // there are some samples without any times.  If either of the times is null, return it is though it is later
   if ((a.Time === "null") || (b.Time === "null")) {
     return 1;
   }

  let aHour   = "";
  let aMinute = "";
  [aHour, aMinute]      = a.Time.split(':');

  let bHour   = "";
  let bMinute = "";
  [bHour, bMinute]      = b.Time.split(':');


   if (aHour < bHour)
     return -1;
   if (aHour > bHour)
     return 1;

   if (aMinute < bMinute)
     return -1;
   if (aMinute > bMinute)
     return 1;

   return 0;
};


var sortSamples = function(data, callback) {

  // get all the samples in one list to be sorted
  let sampleList = [];

  for (let sampleID in data.samples) {
    sampleList.push(data.samples[sampleID]);
  }
  data.sortedSamples = sampleList.sort(sortAscendingByDateAndTime);

  if (callback) {
    callback();
  }
};


var filterSamplesByGeoArea = function(data, callback) {

  // get all the samples in one list to be sorted
  data.samplesByGeoArea = {};

  for (let i = 0; i < data.sortedSamples.length; ++i) {

    // some convience variables
    const sample = data.sortedSamples[i];

    const labCode = sample.Lab;


    // HACK WARNING WARNING
    // Because there were lab problem during COVID, we had to move labs.
    // Team leads wanted to use other lab codes.
    // Changed to calling the labs geo areas

    let areaLookup = {
       LLHS: 'west',
       TMO:  'west',
       NMS:  'south',
       DHS:  'south'
    };

    let area = areaLookup[labCode];
    if (! area) {
      console.error(`ERROR: could not find area lookup for lab ${labCode} .... exiting`);
      console.log(`ERROR: could not find area lookup for lab ${labCode} .... exiting`);
      process.exit(1);
    }

    if ( ! data.samplesByGeoArea[area] ) {
      data.samplesByGeoArea[area] = [];  // haven't seen this lab yet, so make an empty list
    }
    data.samplesByGeoArea[area].push(sample);
  }

  if (callback) {
    callback();
  }
};


// this is the main

getSiteData(data, function () {
    readSpreadSheetData(data, function () {
      readNutrientData(data, function () {
        updateSamplesWithNutrientData(data, function () {
          printLookupData(data, function () {
            sortSamples(data, function () {
              filterSamplesByGeoArea(data, function () {
                //checkForExistingFiles(data, function () {
                  printSamples(data, function () {   // for troubleshooting, need to comment things back in in the function to use it
                    createReports(data, null);
                  });
                //});
              });
            });
          });
        });
      });
    });
});

