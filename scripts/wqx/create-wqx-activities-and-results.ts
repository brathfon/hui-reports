#!/usr/bin/env -S npx tsx

import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';

import * as rsgs from '../../lib/readSiteGdriveSheet';
import * as rss from '../../lib/readSpreadSheets';
import * as rnf from '../../lib/readSoestFiles';
//import * as rrf from '../../lib/readWQXWebResultsFile';  // currently deprecated unless simpler ResultsExport.xlsx becomes available again from WQX
import * as rrf from '../../lib/readWQXWebResultDetailFile';  // reads new 256 column ResultDetailExport file as of 11/6/23
import * as rwqp from '../../lib/readWQPResultFile';  // reads resultphyschem.tsv from the Water Quality Portal
import type { Sites } from '../../lib/readSiteGdriveSheet';
import type { NutrientSample } from '../../lib/readSoestFiles';
import type { WQXSample } from '../../lib/readWQXWebResultDetailFile';
import type { LogMessage } from '../../lib/logFormatter';
import { IssueLog, fatal, runWithIssueSummary, isoDateFromShortDate } from '../../lib/issues';

const argv = minimist(process.argv.slice(2));
const scriptname = path.basename(process.argv[1]);

console.log(`arguments passed in ${util.inspect(argv, false, null)}`);

const printUsage = function () {
  console.log(`Usage: ${scriptname} --odir <directory to write files> --bname <basename for the files> --gsdir <Google sheets directory> --ndir <nutrient data directory> [--wqx <wqx results file>] [--inns] [--sid sampleID]`);
  console.log(`optional:`);
  console.log(`  --inns                    Ignore no nutrient data lines. They will not be included in the data.`);
  console.log(`  --sid                     Get the data for a certain sampleID.  Mainly for testing or correcting a mistake.`);
  console.log(`  --wqx <wqx results file>  Downloaded tab separated file of results from wqx to compare to google sheets data and create insert, update and delete files.`);
  console.log(`                            Either the Result Detail Export from the WQX web site or resultphyschem.tsv from the Water Quality Portal.`);
}

if (argv.help || argv.h ) {
  printUsage();
  process.exit();
}

const requiredArg = function (short: string, long: string, errorMessage: string): string {
  const value = argv[long] ?? argv[short];
  if (value === undefined || value === true || value === '') {
    console.log(`ERROR: ${errorMessage}`);
    printUsage();
    process.exit(1);
  }
  return String(value);  // minimist turns arguments that look like numbers into numbers
};

const optionalArg = function (short: string, long: string): string {
  const value = argv[long] ?? argv[short];
  return value === undefined ? "" : String(value);
};

interface Config {
  directoryForFiles: string;
  basenameForFiles: string;
  googleSheetsDirectory: string;
  nutrientDirectory: string;
  // the site information comes from a downloaded sheet of the google drive spreadsheet where the insitu data is recorded
  siteFile: string;
  // Default behavior will be to include samples without nutrient data
  ignoreNoNutrientSamples: boolean;
  // "" means all samples
  requestedSampleID: string;
  // "" means no WQX file to compare against
  wqxFile: string;
}

const googleSheetsDirectory = requiredArg('g', 'gsdir', "you must specify a google spread sheet directory for reading the exported data");

const config: Config = {
  directoryForFiles:     requiredArg('o', 'odir',  "you must specify an output directory to write the tsv data files"),
  basenameForFiles:      requiredArg('b', 'bname', "you must specify a basename to write the tsv data files"),
  googleSheetsDirectory,
  nutrientDirectory:     requiredArg('n', 'ndir',  "you must specify a directory to find nutrient data tsv files"),
  siteFile:              path.join(googleSheetsDirectory, "Hui o ka Wai Ola Data Entry - Site Codes.tsv"),
  // if the option is passed in, do not include samples without nutrient data
  ignoreNoNutrientSamples: Boolean(argv.i || argv.inns),
  requestedSampleID:     optionalArg('s', 'sid'),
  //  was a wqx file specified so to compare to find new or modified or removed data?
  wqxFile:               optionalArg('w', 'wqx'),
};

// some of the optional args can be conflicting.  requestedSampleID and wqxFile don't make sense together
// requestedSampleID is more of a testing option.  wqxFile is probably the usual way it will be used.

console.log("config " + util.inspect(config, false, null));

// collects the errors and warnings found so they can be summarized at the end of the run
const issues = new IssueLog();

