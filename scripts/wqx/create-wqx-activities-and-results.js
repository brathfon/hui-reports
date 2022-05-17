#!/usr/bin/env node
  

"use strict";

const util  = require('util');
const fs    = require('fs');
const path  = require('path');
const argv  = require('minimist')(process.argv.slice(2));


var rsgs  = require('../../lib/readSiteGdriveSheet');
var rss   = require('../../lib/readSpreadSheets');
var rnf   = require('../../lib/readSoestFiles');
var rrf   = require('../../lib/readWQXWebResultsFile');
let log   = require('../../lib/logFormatter');

const scriptname = path.basename(process.argv[1]);

console.dir(`arguments passed in ${argv}`);
console.dir(`arguments passed in ${util.inspect(argv, false, null)}`);

const printUsage = function () {
  console.log(`Usage: ${scriptname} --odir <directory to write files> --bname <basename for the files> --gsdir <Google sheets directory> --ndir <nutrient data directory [--wqx <wqx results file>] [--inns] [--sid sampleID]`);
  console.log(`optional:`);
  console.log(`  --inns                    Ignore no nutrient data lines. They will not be included in the data.`);
  console.log(`  --sid                     Get the data for a certain sampleID.  Mainly for testing or correcting a mistake.`);
  console.log(`  --wqx <wqx results file>  Downloaded tab separated file of results from wqx to compare to google sheets data and create insert, update and delete files`);
}

if (argv.help || argv.h ) {
  printUsage();
  process.exit();
}

if (! (argv.o || argv.odir )) {
  console.log("ERROR: you must specify an output directory to write the tsv data files");
  printUsage();
  process.exit();
}

if (! (argv.b || argv.bname )) {
  console.log("ERROR: you must specify a basename to write the tsv data files");
  printUsage();
  process.exit();
}

if (! (argv.g || argv.gsdir )) {
  console.log("ERROR: you must specify a google spread sheet directory for reading the exported data");
  printUsage();
  process.exit();
}

if (! (argv.n || argv.ndir )) {
  console.log("ERROR: you must specify a directory to find nutrient data tsv files");
  printUsage();
  process.exit();
}

// This is sort of the global data.  It will be passed from function to function to store temporary results
// It will also have the args in it.
const data = {};
data.status = "SUCCESS";
data.log    = [];        // log messages will be appended here

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

// initialize the ignoreNoNutrientSamples to false.  Default behavior will be to include samples without nutrient data
data['ignoreNoNutrientSamples']  = false;
// if the option is passed in, do not include samples without nutrient data
if (argv.i)     data['ignoreNoNutrientSamples']  = true;
if (argv.inns)  data['ignoreNoNutrientSamples']  = true;

// initialize the requested sampleID to blank "";
data['requestedSampleID']  = "";
if (argv.s)     data['requestedSampleID']  = argv.s;
if (argv.sid)   data['requestedSampleID']  = argv.sid;

data['wqxFile']  = "";
//  was a wqx file specified so to compare to find new or modified or removed data?
if (argv.w)     data['wqxFile']  = argv.w;
if (argv.wqx)   data['wqxFile']  = argv.wqx;

// some of the optional args can be conflicting.  requestedSampleID and wqxFile don't make sense together
// requestedSampleID is more of a testing option.  wqxFile is probably the usual way it will be used.

console.log("data " + util.inspect(data, false, null));

data['samples'] = {};  // the key of samples is the sample ID. ex: RWA190716, which encode the site and the date
                       // the value is an object with the information about the sample

// this is mapping how the measurement or column names are stored in the structures as they are read
// and how they should be printed out in QA commments, etc.  Most are the same.
const fileContentMeasurementNames = {};

fileContentMeasurementNames['Temp']      = 'Temp';
fileContentMeasurementNames['Salinity']  = 'Salinity';
fileContentMeasurementNames['DO']        = 'DO';
fileContentMeasurementNames['DO%']       = 'DO_sat';  // only one that is different
fileContentMeasurementNames['pH']        = 'pH';
fileContentMeasurementNames['Turbidity'] = 'Turbidity';
fileContentMeasurementNames['TotalN']    = 'TotalN';
fileContentMeasurementNames['TotalP']    = 'TotalP';
fileContentMeasurementNames['Phosphate'] = 'Phosphate';
fileContentMeasurementNames['Silicate']  = 'Silicate';
fileContentMeasurementNames['NNN']       = 'NNN';
fileContentMeasurementNames['NH4']       = 'NH4';


var fileContentName = function (dataName) {
  return fileContentMeasurementNames[dataName];
};

// this is how many significate digits should be printed in the file content
const fileContentPrecision = {};

fileContentPrecision['Temp']      = 1;
fileContentPrecision['Salinity']  = 1;
fileContentPrecision['DO']        = 2;
fileContentPrecision['DO%']       = 1;
fileContentPrecision['pH']        = 2;
fileContentPrecision['Turbidity'] = 2;

fileContentPrecision['TotalN']    = 2;
fileContentPrecision['TotalP']    = 2;
fileContentPrecision['Phosphate'] = 2;
fileContentPrecision['Silicate']  = 2;
fileContentPrecision['NNN']       = 2;
fileContentPrecision['NH4']       = 2;