const NUTRIENT_COLUMNS = ['TotalN', 'TotalP', 'Phosphate', 'Silicate', 'NNN', 'NH4'] as const;
const INSITU_COLUMNS   = ['Temp', 'Salinity', 'DO', 'DO%', 'pH', 'Turbidity'] as const;

type MeasurementColumn = typeof NUTRIENT_COLUMNS[number] | typeof INSITU_COLUMNS[number];

// A sample from the Google sheets, with nutrient data filled in when it is available.
// The measurements have already had their precision set.
interface GSSample extends Record<MeasurementColumn, string> {
  Source: string;
  NutSampled: string;
  SampleID: string;    // ex: RWA190716, which encode the site and the date
  SiteName: string;
  Location: string;    // site code
  Session: string;
  Date: string;        // MM/DD/YYYY
  Time: string;        // HH:MM, or "null" if there is no time
  Turb1: string;
  Turb2: string;
  Turb3: string;
  Lab: string;
}

// key is the sampleID
type GSSamples = Record<string, GSSample>;
type WQXSamples = Record<string, WQXSample>;

// this is mapping how the measurement or column names are stored in the structures as they are read
// and how they should be printed out in QA commments, etc.  Most are the same.
const fileContentMeasurementNames: Record<MeasurementColumn, string> = {
  Temp:      'Temp',
  Salinity:  'Salinity',
  DO:        'DO',
  'DO%':     'DO_sat',  // only one that is different
  pH:        'pH',
  Turbidity: 'Turbidity',
  TotalN:    'TotalN',
  TotalP:    'TotalP',
  Phosphate: 'Phosphate',
  Silicate:  'Silicate',
  NNN:       'NNN',
  NH4:       'NH4',
};

// this is how many significate digits should be printed in the file content
const fileContentPrecision: Record<MeasurementColumn | 'Lat' | 'Long', number> = {
  Temp:      1,
  Salinity:  1,
  DO:        2,
  'DO%':     1,
  pH:        2,
  Turbidity: 2,

  TotalN:    2,
  TotalP:    2,
  Phosphate: 2,
  Silicate:  2,
  NNN:       2,
  NH4:       2,

  Lat:       6,
  Long:      6,
};


const getSiteData = function (): Sites {

  console.log("In getSiteData");
  return rsgs.readSiteGdriveSheet(config.siteFile, issues);
};


// errors and warnings from the WQX file reader go in the issue summary, the rest just in the log
const printLog = function (logList: LogMessage[]): void {

  for (const logMessage of logList) {
    if (logMessage.level == "ERROR") {
      issues.error('wqx-file', logMessage.msg, { source: path.basename(config.wqxFile) });
    }
    else if (logMessage.level == "WARN") {
      issues.warning('wqx-file', logMessage.msg, { source: path.basename(config.wqxFile) });
    }
    else {
      console.log(`${logMessage.msg}`);
    }
  }
};

// Read the tab separated data from the Google Sheets for each team.


const readGoogleSheetsData = function (): GSSamples {

  console.log("In readGoogleSheetsData");

  const sessions = rss.readTeamSheets(config.googleSheetsDirectory, issues);

  //  the spread sheet reader returns an object whose attibutes (keys) are a combo of the lab code and the session number
  // and it's value is a list of samples for that session. These need to be flattened to just samples.
  // What is returned
  // { 'NMS:1':
  //    [ { Added_to_Main: 'yes',
  //        Ver_By_Dana: 'yes',
  //        Nut_Sample: 'yes', .....
  //

  const gsSamplesKV: GSSamples = {};  // google sheets samples key value: key is sampleID, value is a sample object

  for (const labSessionCode in sessions) {
    for (const row of sessions[labSessionCode]) {
      // translate the keys from the spread sheet data into keys from the legacy web export file
      const obj: GSSample = {
        Source:     "google sheets",
        NutSampled: row.Nut_Sample,
        SampleID:   row.SampleID,
        SiteName:   row.SiteName,
        Location:   row.Station,
        Session:    row.Session,
        Date:       fixDateFormat(row.Date), // put the date in the MM/DD/YYYY format
        Time:       fixTimeFormat(row.Time), // put the time in the HH:MM format
        Temp:       setPrecision('Temp', row.Temp),
        Salinity:   setPrecision('Salinity', row.Salinity),
        DO:         setPrecision('DO', row.DO),
        'DO%':      setPrecision('DO%', row['DO%']),
        pH:         setPrecision('pH', row.pH),
        Turb1:      row.Turb1,
        Turb2:      row.Turb2,
        Turb3:      row.Turb3,
        Turbidity:  setPrecision('Turbidity', calculateAvgTurbidity(row)),
        Lab:        row.Lab,
        // set the nutrient data to blanks.  It may or may not get updated later when the nutrient data results are received
        TotalN:     '',
        TotalP:     '',
        Phosphate:  '',
        Silicate:   '',
        NNN:        '',
        NH4:        '',
      };
      gsSamplesKV[obj.SampleID] = obj;
    }
  }

  return gsSamplesKV;
};



const readNutrientData = function (sites: Sites): Record<string, NutrientSample> {

  // One subdirectory per region, as created by import-nutrient-data. Lanai was added after this script was
  // written and was missed, so Lanai nutrient data was not sent to WQX until 2026. Older nutrient
  // directories (such as the test data) only have west-maui and south-maui.
  const combined: rnf.NutrientSamples = {};
  // Moloka'i is left out until its Site Codes and Report Constants rows are complete. Add 'molokai' back then.
  for (const region of ['west-maui', 'south-maui', 'lanai']) {
    const directory = path.join(config.nutrientDirectory, region);
    if (! fs.existsSync(directory)) {
      console.log(`-- No nutrient data directory ${directory}`);
      continue;
    }
    const regionSamples = rnf.readSoestFiles(directory, sites, issues);
    console.log(`-- Number of ${region} nutrient samples : ${Object.keys(regionSamples).length}`);
    Object.assign(combined, regionSamples);
  }

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

  const nutrientSamples: Record<string, NutrientSample> = {};  // key will be SampleID, value will be object with location information
  for (const weirdCode in combined) {
    nutrientSamples[combined[weirdCode].SampleID] = combined[weirdCode];
  }

  return nutrientSamples;
};


// Returns the WQX samples, or null if no WQX file was supplied. Exits if the WQX file can not be read,
// since continuing without it would write a file that adds every sample to WQX again.

const readWQXData = function (): WQXSamples | null {

  if (! config.wqxFile) {
    console.log(`no WQX file requested`);
    return null;
  }

  console.log(`WQX file ${config.wqxFile} being read`);
  const returnedObj = rwqp.isWQPResultFile(config.wqxFile)   // key is sampleID, value is sample object
    ? rwqp.readWQPResultFile(config.wqxFile)
    : rrf.readWQXWebResultsFile(config.wqxFile);
  printLog(returnedObj.log);  // print out the log data returned from this reader
  if (returnedObj.status !== "SUCCESS") {
    fatal(`There was a problem reading the WQX file ${config.wqxFile}.`);
  }
  return returnedObj.samples;
};

const updateSamplesWithNutrientData = function (gsSamplesKV: GSSamples, nutrientSamples: Record<string, NutrientSample>): void {

  // Check to make sure all nutrient sampleIDs have a matching insitu sample to join to if not, report a problem.
  // When the IDs do not match it is usually a typo in the SampleID in the team sheet, so look for an insitu
  // sample at the same site on the same date to point at.

  const sampleIdBySiteAndDate: Record<string, string> = {};
  for (const sample of Object.values(gsSamplesKV)) {
    sampleIdBySiteAndDate[`${sample.Location} ${isoDate(sample)}`] = sample.SampleID;
  }

  for (const sampleID in nutrientSamples) {
    if (! gsSamplesKV[sampleID]) {
      const nutrientSample = nutrientSamples[sampleID];
      const date = isoDateFromShortDate(nutrientSample.Date);
      const sameSiteAndDate = sampleIdBySiteAndDate[`${nutrientSample.Location} ${date}`];
      const hint = sameSiteAndDate ? ` The team sheet has SampleID "${sameSiteAndDate}" for this site and date.` : '';
      issues.error('nutrient-no-insitu-match',
        `did not find matching insitu sample for nutrient sample (site: ${nutrientSample.Location} date: ${nutrientSample.Date}). Nutrient data will not be sent to WQX.${hint}`,
        { sampleId: sampleID, date });
    }
  }

  console.log("In updateSamplesWithNutrientData");
  console.log("Number of samples:          " + Object.keys(gsSamplesKV).length);
  console.log("Number of nutrient samples: " + Object.keys(nutrientSamples).length);

  for (const sampleID in gsSamplesKV) {
    const nutrientSample = nutrientSamples[sampleID];
    if (nutrientSample) {
      for (const column of NUTRIENT_COLUMNS) {
        gsSamplesKV[sampleID][column] = setPrecision(column, nutrientSample[column]);
      }
    }
  }
};


const isEmptyNutrientData = function (sample: GSSample): boolean {

  if (sample.NutSampled.toLowerCase() === "no") return true;  // they will never have values

  return NUTRIENT_COLUMNS.every(column => sample[column] === "");
};