fileContentPrecision['Lat']       = 6;
fileContentPrecision['Long']      = 6;

var getPrecisionForMeasurement = function (column) {
  return fileContentPrecision[column];
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


var printLog = function (logList) {
 
  for (let i = 0; i < logList.length; ++i) {
    if (logList[i].level == "ERROR") {
      console.error(`ERROR ${logList[i].msg}`);
    }
    else {
      console.log(`${logList[i].msg}`);
    }
  }
};

// Read the tab separated data from the Google Sheets for each team.


var readGoogleSheetsData = function (data, callback) {

  console.log("In readGoogleSheetsData");

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

  data.gsSamplesKV = {};  // google sheets samples key value: key is sampleID, value is a sample object

  for ( let labSessionCode in sessions ) {
    let i = 0;
    for (i = 0; i < sessions[labSessionCode].length; ++i) {
      // translate the keys from the spread sheet data into keys from the legacy web export file
      //data.samples.push(sessions[labSessionCode][i]);
      let obj = {};
      obj['Source']     = "google sheets";
      obj['NutSampled'] = sessions[labSessionCode][i].Nut_Sample;
      obj['SampleID']   = sessions[labSessionCode][i].SampleID;
      obj['SiteName']   = sessions[labSessionCode][i].SiteName;
      obj['Location']   = sessions[labSessionCode][i].Station;
      obj['Session']    = sessions[labSessionCode][i].Session;
      obj['Date']       = fixDateFormat(sessions[labSessionCode][i]['Date']); // put the date in the MM/DD/YY format
      obj['Time']       = fixTimeFormat(sessions[labSessionCode][i].Time);    // put the time in the HH:MM format
      obj['Temp']       = setPrecision('Temp', sessions[labSessionCode][i].Temp);
      obj['Salinity']   = setPrecision('Salinity', sessions[labSessionCode][i].Salinity);
      obj['DO']         = setPrecision('DO', sessions[labSessionCode][i].DO);
      obj['DO%']        = setPrecision('DO%', sessions[labSessionCode][i]['DO%']);
      obj['pH']         = setPrecision('pH', sessions[labSessionCode][i].pH);
      obj['Turb1']      = sessions[labSessionCode][i].Turb1;
      obj['Turb2']      = sessions[labSessionCode][i].Turb2;
      obj['Turb3']      = sessions[labSessionCode][i].Turb3;
      obj['Turbidity']  = setPrecision('Turbidity', calculateAvgTurbidity(sessions[labSessionCode][i]));
      obj['Lab']        = sessions[labSessionCode][i].Lab;
      // set the nutrient data to blanks.  It may or may not get updated later when the nutrient data results are received
      obj['TotalN']     = '';
      obj['TotalP']     = '';
      obj['Phosphate']  = '';
      obj['Silicate']   = '';
      obj['NNN']        = '';
      obj['NH4']        = '';
      //data.samples.push(obj);
      data.gsSamplesKV[obj.SampleID] = obj;
    }

    //console.log("spread sheet samples " + util.inspect(data.gsSamplesKV, false, null));
  }

  //console.log("data now  " + util.inspect(data.gsSamplesKV, false, null));
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


var readWQXData = function (data, callback) {

  // set this to null.  There may be cases where no WQX file was supplied or 
  // there was a problem reading the data.

  data['wqxSamplesKV'] = null;

  if (data.wqxFile) {
    console.log(`WQX file ${data.wqxFile} being read`);
    let returnedObj = rrf.readWQXWebResultsFile(data.wqxFile);  // key is sampleID, value is sample object
    if (returnedObj.status == "SUCCESS")
    {
      data['wqxSamplesKV'] = returnedObj.samples;
      data.log = data.log.concat(returnedObj.log);
      //console.dir(data.wqxSamplesKV);
      printLog(data.log);  // print out the log data returned from this reader
    }
    else {
      console.error("There was a problem reading the WQX file");
      data.status = "FAILURE";
    }
  }
  else {
    console.log(`no WQX file requested`);
  }

  if (callback) {
    callback();
  }

};

var updateSamplesWithNutrientData = function (data, callback) {

  // Check to make sure all nutrient sampleIDs have a matching insitu sample to join to if not, report a problem.

  for (let sampleID in data.nutrientSamples) {
    if (! data.gsSamplesKV[sampleID]) {
      console.log("-- WARNING: did not find matching insitu sample ID for nutrient sample ID: " + data.nutrientSamples[sampleID].SampleID + " site: " + data.nutrientSamples[sampleID].Location + " date: " + data.nutrientSamples[sampleID].Date);
      console.error("-- WARNING: did not find matching insitu sample ID for nutrient sample ID: " + data.nutrientSamples[sampleID].SampleID + " site: " + data.nutrientSamples[sampleID].Location + " date: " + data.nutrientSamples[sampleID].Date);
    }
  }

  console.log("In updateSamplesWithNutrientData");
  console.log("Number of samples:          " + Object.keys(data.gsSamplesKV).length);
  console.log("Number of nutrient samples: " + Object.keys(data.nutrientSamples).length);

  //for (let i = 0; i < data.gsSamplesKV.length; ++i) {
  for (let sampleID in data.gsSamplesKV) {
    if (data.nutrientSamples[sampleID]) {
      // will need a check here for "<" stuff maybe, or it could end up in the printing out part
      data.gsSamplesKV[sampleID].TotalN    = setPrecision('TotalN', data.nutrientSamples[sampleID].TotalN);
      data.gsSamplesKV[sampleID].TotalP    = setPrecision('TotalP', data.nutrientSamples[sampleID].TotalP);
      data.gsSamplesKV[sampleID].Phosphate = setPrecision('Phosphate', data.nutrientSamples[sampleID].Phosphate);
      data.gsSamplesKV[sampleID].Silicate  = setPrecision('Silicate', data.nutrientSamples[sampleID].Silicate);
      data.gsSamplesKV[sampleID].NNN       = setPrecision('NNN', data.nutrientSamples[sampleID].NNN);
      data.gsSamplesKV[sampleID].NH4       = setPrecision('NH4', data.nutrientSamples[sampleID].NH4);
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
  let returnValue = value;

  // need to check for two situations where we will not mess with the sig figs
  // one if it is blank or QAed out and also if it starts with a < to indicate it as below detectable levels
  if (notQAedOutOrBlank(value) && !(String(value).indexOf("<") === 0)) {
    returnValue =  formatSampleWithSigFigs(value, getPrecisionForMeasurement(attribute));
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
    returnValue = `${month}/${day}/20${year}`;

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


/* ************************************************************************
A value can be left blank to signal several things: it was not collected
for one reason or another, the values can be pending from the lab, or
if they are QA'ed out.  There is some legacy data out there that also
has #N/A to show that the value has been Q/Aed out.
************************************************************************ */
var notQAedOutOrBlank = function (value) {
  return ( value !== "#N/A" && value !== "#n/a" && value.toString().trim() !== "");
}


// sort of a global (sorry about that) that is used to store some lookup information about each kind of result being reported
const resultAttributes = {};

var initResultAttributes = function(data, callback) {

  // some values that get reused
  const FIELD_MSR_OBS  = "Field Msr/Obs";
  const SAMPLE_ROUTINE = "Sample-Routine";
  const SAMPLE_COLLECTION_METHOD_ID = 1002;  // just one right now
  const WATER_BOTTLE = "Water Bottle";       // blank for insitu (may change), water bottle for nutrient
  const BUCKET = "Bucket";       // blank for insitu (may change), water bottle for nutrient
  const PROBE_SENSOR = "Probe/Sensor";       // An instrument used to assess ambient water or air quality directly.
  // Results Analytical Method ID context
  const APHA = "APHA";
  const HACH = "HACH";
  const USEPA = "USEPA";
  const HUIWAIOLA_WQX = "HUIWAIOLA_WQX";
  const INSITU = "INSITU";  // may not use these
  const NUTRIENT = "NUTR";  // may not use these
  const TURBIDITY = "TURB";  // may not use these
  //const DISSOLVED = "Dissolved"; // no value for insitu data, "Dissolved" on nutrient samples
  const FILTERED_FIELD = "Filtered, field";
  const TURBIDITY_ACTIVITY_ID_SUFFIX = "FM:WB:";
  const INSITU_ACTIVITY_ID_SUFFIX = "FM:PS:";
  const NUTRIENT_ACTIVITY_ID_SUFFIX = "SR:WB:";


  // these objects will be used to grab specific information about each type
  resultAttributes['Temp'] = {
    characteristicName: "Temperature, water",
    methodSpeciation: "",
    resultUnit : "deg C",
    activityType : FIELD_MSR_OBS,
    activityIDsuffix : INSITU_ACTIVITY_ID_SUFFIX + "TS:",
    resultSampleFraction : "",
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : PROBE_SENSOR,
    sampleCollectionEquipmentComment : "HACH CDC401",
    resultAnalyticalMethodID : 2550,
    resultAnalyticalMethodIDContext : APHA
  };

  resultAttributes['DO'] = {
    characteristicName: "Dissolved oxygen (DO)",
    methodSpeciation: "",
    resultUnit : "mg/l",
    activityType : FIELD_MSR_OBS,
    activityIDsuffix : INSITU_ACTIVITY_ID_SUFFIX + "DO:",
    resultSampleFraction : "",
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : PROBE_SENSOR,
    sampleCollectionEquipmentComment : "HACH LDO101",
    resultAnalyticalMethodID : 8157,
    resultAnalyticalMethodIDContext : HACH
  };

  resultAttributes['DO%'] = {
    characteristicName: "Dissolved oxygen saturation",
    methodSpeciation: "",
    resultUnit : "%",
    activityType : FIELD_MSR_OBS,
    activityIDsuffix : INSITU_ACTIVITY_ID_SUFFIX + "DO:",
    resultSampleFraction : "",
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : PROBE_SENSOR,
    sampleCollectionEquipmentComment : "HACH LDO101",
    resultAnalyticalMethodID : 8157,
    resultAnalyticalMethodIDContext : HACH
  };

  resultAttributes['Turbidity'] = {
    characteristicName: "Turbidity",
    methodSpeciation: "",
    resultUnit : "NTU",
    activityType : FIELD_MSR_OBS,
    activityIDsuffix : TURBIDITY_ACTIVITY_ID_SUFFIX,
    resultSampleFraction : "",
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : WATER_BOTTLE,
    sampleCollectionEquipmentComment : "HACH 2100Q",
    resultAnalyticalMethodID : 180.1,
    resultAnalyticalMethodIDContext : USEPA
  };

  resultAttributes['pH'] = {
    characteristicName: "pH",
    methodSpeciation: "",
    resultUnit : "None",
    activityType : FIELD_MSR_OBS,
    activityIDsuffix : INSITU_ACTIVITY_ID_SUFFIX + "PH:",
    resultSampleFraction : "",
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : PROBE_SENSOR,
    sampleCollectionEquipmentComment : "HACH PHC101",
    resultAnalyticalMethodID : 8156,
    resultAnalyticalMethodIDContext : HACH
  };

  resultAttributes['Salinity'] = {
    characteristicName: "Salinity",
    methodSpeciation: "",
    resultUnit : "ppt",
    activityType : FIELD_MSR_OBS,
    activityIDsuffix : INSITU_ACTIVITY_ID_SUFFIX + "TS:",
    resultSampleFraction : "",
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : PROBE_SENSOR,
    sampleCollectionEquipmentComment : "HACH CDC401",
    resultAnalyticalMethodID : "8160",
    resultAnalyticalMethodIDContext : HACH
  };

  resultAttributes['TotalN'] = {
    characteristicName: "Total Nitrogen, mixed forms",
    methodSpeciation: "as N",
    resultUnit : "ug/l",
    activityType : SAMPLE_ROUTINE,
    activityIDsuffix : NUTRIENT_ACTIVITY_ID_SUFFIX,
    resultSampleFraction : FILTERED_FIELD,
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : WATER_BOTTLE,
    sampleCollectionEquipmentComment : "",
    resultAnalyticalMethodID : "4500-N",
    resultAnalyticalMethodIDContext : APHA
  };

  resultAttributes['TotalP'] = {
    characteristicName: "Total Phosphorus, mixed forms",
    methodSpeciation: "as P",
    resultUnit : "ug/l",
    activityType : SAMPLE_ROUTINE,
    activityIDsuffix : NUTRIENT_ACTIVITY_ID_SUFFIX,
    resultSampleFraction : FILTERED_FIELD,
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : WATER_BOTTLE,
    sampleCollectionEquipmentComment : "",
    resultAnalyticalMethodID : "4500-P",
    resultAnalyticalMethodIDContext : APHA
  };

  resultAttributes['Phosphate'] = {
    characteristicName: "Orthophosphate",
    methodSpeciation: "as P",
    resultUnit : "ug/l",
    activityType : SAMPLE_ROUTINE,
    activityIDsuffix : NUTRIENT_ACTIVITY_ID_SUFFIX,
    resultSampleFraction : FILTERED_FIELD,
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : WATER_BOTTLE,
    sampleCollectionEquipmentComment : "",
    resultAnalyticalMethodID : "365.5",
    resultAnalyticalMethodIDContext : USEPA
  };

  resultAttributes['Silicate'] = {
    characteristicName: "Silicate",
    methodSpeciation: "",
    resultUnit : "ug/l",
    activityType : SAMPLE_ROUTINE,
    activityIDsuffix : NUTRIENT_ACTIVITY_ID_SUFFIX,
    resultSampleFraction : FILTERED_FIELD,
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : WATER_BOTTLE,
    sampleCollectionEquipmentComment : "",
    resultAnalyticalMethodID : "366.0",
    resultAnalyticalMethodIDContext : USEPA
  };

  resultAttributes['NNN'] = {
    characteristicName: "Nitrate + Nitrite",
    methodSpeciation: "as N",
    resultUnit : "ug/l",
    activityType : SAMPLE_ROUTINE,
    activityIDsuffix : NUTRIENT_ACTIVITY_ID_SUFFIX,
    resultSampleFraction : FILTERED_FIELD,
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : WATER_BOTTLE,
    sampleCollectionEquipmentComment : "",
    resultAnalyticalMethodID : "353.4",
    resultAnalyticalMethodIDContext : USEPA
  };

  resultAttributes['NH4'] = {
    characteristicName: "Ammonium",
    methodSpeciation: "as N",
    resultUnit : "ug/l",
    activityType : SAMPLE_ROUTINE,
    activityIDsuffix : NUTRIENT_ACTIVITY_ID_SUFFIX,
    resultSampleFraction : FILTERED_FIELD,
    sampleCollectionMethodID : SAMPLE_COLLECTION_METHOD_ID,
    sampleCollectionEquipmentName : WATER_BOTTLE,
    sampleCollectionEquipmentComment : "",
    // method used after session 19 west maui to get lower minimum detection limit
    resultAnalyticalMethodID : "Ammonium-OPA",
    resultAnalyticalMethodIDContext : HUIWAIOLA_WQX
    //older method from sessions 1-19 west maui which will become current method if we go to Maui lab
    //resultAnalyticalMethodID : "350.1",
    //resultAnalyticalMethodIDContext : USEPA
  };

  if (callback) {
    callback();
  }
};


var createLineForAttribute = function (huiResultName, huiSample) {
  
  const theLine = []; 

  const attr = resultAttributes[huiResultName];

  // Before creating the line, we need to check to see if the result may have been below the level of detection
  // by the measuring equipment, currently nutrient data.
  // if the string begins with <, as in <1.5, this indicates the measurement was below the limits
  // of the measuring equipment (usually found with nutrient data).

  let resultMeasureValue = huiSample[huiResultName];   // the value of the measurement we are writing out
  let resultUnit = attr.resultUnit;

  // these come into play if the lab procedure finds the value under a certain limit
  let resultDetectionCondition = "";
  let resultDetectionLimitType = "";
  let resultDetectionLimitValue = "";
  let resultDetectionLimitUnit = "";

  // if a value coming from SOEST begins with a "<", the amount detected is below a particular detection limit 
  if (String(huiSample[huiResultName]).indexOf("<") === 0 ) {
    resultDetectionCondition = "Below Method Detection Limit";
    resultDetectionLimitType = "Method Detection Level";
    resultDetectionLimitValue = resultMeasureValue.replace(/</, ""); // remove the below detection limit "<"
    resultDetectionLimitUnit = attr.resultUnit;
    resultMeasureValue = "";    // do not fill out the resultMeasureValue or resultUnit column
    resultUnit = "";
  }

  theLine.push(huiSample.Location);
  theLine.push(huiSample.SampleID + ":" + attr.activityIDsuffix);  // this is the activity id for storet
  theLine.push(attr.activityType);
  theLine.push(huiSample.Date);
  theLine.push(huiSample.Time);
  theLine.push('HUI_PCHEM');
  theLine.push('EPABEACH');
  theLine.push(attr.sampleCollectionMethodID);
  //theLine.push("TBD sampleCollectionMethodContext");  // try without first
  theLine.push(attr.sampleCollectionEquipmentName);
  theLine.push(attr.sampleCollectionEquipmentComment);
  theLine.push(attr.characteristicName);
  theLine.push(attr.methodSpeciation);
  theLine.push(resultDetectionCondition);
  theLine.push(resultMeasureValue);
  theLine.push(resultUnit);
  theLine.push(attr.resultSampleFraction);
  theLine.push(attr.resultAnalyticalMethodID);
  theLine.push(attr.resultAnalyticalMethodIDContext);
  theLine.push(resultDetectionLimitType);
  theLine.push(resultDetectionLimitValue);
  theLine.push(resultDetectionLimitUnit);

  return (theLine.join("\t") + "\n");

};


var createFileContentFromList = function (samples, ignoreNoNutrientSamples) {

  console.log("In createFileContent From List");

  //console.log("samples " + util.inspect(samples , false, null));
  let attrs = [
    "Monitoring Location ID",
    "Activity ID",
    "Activity Type",
    "Activity Start Date",
    "Activity Start Time",
    "Project ID 1",
    "Project ID 2",
    "Sample Collection Method ID",
    //"Ignore",   // this has something to do with Sample Collection Method Context, which we need.
    "Sample Collection Equipment Name",
    "Sample Collection Equipment Comment",
    "Characteristic Name",
    "Method Speciation",
    "Result Detection Condition",
    "Result Value",
    "Result Unit",
    "Result Sample Fraction",
    "Result Analytical Method ID",
    "Result Analytical Method Context",
    "Result Detection Limit Type",
    "Result Detection Limit Value",
    "Result Detection Limit Unit"];

  // start with the header
  let fileContent = attrs.join("\t") + "\n";

  let count = 0;
  // Each sample coming from the spread sheets will result in a row for the WQX data file
  for (let i = 0; i < samples.length; ++i) {

    // will not be including on any empty samples
    if ( ! isEmptyInsituData(samples[i])) {

      // check special case of ignoring empty nutrient data and it is empty.  If so skip this line
      if (  ( ignoreNoNutrientSamples ) && ( isEmptyNutrientData(samples[i]) ) ) {
        continue;
      }

      ++count;


      if (notQAedOutOrBlank(samples[i].Temp))      { fileContent += createLineForAttribute("Temp",       samples[i]); }
      if (notQAedOutOrBlank(samples[i].DO))        { fileContent += createLineForAttribute("DO",         samples[i]); }
      if (notQAedOutOrBlank(samples[i]['DO%']))    { fileContent += createLineForAttribute("DO%",        samples[i]); }
      if (notQAedOutOrBlank(samples[i].Turbidity)) { fileContent += createLineForAttribute("Turbidity",  samples[i]); }
      if (notQAedOutOrBlank(samples[i].pH))        { fileContent += createLineForAttribute("pH",         samples[i]); }
      if (notQAedOutOrBlank(samples[i].Salinity))  { fileContent += createLineForAttribute("Salinity",   samples[i]); }
      if (notQAedOutOrBlank(samples[i].TotalN))    { fileContent += createLineForAttribute("TotalN",     samples[i]); }
      if (notQAedOutOrBlank(samples[i].TotalP))    { fileContent += createLineForAttribute("TotalP",     samples[i]); }
      if (notQAedOutOrBlank(samples[i].Phosphate)) { fileContent += createLineForAttribute("Phosphate",  samples[i]); }
      if (notQAedOutOrBlank(samples[i].Silicate))  { fileContent += createLineForAttribute("Silicate",   samples[i]); }
      if (notQAedOutOrBlank(samples[i].NNN))       { fileContent += createLineForAttribute("NNN",        samples[i]); }
      if (notQAedOutOrBlank(samples[i].NH4))       { fileContent += createLineForAttribute("NH4",        samples[i]); }
    }

  }

  return fileContent;

}


/* get the full file path for the file that has data for all the labs */
var getFilePath = function (data, newOrExisting) {
  let thePath = path.join(data.directoryForFiles, data.basenameForFiles);
  if (data.requestedSampleID !== "") {
    thePath = `${thePath}.${data.requestedSampleID}`;
  }
  if (newOrExisting) {
    thePath = `${thePath}.${newOrExisting}`;
  }
  thePath = `${thePath}.txt`;
  return thePath;
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

/* ****************************************************************************************
**************************************************************************************** */

var createTSVfileForImport = function (data, callback) {

//    data.samplesToAddKV    = onlyInGS;
//    data.samplesInCommonKV = inCommon;
//    data.samplesToUpdateKV = inCommonButDiffer;  // need to check the data that is currently in both for differences in case there needs to be updates
//    data.samplesToDeleteKV = onlyInWQX;
  console.log("In createTSVfileForImport");

  // if a WQX or set of STORET files (no implemented yet) was passed in
  // to compare it to the google drive samples
  // there will be in data that indicates the comparision was made.
  // if no comparision was made, a full file of inserts will be created.
  let diffingStoret = false;

  // these are the samples that need to be added to WQX
  // problem: empty samples are being included here and then filtered out in createFileContentFromList
  if (data.samplesToAddKV  && Object.keys(data.samplesToAddKV).length > 0) {
    //console.dir(data.samplesToAddKV);
    //let filePath = getFilePath(data);
    let filePath = getFilePath(data, 'new-add');
    writeFile(filePath, createFileContentFromList(Object.values(data.samplesToAddKV).sort(sortAscendingByDateAndTime), data.ignoreNoNutrientSamples));
    diffingStoret = true;
  }

  // samples that need updated
  if ( data.samplesToUpdateKV && Object.keys(data.samplesToUpdateKV).length > 0)
  {
    //console.log("DIFFERS");
    //console.dir(data.samplesInCommonButDiffer);
    //console.dir(Object.keys(data.samplesInCommonButDiffer));
    let filePath = getFilePath(data, 'existing-update');
    writeFile(filePath, createFileContentFromList(Object.values(data.samplesToUpdateKV).sort(sortAscendingByDateAndTime), data.ignoreNoNutrientSamples));
    diffingStoret = true;
  }

  if ( data.samplesToDeleteKV  && Object.keys(data.samplesToDeleteKV).length > 0)
  {
    //console.log("DIFFERS");
    //console.dir(data.samplesInCommonButDiffer);
    //console.dir(Object.keys(data.samplesInCommonButDiffer));
    let filePath = getFilePath(data, 'delete');
    writeFile(filePath, createFileContentFromList(Object.values(data.samplesToDeleteKV).sort(sortAscendingByDateAndTime), data.ignoreNoNutrientSamples));
    diffingStoret = true;
  }


  // if there was no comparisons made to see add, exiting that need updating, then it is in the mode to
  // write all the sample data from google sheets out as new

  if ( ! diffingStoret && (! data.samplesInCommonKV)) {
  
    console.log("Creating fileContent for all samples");

    let filePath = getFilePath(data, 'new-all');
    writeFile(filePath, createFileContentFromList(data.sortedSamples, data.ignoreNoNutrientSamples));

  }

  if (callback) {
    callback();
  }

};


var printLookupData = function (data, callback) {

  console.log("In printLookupData");
  console.log("Number of sites: " + Object.keys(data.sites).length);

  console.log("");
  console.log("File Content Measurement Names:");
  console.log(util.inspect(fileContentMeasurementNames, false, null));

  console.log("");
  console.log("File Content Precision:");
  console.log(util.inspect(fileContentPrecision, false, null));

  if (callback) {
    callback();
  }
};


var printSamples = function (data, callback) {

/* LEAVE THIS FUNCTION IN PLACE AND COMMENT THIS BACK IN IF YOU WANT TO PRINT OUT SAMPLES
  console.log("In printSamples");
  console.log("Number of samples: " + Object.keys(data.gsSamplesKV).length);

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


var sampleMeetsCriteria = function(data, sample) {
  let returnValue = false;
  if (data.requestedSampleID === "") {
    returnValue = true;  // let everything through the filter
  }
  else if (sample.SampleID === data.requestedSampleID) {
    returnValue = true;
  }
  return returnValue;
};


var filterGoogleSheetsData = function(data, callback) {

  // get all the samples in one list to be sorted
  let filteredSamples = {};

  for (let sampleID in data.gsSamplesKV) {
    if (sampleMeetsCriteria(data, data.gsSamplesKV[sampleID])) {
      filteredSamples[sampleID] = data.gsSamplesKV[sampleID];
    }
  }
  data.gsSamplesKV = filteredSamples;

  if (callback) {
    callback();
  }
};


var filterWQXData = function(data, callback) {

  if (data.wqxSamplesKV) {
    // get all the samples in one list to be sorted
    let filteredSamples = {};

    for (let sampleID in data.wqxSamplesKV) {
      if (sampleMeetsCriteria(data, data.wqxSamplesKV[sampleID])) {
        filteredSamples[sampleID] = data.wqxSamplesKV[sampleID];
      }
    }
    data.wqxSamplesKV = filteredSamples;
  }
  else {
    console.log("There were no WQX samples to filter");
  }

  if (callback) {
    callback();
  }
};


// The insitu measurements can be QAed out with either a blank for a #N/A
// in the spreadsheets.  In WQX, there would be no result entry for that
// measurement, so it would be undefined. So if the insitu measurement
// is not QAed out, compare it to the wqx measurement, which better be
// defined and a value that can be compared.  If the google sheets
// measurement is QAed out, then wqx should be undefined if they are
// equal.

const baseMeasurementDiffers= function(gsParamName, gsValue, wqxParamName, wqxValue, sampleID) {

  let theyDiffer = false;

  if (notQAedOutOrBlank(gsValue)) {
    if (! (gsValue === wqxValue)) {
      console.log(`DIFF: Google Sheets ${gsParamName} ${gsValue} does not match WQX ${wqxParamName} ${wqxValue} in sample ${sampleID}`);
      theyDiffer = true;
    }
  }
  else {   // google sheets says it is blank or QAed out
    //console.log(`DEBUG: found QAed out value, wqx is ${wqxValue}`);
    if (! (wqxValue === undefined)) {
      console.log(`DIFF: Google Sheets ${gsParamName} ${gsValue} is QAed out yet ${wqxParamName} ${wqxValue} is not undefined in sample ${sampleID}`);
      theyDiffer = true;
    }
  }
  return theyDiffer;
};



const insituMeasurementDiffers= function(gsParamName, gsValue, wqxParamName, wqxValue, sampleID) {
  return baseMeasurementDiffers(gsParamName, gsValue, wqxParamName, wqxValue, sampleID);
};

/*

Will want to add logic here to see that a nutrient measurement is below a limit (has the "<") on the front in google
and was "Detection Condition" in WQX. The problem is that WQX does not provide Detection Limit Value in the Excel
files that are downloaded so there can not be a direct comparison.  Probably just print a warning or info to 
say it was detected on both sides.
*/

const nutrientMeasurementDiffers= function(gsParamName, gsValue, wqxParamName, wqxValue, sampleID) {


  if (notQAedOutOrBlank(gsValue) && (String(gsValue).indexOf("<") === 0) && (wqxValue === "<Below-Method-Detection-Limit")) {
    console.log(`WARNING: Google Sheets ${gsParamName} ${gsValue} and WQX ${wqxParamName} ${wqxValue} indicate a Below-Method-Detection-Limit in sample ${sampleID}. Actual value not available in WQX.`);
    return false;
  }
  else {
    return baseMeasurementDiffers(gsParamName, gsValue, wqxParamName, wqxValue, sampleID);
  }
};

var googleSheetsAndWQXSampleDiffer = function(gsSample, wqxSample) {

  //console.log(`comparing samples:`);
  //console.dir(gsSample);
  //console.dir(wqxSample);

  // for convinience
  const sampleID = gsSample['SampleID']; 

  if (gsSample['SampleID']  != wqxSample['SampleID']) return true;
  if (gsSample['Location']  != wqxSample['Monitoring_Location_ID']) return true;
  if (gsSample['Date']      != wqxSample['Activity_Start_Date'].replace(/-/g, '/')) return true;  // wqx is MM-DD-YYYY, google is MM/DD/YYYY
  if (insituMeasurementDiffers('Temp',      gsSample['Temp'],      'Temperature, water',          wqxSample['Temperature, water'],          sampleID)) return true;
  if (insituMeasurementDiffers('Salinity',  gsSample['Salinity'],  'Salinity',                    wqxSample['Salinity'],                    sampleID)) return true;
  if (insituMeasurementDiffers('DO',        gsSample['DO'],        'Dissolved oxygen (DO)',       wqxSample['Dissolved oxygen (DO)'],       sampleID)) return true;
  if (insituMeasurementDiffers('DO%',       gsSample['DO%'],       'Dissolved oxygen saturation', wqxSample['Dissolved oxygen saturation'], sampleID)) return true;
  if (insituMeasurementDiffers('pH',        gsSample['pH'],        'pH',                          wqxSample['pH'],                          sampleID)) return true;
  if (insituMeasurementDiffers('Turbidity', gsSample['Turbidity'], 'Turbidity',                   wqxSample['Turbidity'],                   sampleID)) return true;
  // nutrient data
  if (nutrientMeasurementDiffers('TotalN',    gsSample['TotalN'],    'Total Nitrogen, mixed forms',   wqxSample['Total Nitrogen, mixed forms'],   sampleID)) return true;
  if (nutrientMeasurementDiffers('TotalP',    gsSample['TotalP'],    'Total Phosphorus, mixed forms', wqxSample['Total Phosphorus, mixed forms'], sampleID)) return true;
  if (nutrientMeasurementDiffers('Phosphate', gsSample['Phosphate'], 'Orthophosphate',                wqxSample['Orthophosphate'],                sampleID)) return true;
  if (nutrientMeasurementDiffers('Silicate',  gsSample['Silicate'],  'Silicate',                      wqxSample['Silicate'],                      sampleID)) return true;
  if (nutrientMeasurementDiffers('NNN',       gsSample['NNN'],       'Nitrate + Nitrite',             wqxSample['Nitrate + Nitrite'],             sampleID)) return true;
  if (nutrientMeasurementDiffers('NH4',       gsSample['NH4'],       'Ammonium',                      wqxSample['Ammonium'],                      sampleID)) return true;
  return false;

};


var compareGStoWQXSample = function(data, callback) {

  // key-value pair objects where the key is a sampleID and the value is a google docs sample
  // they will be used later to write the files if they are not null
  data['samplesToAddKV']    = null;
  data['samplesInCommonKV'] = null;
  data['samplesToUpdateKV'] = null;  // googleSheets will be considered the correct one
  data['samplesToDeleteKV'] = null;


  // only do this if there are samples (will be null if none read
  if ( data.wqxSamplesKV ){

    let onlyInGS           = {};  // would be new data that needs to be inserted
    let inCommon           = {};  // need to check the data that is currently in both for differences in case there needs to be updates
    let inCommonButDiffer  = {};  // any in common that differ (should be rare)
    let onlyInWQX          = {};  // this should be rare.  Sample removed from Hui data that needs to be deleted 

    console.log(`Comparing ${Object.keys(data.gsSamplesKV).length} Google Sheets samples to ${Object.keys(data.wqxSamplesKV).length} WQX samples`);

    for (let gsSampleID in data.gsSamplesKV) {
      if (data.wqxSamplesKV[gsSampleID]) {
        inCommon[gsSampleID] = data.gsSamplesKV[gsSampleID];
        if ( googleSheetsAndWQXSampleDiffer(data.gsSamplesKV[gsSampleID], data.wqxSamplesKV[gsSampleID]) ) {
          console.log(`DIFFER`);
          console.dir(data.gsSamplesKV[gsSampleID]);
          console.dir( data.wqxSamplesKV[gsSampleID]);
          inCommonButDiffer[gsSampleID] = data.gsSamplesKV[gsSampleID];
        }
      }
      else {
        onlyInGS[gsSampleID] = data.gsSamplesKV[gsSampleID];
      }
    }

    // see if there might be samples in WQX that are not in Google Sheets.  This would be unusual
    // since it would mean a full sample of data was removed from Google Sheets.
    for (let wqxSampleID in data.wqxSamplesKV) {
      if (! data.gsSamplesKV[wqxSampleID]) {
        onlyInWQX[wqxSampleID] = data.wqxSamplesKV[wqxSampleID];
      }
    }

    console.log(`Found ${Object.keys(onlyInGS).length} sample(s) of a total of ${Object.keys(data.gsSamplesKV).length} in Google Sheets that need to be added to WQX`);
    console.log(`Note: above may be some of 38 samples that are actually empty and later filtered out`);
    console.log(`Found ${Object.keys(onlyInWQX).length} sample(s) in WQX that need to be deleted from WQX`);
    console.log(`Found ${Object.keys(inCommon).length} sample(s) in common between Google Sheets and WQX`);
    console.log(`Found ${Object.keys(inCommonButDiffer).length} sample(s) in common between Google Sheets and WQX that differ`);

    data.samplesToAddKV    = onlyInGS;
    data.samplesInCommonKV = inCommon;
    data.samplesToUpdateKV = inCommonButDiffer;  // need to check the data that is currently in both for differences in case there needs to be updates
    data.samplesToDeleteKV = onlyInWQX;

  }
  else {
    console.log(`No WQX data to compare`);
  }
  
  if (callback) {
    callback();
  }

};


var sortSamples = function(data, callback) {

  // get all the samples in one list to be sorted
  let sampleList = [];

  for (let sampleID in data.gsSamplesKV) {
    sampleList.push(data.gsSamplesKV[sampleID]);
  }
  data.sortedSamples = sampleList.sort(sortAscendingByDateAndTime);

  if (callback) {
    callback();
  }
};


// this is the main


getSiteData(data, function () {
    readGoogleSheetsData(data, function () {
      readNutrientData(data, function () {
        updateSamplesWithNutrientData(data, function () {
          filterGoogleSheetsData(data, function () {
            readWQXData(data, function () {
              filterWQXData(data, function () {
                compareGStoWQXSample(data, function () {
                  printLookupData(data, function () {
                    sortSamples(data, function () {
                       initResultAttributes(data, function () {
                          printSamples(data, function () {   // for troubleshooting, need to comment things back in in the function to use it
                            createTSVfileForImport(data, null);
                      });
                    });
                  });
                });
                });
                });
              });
            });
          });
        });
      });
});