const isEmptyInsituData = function (sample: GSSample): boolean {
  return INSITU_COLUMNS.every(column => sample[column] === "");
};


const isEmptyInsituAndNutrientData = function (sample: GSSample): boolean {
  return (isEmptyInsituData(sample) && isEmptyNutrientData(sample));
}


const calculateAvgTurbidity = function (sample: rss.TeamSheetRow): string {

  // if the turbidity has been QAed out, it might have #N/A as its value
  if ( (sample.Turb1 === "#N/A") &&
       (sample.Turb2 === "#N/A") &&
       (sample.Turb3 === "#N/A") ) {
    return "#N/A";
  }

  let numTurbs = 0;
  let total = 0.0;
  for (const turb of [sample.Turb1, sample.Turb2, sample.Turb3]) {
    if (turb !== "" && turb !== "#N/A") {
      total += parseFloat(turb);
      ++ numTurbs;
    }
  }

  if (numTurbs !== 0) {
    return String(total / numTurbs);
  }
  else {
    return "";
  }

};


const formatSampleWithSigFigs = function(theSample: string, numSigFigs: number): string {

  if ((theSample !== null) && (theSample !== undefined) && theSample !== "") {
    return parseFloat(theSample).toFixed(numSigFigs);
  }
  return "";
};

const setPrecision = function(attribute: keyof typeof fileContentPrecision, value: string): string {
  // need to check for two situations where we will not mess with the sig figs
  // one if it is blank or QAed out and also if it starts with a < to indicate it as below detectable levels
  if (notQAedOutOrBlank(value) && !(value.indexOf("<") === 0)) {
    return formatSampleWithSigFigs(value, fileContentPrecision[attribute]);
  }
  return value;
};


// Converts YYYY-MM-DD to MM/DD/YYYY. The team sheet reader has already checked the format.
const fixDateFormat = function (aDate: string): string {

  const isoPattern = /^[1-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/; // example: 2019-06-28

  if (isoPattern.test(aDate)) {
    const [year, month, day] = aDate.split("-");
    return `${month}/${day}/${year}`;
  }
  return fatal(`unrecognized date format of ${aDate}.`);
};


const fixTimeFormat = function (aTime: string): string {

  // some samples do not have a time associated with them if for some reason the sample was not taken
  if (aTime === "null") {
    return aTime;
  }
  const needsFixedPattern = /^[0-9]:[0-9][0-9]$/; // example: 9:56
  const okPattern = /^[0-2][0-9]:[0-9][0-9]$/; // example: 09:56

  if (okPattern.test(aTime)) {   // it matches and OK
    return aTime;
  }
  if (needsFixedPattern.test(aTime)) {
    return `0${aTime}`;
  }
  return fatal(`unrecognized time format of ${aTime}.`);
}


// MM/DD/YYYY to YYYY-MM-DD, for sorting issues by date
const isoDate = function (sample: GSSample): string {
  const [month, day, year] = sample.Date.split('/');
  return `${year}-${month}-${day}`;
};


/* ************************************************************************
A value can be left blank to signal several things: it was not collected
for one reason or another, the values can be pending from the lab, or
if they are QA'ed out.  There is some legacy data out there that also
has #N/A to show that the value has been Q/Aed out.
************************************************************************ */
const notQAedOutOrBlank = function (value: string): boolean {
  return ( value !== "#N/A" && value !== "#n/a" && value.trim() !== "");
}


// sort of a global (sorry about that) that is used to store some lookup information about each kind of result being reported
interface ResultAttribute {
  characteristicName: string;
  methodSpeciation: string;
  resultUnit: string;
  activityType: string;
  activityIDsuffix: string;
  resultSampleFraction: string;
  sampleCollectionMethodID: number;
  sampleCollectionEquipmentName: string;
  sampleCollectionEquipmentComment: string;
  resultAnalyticalMethodID: number | string;
  resultAnalyticalMethodIDContext: string;
}

const resultAttributes = {} as Record<MeasurementColumn, ResultAttribute>;

const initResultAttributes = function(): void {

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
};



const createLineForAttribute = function (huiResultName: MeasurementColumn, huiSample: GSSample): string {

  const theLine: (string | number)[] = [];

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
  if (resultMeasureValue.indexOf("<") === 0 ) {
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


// the order the results are written for each sample
const RESULT_ORDER: MeasurementColumn[] = ['Temp', 'DO', 'DO%', 'Turbidity', 'pH', 'Salinity', 'TotalN', 'TotalP', 'Phosphate', 'Silicate', 'NNN', 'NH4'];

const createFileContentFromList = function (samples: GSSample[], ignoreNoNutrientSamples: boolean): string {

  console.log("In createFileContent From List");

  const attrs = [
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

  // Each sample coming from the spread sheets will result in a row for the WQX data file
  for (const sample of samples) {

    // will not be including on any empty samples
    if (isEmptyInsituData(sample)) {
      continue;
    }

    // check special case of ignoring empty nutrient data and it is empty.  If so skip this line
    if (ignoreNoNutrientSamples && isEmptyNutrientData(sample)) {
      continue;
    }

    for (const column of RESULT_ORDER) {
      if (notQAedOutOrBlank(sample[column])) {
        fileContent += createLineForAttribute(column, sample);
      }
    }
  }

  return fileContent;

}


// This function creates the file for deleting activities, which then in turn deletes the results with that activity.
// The format matches the delete files that were made by hand before the script could create them:
//
// Activity ID
// LMT240719:FM:PS:DO:
// LMT240719:FM:PS:TS:

const createDeleteFileContentFromList = function (activityIDs: string[]): string {

  console.log("In createDeleteFileContent From List");

  // start with the header
  let fileContent = "Activity ID\n";  // first line is like a column header

  for (const activityID of activityIDs) {
    console.log(`Activity ID of an activity to delete ${activityID}`);
    fileContent += activityID + "\n";
  }
  return fileContent;
}


/* get the full file path for the file that has data for all the labs */
const getFilePath = function (newOrExisting: string): string {
  let thePath = path.join(config.directoryForFiles, config.basenameForFiles);
  if (config.requestedSampleID !== "") {
    thePath = `${thePath}.${config.requestedSampleID}`;
  }
  if (newOrExisting) {
    thePath = `${thePath}.${newOrExisting}`;
  }
  thePath = `${thePath}.txt`;
  return thePath;
};


const writeFile = function (filePath: string, dataToWrite: string): void {

  console.log(`Writing file to ${filePath}`);
  fs.writeFileSync(filePath, dataToWrite);
};


// The result of comparing the Google Sheets samples to the WQX samples. Each is keyed by sampleID.
interface Comparison {
  samplesToAddKV: GSSamples;
  samplesInCommonKV: GSSamples;
  samplesToUpdateKV: GSSamples;   // googleSheets will be considered the correct one
  // Activities to delete from WQX. These are all of the activities for samples that are no longer in the
  // Google Sheets, plus the activities holding results that have since been QA'ed out. The update file
  // can not remove a result, so the activity is deleted and the update file adds back its other results.
  activityIDsToDelete: string[];
}

/* ****************************************************************************************
**************************************************************************************** */

const createTSVfileForImport = function (comparison: Comparison | null, sortedSamples: GSSample[]): void {

  console.log("In createTSVfileForImport");

  // if a WQX or set of STORET files (no implemented yet) was passed in
  // to compare it to the google drive samples
  // there will be in data that indicates the comparision was made.
  // if no comparision was made, a full file of inserts will be created.
  if (! comparison) {

    console.log("Creating fileContent for all samples");

    writeFile(getFilePath('new-all'), createFileContentFromList(sortedSamples, config.ignoreNoNutrientSamples));
    return;
  }

  // these are the samples that need to be added to WQX
  // problem: empty samples are being included here and then filtered out in createFileContentFromList
  if (Object.keys(comparison.samplesToAddKV).length > 0) {
    writeFile(getFilePath('new-add'), createFileContentFromList(Object.values(comparison.samplesToAddKV).sort(sortAscendingByDateAndTime), config.ignoreNoNutrientSamples));
  }

  // samples that need updated
  if (Object.keys(comparison.samplesToUpdateKV).length > 0) {
    writeFile(getFilePath('existing-update'), createFileContentFromList(Object.values(comparison.samplesToUpdateKV).sort(sortAscendingByDateAndTime), config.ignoreNoNutrientSamples));
  }

  if (comparison.activityIDsToDelete.length > 0) {
    writeFile(getFilePath('delete'), createDeleteFileContentFromList(comparison.activityIDsToDelete));
    issues.warning('wqx-load-order', `Load ${path.basename(getFilePath('delete'))} into WQX before ${path.basename(getFilePath('existing-update'))}, since the update adds back results in the deleted activities.`);
  }
};


const printLookupData = function (sites: Sites): void {

  console.log("In printLookupData");
  console.log("Number of sites: " + Object.keys(sites).length);

  console.log("");
  console.log("File Content Measurement Names:");
  console.log(util.inspect(fileContentMeasurementNames, false, null));

  console.log("");
  console.log("File Content Precision:");
  console.log(util.inspect(fileContentPrecision, false, null));
};


// Dates are MM/DD/YYYY and times are HH:MM, so they compare correctly as strings once
// the date is reordered to YYYY/MM/DD. Samples without a time sort after those with one.
const sortAscendingByDateAndTime = function(a: GSSample, b: GSSample): number {

  const dateKey = (sample: GSSample) => {
    const [month, day, year] = sample.Date.split('/');
    return `${year}/${month}/${day}`;
  };
  const aDate = dateKey(a);
  const bDate = dateKey(b);
  if (aDate !== bDate) {
    return aDate < bDate ? -1 : 1;
  }

  // there are some samples without any times. Treat them as later than any sample with a time.
  const aNoTime = a.Time === "null";
  const bNoTime = b.Time === "null";
  if (aNoTime || bNoTime) {
    return Number(aNoTime) - Number(bNoTime);
  }

  if (a.Time !== b.Time) {
    return a.Time < b.Time ? -1 : 1;
  }
  return 0;
};


const sampleMeetsCriteria = function(sample: { SampleID: string }): boolean {
  return config.requestedSampleID === "" || sample.SampleID === config.requestedSampleID;
};


const filterSamples = function<T extends { SampleID: string }>(samplesKV: Record<string, T>): Record<string, T> {

  const filteredSamples: Record<string, T> = {};

  for (const sampleID in samplesKV) {
    if (sampleMeetsCriteria(samplesKV[sampleID])) {
      filteredSamples[sampleID] = samplesKV[sampleID];
    }
  }
  return filteredSamples;
};


// The insitu measurements can be QAed out with either a blank for a #N/A
// in the spreadsheets.  In WQX, there would be no result entry for that
// measurement, so it would be undefined. So if the insitu measurement
// is not QAed out, compare it to the wqx measurement, which better be
// defined and a value that can be compared.  If the google sheets
// measurement is QAed out, then wqx should be undefined if they are
// equal.

const baseMeasurementDiffers= function(gsParamName: string, gsValue: string, wqxParamName: string, wqxValue: string | undefined, sampleID: string): boolean {

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



const insituMeasurementDiffers= function(gsParamName: string, gsValue: string, wqxParamName: string, wqxValue: string | undefined, sampleID: string): boolean {
  return baseMeasurementDiffers(gsParamName, gsValue, wqxParamName, wqxValue, sampleID);
};

/*

Will want to add logic here to see that a nutrient measurement is below a limit (has the "<") on the front in google
and was "Detection Condition" in WQX. The problem is that WQX does not provide Detection Limit Value in the Excel
files that are downloaded so there can not be a direct comparison.  Probably just print a warning or info to
say it was detected on both sides.
*/

const nutrientMeasurementDiffers= function(gsParamName: string, gsValue: string, wqxParamName: string, wqxValue: string | undefined, sampleID: string): boolean {


  if (notQAedOutOrBlank(gsValue) && (gsValue.indexOf("<") === 0) && (wqxValue === "<Below-Method-Detection-Limit")) {
    issues.info('wqx-below-detection-limit', `Google Sheets ${gsParamName} ${gsValue} and WQX ${wqxParamName} ${wqxValue} indicate a Below-Method-Detection-Limit. Actual value not available in WQX.`,
      { sampleId: sampleID });
    return false;
  }
  else {
    return baseMeasurementDiffers(gsParamName, gsValue, wqxParamName, wqxValue, sampleID);
  }
};

const googleSheetsAndWQXSampleDiffer = function(gsSample: GSSample, wqxSample: WQXSample): boolean {

  // for convinience
  const sampleID = gsSample['SampleID'];

  if (gsSample['SampleID']  != wqxSample['SampleID']) return true;
  if (gsSample['Location']  != wqxSample['Monitoring_Location_ID']) return true;
  if (gsSample['Date']      != wqxSample['Activity_Start_Date'].replace(/-/g, '/')) return true;  // wqx is MM-DD-YYYY, google is MM/DD/YYYY
  if (insituMeasurementDiffers('Temp',      gsSample['Temp'],      'Temperature, water',          wqxSample.results['Temperature, water'],          sampleID)) return true;
  if (insituMeasurementDiffers('Salinity',  gsSample['Salinity'],  'Salinity',                    wqxSample.results['Salinity'],                    sampleID)) return true;
  if (insituMeasurementDiffers('DO',        gsSample['DO'],        'Dissolved oxygen (DO)',       wqxSample.results['Dissolved oxygen (DO)'],       sampleID)) return true;
  if (insituMeasurementDiffers('DO%',       gsSample['DO%'],       'Dissolved oxygen saturation', wqxSample.results['Dissolved oxygen saturation'], sampleID)) return true;
  if (insituMeasurementDiffers('pH',        gsSample['pH'],        'pH',                          wqxSample.results['pH'],                          sampleID)) return true;
  if (insituMeasurementDiffers('Turbidity', gsSample['Turbidity'], 'Turbidity',                   wqxSample.results['Turbidity'],                   sampleID)) return true;
  // nutrient data
  if (nutrientMeasurementDiffers('TotalN',    gsSample['TotalN'],    'Total Nitrogen, mixed forms',   wqxSample.results['Total Nitrogen, mixed forms'],   sampleID)) return true;
  if (nutrientMeasurementDiffers('TotalP',    gsSample['TotalP'],    'Total Phosphorus, mixed forms', wqxSample.results['Total Phosphorus, mixed forms'], sampleID)) return true;
  if (nutrientMeasurementDiffers('Phosphate', gsSample['Phosphate'], 'Orthophosphate',                wqxSample.results['Orthophosphate'],                sampleID)) return true;
  if (nutrientMeasurementDiffers('Silicate',  gsSample['Silicate'],  'Silicate',                      wqxSample.results['Silicate'],                      sampleID)) return true;
  if (nutrientMeasurementDiffers('NNN',       gsSample['NNN'],       'Nitrate + Nitrite',             wqxSample.results['Nitrate + Nitrite'],             sampleID)) return true;
  if (nutrientMeasurementDiffers('NH4',       gsSample['NH4'],       'Ammonium',                      wqxSample.results['Ammonium'],                      sampleID)) return true;
  return false;

};


// Every activity in WQX for this sample, in the order they were found in the WQX file
const allActivityIDs = function (wqxSample: WQXSample): string[] {
  return [...new Set(Object.values(wqxSample.activityIDs))];
};


// The activities holding results that are in WQX but are now QA'ed out (or blank) in the Google Sheets
const activityIDsWithQAedOutResults = function (gsSample: GSSample, wqxSample: WQXSample): string[] {
  const activityIDs = new Set<string>();
  for (const column of RESULT_ORDER) {
    const characteristic = resultAttributes[column].characteristicName;
    if (! notQAedOutOrBlank(gsSample[column]) && wqxSample.results[characteristic] !== undefined) {
      issues.warning('wqx-delete-activity',
        `${column} is QA'ed out in Google Sheets but is ${wqxSample.results[characteristic]} in WQX. Will delete activity ${wqxSample.activityIDs[characteristic]} and add back its other results.`,
        { sampleId: gsSample.SampleID, date: isoDate(gsSample) });
      activityIDs.add(wqxSample.activityIDs[characteristic]);
    }
  }
  return [...activityIDs];
};


const compareGStoWQXSample = function(gsSamplesKV: GSSamples, wqxSamplesKV: WQXSamples): Comparison {

  const onlyInGS: GSSamples          = {};  // would be new data that needs to be inserted
  const inCommon: GSSamples          = {};  // need to check the data that is currently in both for differences in case there needs to be updates
  const inCommonButDiffer: GSSamples = {};  // any in common that differ (should be rare)
  const onlyInWQX: WQXSamples        = {};  // this should be rare.  Sample removed from Hui data that needs to be deleted

  console.log(`Comparing ${Object.keys(gsSamplesKV).length} Google Sheets samples to ${Object.keys(wqxSamplesKV).length} WQX samples`);

  for (const gsSampleID in gsSamplesKV) {
    if (wqxSamplesKV[gsSampleID]) {
      inCommon[gsSampleID] = gsSamplesKV[gsSampleID];
      // there is a special case to catch here, which is when a sample was totally QAed out but not deleted from GS spread sheet
      // in this case it will have time and date information, but all the initu data will be blank, along with the nutrient data
      if (isEmptyInsituAndNutrientData(gsSamplesKV[gsSampleID])) {
        issues.warning('wqx-delete-sample', `sample is empty in Google Sheets (all of its data QA'ed out). All of its activities will be deleted from WQX.`,
          { sampleId: gsSampleID, date: isoDate(gsSamplesKV[gsSampleID]) });
        onlyInWQX[gsSampleID] = wqxSamplesKV[gsSampleID];
      }
      else if ( googleSheetsAndWQXSampleDiffer(gsSamplesKV[gsSampleID], wqxSamplesKV[gsSampleID]) ) {
        issues.info('wqx-update', `differs from WQX and will be in the existing-update file`,
          { sampleId: gsSampleID, date: isoDate(gsSamplesKV[gsSampleID]) });
        console.dir(gsSamplesKV[gsSampleID]);
        console.dir(wqxSamplesKV[gsSampleID]);
        inCommonButDiffer[gsSampleID] = gsSamplesKV[gsSampleID];
      }
    }
    else {
      onlyInGS[gsSampleID] = gsSamplesKV[gsSampleID];
      if (! isEmptyInsituData(gsSamplesKV[gsSampleID])) {
        issues.info('wqx-add', `not in WQX and will be in the new-add file`,
          { sampleId: gsSampleID, date: isoDate(gsSamplesKV[gsSampleID]) });
      }
    }
  }

  // see if there might be samples in WQX that are not in Google Sheets.  This would be unusual
  // since it would mean a full sample of data was removed from Google Sheets.
  for (const wqxSampleID in wqxSamplesKV) {
    if (! gsSamplesKV[wqxSampleID]) {
      onlyInWQX[wqxSampleID] = wqxSamplesKV[wqxSampleID];
      issues.warning('wqx-delete-sample', `sample is in WQX but not in Google Sheets. All of its activities will be deleted from WQX.`,
        { sampleId: wqxSampleID });
    }
  }

  const emptyToAdd = Object.values(onlyInGS).filter(isEmptyInsituData).length;
  console.log(`Found ${Object.keys(onlyInGS).length} sample(s) of a total of ${Object.keys(gsSamplesKV).length} in Google Sheets that need to be added to WQX`);
  console.log(`Note: ${emptyToAdd} of the samples to add are empty and will be filtered out`);
  console.log(`Found ${Object.keys(onlyInWQX).length} sample(s) in WQX that need to be deleted from WQX`);
  console.log(`Found ${Object.keys(inCommon).length} sample(s) in common between Google Sheets and WQX`);
  console.log(`Found ${Object.keys(inCommonButDiffer).length} sample(s) in common between Google Sheets and WQX that differ`);

  // samples are sorted by date to make the delete file easier to review
  const byDate = (a: WQXSample, b: WQXSample) => {
    const key = (sample: WQXSample) => {
      const [month, day, year] = sample.Activity_Start_Date.split('-');
      return `${year}-${month}-${day} ${sample.SampleID}`;
    };
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  };

  const activityIDsToDelete: string[] = [];
  for (const wqxSample of Object.values(onlyInWQX).sort(byDate)) {
    activityIDsToDelete.push(...allActivityIDs(wqxSample));
  }
  let partialCount = 0;
  for (const wqxSample of Object.keys(inCommonButDiffer).map(sampleID => wqxSamplesKV[sampleID]).sort(byDate)) {
    const activityIDs = activityIDsWithQAedOutResults(inCommonButDiffer[wqxSample.SampleID], wqxSample);
    if (activityIDs.length > 0) {
      ++partialCount;
      activityIDsToDelete.push(...activityIDs);
    }
  }
  console.log(`Found ${partialCount} sample(s) in common with results that have been QA'ed out since they were loaded into WQX`);
  console.log(`Found ${activityIDsToDelete.length} activities to delete from WQX`);

  return {
    samplesToAddKV:    onlyInGS,
    samplesInCommonKV: inCommon,
    samplesToUpdateKV: inCommonButDiffer,  // need to check the data that is currently in both for differences in case there needs to be updates
    activityIDsToDelete,
  };
};


// this is the main

const main = function (): void {
  initResultAttributes();
  const sites = getSiteData();
  let gsSamplesKV = readGoogleSheetsData();
  const nutrientSamples = readNutrientData(sites);
  updateSamplesWithNutrientData(gsSamplesKV, nutrientSamples);
  gsSamplesKV = filterSamples(gsSamplesKV);

  const allWqxSamplesKV = readWQXData();
  let comparison: Comparison | null = null;
  if (allWqxSamplesKV) {
    comparison = compareGStoWQXSample(gsSamplesKV, filterSamples(allWqxSamplesKV));
  }
  else {
    console.log(`No WQX data to compare`);
  }

  printLookupData(sites);
  const sortedSamples = Object.values(gsSamplesKV).sort(sortAscendingByDateAndTime);
  createTSVfileForImport(comparison, sortedSamples);
};

runWithIssueSummary(issues, main, "No WQX load files were written.");
