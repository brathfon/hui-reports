#!/usr/bin/env -S npx tsx

import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';

import * as rsgs from '../lib/readSiteGdriveSheet';
import * as rss from '../lib/readSpreadSheets';
import * as rnf from '../lib/readSoestFiles';
import * as rrcf from '../lib/readReportConstantsFile';
import * as rcp from '../lib/reportConstantsParser';
import * as rrqacf from '../lib/readReportQACommentsFile';
import * as rrqacp from '../lib/reportQACommentsParser';
import * as validator from '../lib/validator';
import { IssueLog, isoDateFromShortDate, fatal, runWithIssueSummary } from '../lib/issues';
import type { Sites } from '../lib/readSiteGdriveSheet';
import type { NutrientSample } from '../lib/readSoestFiles';
import type { QAComment } from '../lib/reportQACommentsParser';


const scriptname = path.basename(process.argv[1]);

const printUsage = function () {
  console.log(`Usage: ${scriptname} --odir <directory to write report files> --bname <basename for the files> --gsdir <Google sheets directory> --ndir <nutrient data directory> [--inns]`);
  console.log(`optional:`);
  console.log(`  --inns     Ignore no nutrient data lines. They will not be included in the report.`);
}



interface Config {
  directoryForFiles: string;
  basenameForFiles: string;
  googleSheetsDirectory: string;
  nutrientDirectory: string;
  // the site information comes from a downloaded sheet of the google drive spreadsheet where the insitu data is recorded
  siteFile: string;
  reportConstantsFile: string;
  reportQACommentsFile: string;
  // Default behavior will be to report samples without nutrient data
  ignoreNoNutrientSamples: boolean;
}

const parseArgs = function (): Config {
  const argv = minimist(process.argv.slice(2));
  console.log(`arguments passed in ${util.inspect(argv, false, null)}`);

  if (argv.help || argv.h ) {
    printUsage();
    process.exit();
  }

  const required = function (short: string, long: string, description: string): string {
    const value = argv[long] ?? argv[short];
    if ((typeof value !== 'string' && typeof value !== 'number') || value === '') {
      console.error(`ERROR: you must specify ${description}`);
      printUsage();
      process.exit(1);
    }
    return String(value);  // minimist turns arguments that look like numbers into numbers
  };

  const directoryForFiles     = required('o', 'odir',  'an output directory to write the report files');
  const basenameForFiles      = required('b', 'bname', 'a basename to write the report files');
  const googleSheetsDirectory = required('g', 'gsdir', 'a google spread sheet directory for reading the exported data');
  const nutrientDirectory     = required('n', 'ndir',  'a directory to find nutrient data csv files');

  return {
    directoryForFiles,
    basenameForFiles,
    googleSheetsDirectory,
    nutrientDirectory,
    siteFile:             path.join(googleSheetsDirectory, "Hui o ka Wai Ola Data Entry - Site Codes.tsv"),
    reportConstantsFile:  path.join(googleSheetsDirectory, "Hui o ka Wai Ola Data Entry - Report Constants.tsv"),
    reportQACommentsFile: path.join(googleSheetsDirectory, "Hui o ka Wai Ola Data Entry - Report QA Comments.tsv"),
    // if the option is passed in, do not report samples without nutrient data
    ignoreNoNutrientSamples: Boolean(argv.i || argv.inns),
  };
};


// the subdirectories of the nutrient data directory
// Moloka'i is left out until its Site Codes and Report Constants rows are complete. Add 'molokai' back then.
const NUTRIENT_REGIONS = ['west-maui', 'south-maui', 'lanai'];

const NUTRIENT_COLUMNS = ['TotalN', 'TotalP', 'Phosphate', 'Silicate', 'NNN', 'NH4'] as const;
const INSITU_COLUMNS   = ['Temp', 'Salinity', 'DO', 'DO%', 'pH', 'Turbidity'] as const;

type NutrientColumn    = typeof NUTRIENT_COLUMNS[number];
type InsituColumn      = typeof INSITU_COLUMNS[number];
type MeasurementColumn = NutrientColumn | InsituColumn;

// One in-situ sample from the team sheets, using the keys from the legacy web export file.
// The nutrient data starts blank and is filled in from the nutrient files when there is a match.
interface Sample extends Record<MeasurementColumn, string> {
  NutSampled: string;
  SampleID: string;    // ex: RWA190716, which encode the site and the date
  SiteName: string;
  Location: string;    // site code
  Session: string;
  Date: string;        // MM/DD/YY
  Time: string;        // HH:MM, or "null" if there is no time
  Turb1: string;
  Turb2: string;
  Turb3: string;
  Lab: string;
}

// key is SampleID
type Samples = Record<string, Sample>;


// this is mapping how the measurement or column names are stored in the structures as they are read
// and how they should be printed out in QA commments, etc.  Most are the same.
const reportMeasurementNames: Record<MeasurementColumn, string> = {
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


const reportName = function (dataName: MeasurementColumn): string {
  return reportMeasurementNames[dataName];
};

// this is how many significate digits should be printed in the report
const reportPrecision: Record<MeasurementColumn | 'Lat' | 'Long', number> = {
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


const getSiteData = function (config: Config, issues: IssueLog): Sites {

  console.log("In getSiteData");
  return rsgs.readSiteGdriveSheet(config.siteFile, issues);
};


const getReportConstantsData = function (config: Config): { reportConstantsData: string[][], areaToReportRegion: Record<string, string> } {

  console.log("In getReportConstantsData");
  const reportConstantsData = rrcf.readFile(config.reportConstantsFile);
  return { reportConstantsData, areaToReportRegion: rcp.getAreaToReportRegion(reportConstantsData) };
};


const getReportQACommentsData = function (config: Config): { reportQACommentsData: string[][], sampleIdToQAComments: Record<string, QAComment> } {

  console.log("In getReportQACommentsData");
  const reportQACommentsData = rrqacf.readFile(config.reportQACommentsFile);
  return { reportQACommentsData, sampleIdToQAComments: rrqacp.getSampleIdToQAComments(reportQACommentsData) };
};

// return the site for this site code.
// It is a critical error if there is a site called out that does not have site data, so stop the program

const getSiteFor = function (siteCode: string, sites: Sites) {
   const site = sites[siteCode];
   if (! site) {
     fatal(`site code ${siteCode} not found in site data.`);
   }
   return site;
}


// Read the tab separated data from the Google Sheets for each team.


const readSpreadSheetData = function (config: Config, issues: IssueLog): Samples {

  console.log("In readSpreadSheetData");

  const sessions = rss.readTeamSheets(config.googleSheetsDirectory, issues);

  //  the spread sheet reader returns an object whose attibutes (keys) are a combo of the lab code and the session number
  // and it's value is a list of samples for that session. These need to be flattened to just samples.
  // What is returned
  // { 'NMS:1':
  //    [ { Added_to_Main: 'yes',
  //        Ver_By_Dana: 'yes',
  //        Nut_Sample: 'yes', .....
  //

  const samples: Samples = {};
  for (const labSessionCode in sessions) {
    for (const row of sessions[labSessionCode]) {
      // translate the keys from the spread sheet data into keys from the legacy web export file
      const obj: Sample = {
        NutSampled: row.Nut_Sample,
        SampleID:   row.SampleID,
        SiteName:   row.SiteName,
        Location:   row.Station,  // site code
        Session:    row.Session,
        Date:       fixDateFormat(row.Date), // put the date in the MM/DD/YY format
        Time:       fixTimeFormat(row.Time), // put the time in the HH:MM format
        Temp:       row.Temp,
        Salinity:   row.Salinity,
        DO:         row.DO,
        'DO%':      row['DO%'],
        pH:         row.pH,
        Turb1:      row.Turb1,
        Turb2:      row.Turb2,
        Turb3:      row.Turb3,
        Turbidity:  calculateAvgTurbidity(row),
        Lab:        row.Lab,
        // set the nutrient data to blanks.  It may or may not get updated later when the nutrient data results are received
        TotalN:     '',
        TotalP:     '',
        Phosphate:  '',
        Silicate:   '',
        NNN:        '',
        NH4:        '',
      };
      if (samples[obj.SampleID]) {
        issues.error('sheet-duplicate-sample-id', `SampleID appears more than once in the team sheets. Only the last one is reported.`,
          { sampleId: obj.SampleID, date: isoDateFromShortDate(obj.Date) });
      }
      samples[obj.SampleID] = obj;
    }
  }

  return samples;
};



const readNutrientData = function (config: Config, sites: Sites, issues: IssueLog): Record<string, NutrientSample> {

  // one subdirectory per region, as created by import-nutrient-data
  const combined: rnf.NutrientSamples = {};
  for (const region of NUTRIENT_REGIONS) {
    const directory = path.join(config.nutrientDirectory, region);
    if (! fs.existsSync(directory)) {
      issues.warning('nutrient-missing-directory', `no nutrient data directory ${directory}. Run run-import-nutrient-data.sh to download it.`);
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



const updateSamplesWithNutrientData = function (samples: Samples, nutrientSamples: Record<string, NutrientSample>, issues: IssueLog): void {

  // Check to make sure all nutrient sampleIDs have a matching insitu sample to join to if not, report a problem.
  // When the IDs do not match it is usually a typo in the SampleID in the team sheet, so look for an insitu
  // sample at the same site on the same date to point at.

  const sampleIdBySiteAndDate: Record<string, string> = {};
  for (const sample of Object.values(samples)) {
    sampleIdBySiteAndDate[`${sample.Location} ${isoDateFromShortDate(sample.Date)}`] = sample.SampleID;
  }

  for (const sampleID in nutrientSamples) {
    if (! samples[sampleID]) {
      const nutrientSample = nutrientSamples[sampleID];
      const date = isoDateFromShortDate(nutrientSample.Date);
      const sameSiteAndDate = sampleIdBySiteAndDate[`${nutrientSample.Location} ${date}`];
      const hint = sameSiteAndDate ? ` The team sheet has SampleID "${sameSiteAndDate}" for this site and date.` : '';
      issues.error('nutrient-no-insitu-match',
        `did not find matching insitu sample for nutrient sample (site: ${nutrientSample.Location} date: ${nutrientSample.Date}). Nutrient data will not be reported.${hint}`,
        { sampleId: sampleID, date });
    }
  }

  console.log("In updateSamplesWithNutrientData");
  console.log("Number of samples:          " + Object.keys(samples).length);
  console.log("Number of nutrient samples: " + Object.keys(nutrientSamples).length);

  for (const sampleID in samples) {
    const nutrientSample = nutrientSamples[sampleID];
    if (nutrientSample) {
      // will need a check here for "<" stuff maybe, or it could end up in the printing out part
      for (const column of NUTRIENT_COLUMNS) {
        samples[sampleID][column] = nutrientSample[column];
      }

      checkNutrientSampledFlagVsData(samples[sampleID], issues);

    }
  }
};


const isNutrientMeasurement = function (columnName: MeasurementColumn): boolean {
  return (NUTRIENT_COLUMNS as readonly string[]).includes(columnName);
};


const isEmptyNutrientData = function (sample: Sample): boolean {
  return NUTRIENT_COLUMNS.every(column => sample[column] === "");
};


const isInsituMeasurement = function (columnName: MeasurementColumn): boolean {
  return (INSITU_COLUMNS as readonly string[]).includes(columnName);
};


const isEmptyInsituData = function (sample: Sample): boolean {
  return INSITU_COLUMNS.every(column => sample[column] === "");
};


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

  //console.log(`numTurbs = ${numTurbs} total = ${total} id = ${sample.SampleID}`);
  if (numTurbs !== 0) {
    return String(total / numTurbs);
  }
  else {
    return "";
  }

};


const formatSampleWithSigFigs = function(theSample: string | null | undefined, numSigFigs: number): string {

  if ((theSample !== null) && (theSample !== undefined) && theSample !== "") {
    return parseFloat(theSample).toFixed(numSigFigs);
  }
  return "";
};

const setPrecision = function(attribute: keyof typeof reportPrecision, value: string): string {
  return formatSampleWithSigFigs(value, reportPrecision[attribute]);
};


// This function checks to see if any values have been flagged by QA and are not included.
// If that is true, instead of a value it will have '#N/A' in place of it's value.
// There are 2 ways that QAed data is denoted:
//    1) Data from the legacy spread sheets is already '#N/A'
//    2) Data from the Google Drive spread sheets is blank.
//
// This function is also reponsible for setting the precision of the data, which it gets
// from lookup data near the top of the script

const checkForQAIssues = function(sample: Sample, column: MeasurementColumn, issueDescriptions: Record<string, boolean>, issues: IssueLog): string {

  const value = sample[column];

  // There are two cases where the current value is just return without even looking at it to
  // see if it was QAed out.
  // 1) All the insitu data is blank, indicating that no data was taken
  // 2) All the nutrient data is blank, indicating
  //     a) Nutrient data was skipped for this site
  //     b) Nutrient data samples were shipped to the lab and the results are not in yet

  // these measurements are probably just blank
  if (isNutrientMeasurement(column) && isEmptyNutrientData(sample)) {  // nothing to do, ok to be blank
    return value;
  }
  if (isInsituMeasurement(column) && isEmptyInsituData(sample)) {  // nothing to do, ok to be blank
    return value;
  }

  // There are two cases for measurements being QAed out.  The legacy data had "#N/A" as values
  // and the Google Drive spreadsheet has just blanks.
  if ((value === "") || (value.toUpperCase() === "#N/A")) {
      const msg = reportName(column) + " QA'ed out";
      // add this to the descriptions of qa issues
      issueDescriptions[msg] = true;  // this will eliminate dups as in the case of turbidity
      return "#N/A";
  }

  // if the string begins with <, as in <1.5, this indicates the measurement was below the limits
  // of the measuring equipment (usually found with nutrient data).
  const belowDetectionLimit = value.indexOf("<") === 0;
  const number = belowDetectionLimit ? value.substring(1) : value;  // the number without the "<" on the front

  if (! validator.isFloat(number.trim())) {
    issues.error('non-numeric-value', `${reportName(column)} value "${value}" is not a number`,
      { sampleId: sample.SampleID, date: isoDateFromShortDate(sample.Date) });
  }

  if (belowDetectionLimit) {
      const msg = reportName(column) + " below detectable limit";
      // add this to the descriptions of qa issues
      issueDescriptions[msg] = true;  // this will eliminate dups as in the case of turbidity
  }
  // seems to be a normal number so set the precision
  return setPrecision(column, number);
};


const descriptionObjToString = function (obj: Record<string, boolean>): string {
  return Object.keys(obj).join("; ");
}




const fixDateFormat = function (aDate: string): string {

  const shortPattern = /^([0-9]{1,2})\/([0-9]{1,2})\/([0-9][0-9])$/; // example: 6/16/18
  const isoPattern   = /^[1-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/; // example: 2019-06-28

  const shortMatch = aDate.match(shortPattern);
  if (shortMatch) {
    const [, month, day, year] = shortMatch;
    return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
  }
  if (isoPattern.test(aDate)) {
    const [year, month, day] = aDate.split("-");
    return `${month}/${day}/${year.substring(2)}`;
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


// check for a data inconsistency condition that has been observed where the google sheet says
// that no nutrient data was collected, yet a sample was submitted to the lab. Warn about it
// and return. Do not put in a comment.

const checkNutrientSampledFlagVsData = function(sample: Sample, issues: IssueLog): void {

  if (! isEmptyNutrientData(sample) && (sample.NutSampled.toLowerCase() === "no")) {
    issues.warning('nutrient-flag-mismatch',
      `Spreadsheet says no nutrient sample was taken but nutrient data is not empty.`,
      { sampleId: sample.SampleID, date: isoDateFromShortDate(sample.Date) });
  }

};


// This function adds a comment to the msgObj that reports when the nutrient data is empty.
// It reports that there is data pending (not back from the lab) if the nutrient data is empty
// but samples were taken according to the database. If the database says not samples were
// taken, then it reports that.

const addMissingNutrientDataMsg = function(sample: Sample, msgObj: Record<string, boolean>): void {

  if (isEmptyNutrientData(sample)) {
    if (sample.NutSampled.toLowerCase() === "yes") {
      msgObj["nutrient data pending"] = true;
    }
    else if (sample.NutSampled.toLowerCase() === "no") {
      msgObj["nutrient samples not taken"] = true;
    }
    else {
      fatal(`unexpected value for Nut_Sample of "${sample.NutSampled}" for sample ${sample.SampleID}.`);
    }
  }
}

const addOrOverrideQAComments = function(sampleIdToQAComments: Record<string, QAComment>, sample: Sample, msgObj: Record<string, boolean>): void {
  const qaComment = sampleIdToQAComments[sample.SampleID];
  if (qaComment) {  // if the sample id of the sample matches one of the QA custom comments
    if (qaComment['append-or-override'] === 'Append') {
       msgObj[qaComment.comment] = true;
    }
    else if (qaComment['append-or-override'] === 'Override') {
      // remove the keys from the current object, which are any other QA comments automatically generated
       Object.keys(msgObj).forEach(function(key) {
         delete msgObj[key];
       });
       msgObj[qaComment.comment] = true;
    }
    else {
      fatal(`unexpected value for append-or-override of "${qaComment['append-or-override']}" for SampleID ${sample.SampleID} in the Report QA Comments sheet.`);
    }
  }
};

interface ReportContext {
  sites: Sites;
  sampleIdToQAComments: Record<string, QAComment>;
  ignoreNoNutrientSamples: boolean;
  issues: IssueLog;
}

const createReportFromList = function (context: ReportContext, samples: Sample[]): string {

  console.log("In createReport From List");

  const header = [
    "",
    "SampleID",
    "SiteName",
    "Station",
    "Session",
    "Date",
    "Time",
    "Temp",
    "Salinity",
    "DO",
    "DO_sat",
    "pH",
    "Turbidity",
    "TotalN",
    "TotalP",
    "Phosphate",
    "Silicate",
    "NNN",
    "NH4",
    "Lat",
    "Long",
    "QA issues or comments",
  ].join("\t") + "\n";

  let report = header;

  let count = 0;
  for (const sample of samples) {

    // will not be reporting on any empty samples
    if (isEmptyInsituData(sample)) {
      continue;
    }

    // check special case of ignoring empty nutrient data and it is empty.  If so skip this line
    if (context.ignoreNoNutrientSamples && isEmptyNutrientData(sample)) {
      continue;
    }

    ++count;

    const site = getSiteFor(sample.Location, context.sites);
    const issueDescriptions: Record<string, boolean> = {};
    const columns: string[] = [
      String(count),
      sample.SampleID,
      site.long_name,
      sample.Location,
      sample.Session,
      sample.Date,
      sample.Time,
    ];
    for (const column of [...INSITU_COLUMNS, ...NUTRIENT_COLUMNS]) {  // Turbidity is the average turbidity
      columns.push(checkForQAIssues(sample, column, issueDescriptions, context.issues));
    }
    columns.push(setPrecision('Lat', site.lat));
    columns.push(setPrecision('Long', site.lon));

    addMissingNutrientDataMsg(sample, issueDescriptions);

    addOrOverrideQAComments(context.sampleIdToQAComments, sample, issueDescriptions);

    columns.push(descriptionObjToString(issueDescriptions));

    // finish the row
    report += columns.join("\t") + "\n";
  }

  return report;

}

/*  Returns a file path with basename to create the files for each geo area */

const getFilePathForGeoArea = function (config: Config, GeoArea: string): string {
  return path.join(config.directoryForFiles, config.basenameForFiles + `.${GeoArea}-maui.tsv`);
};

/* get the full file path for the file that has data for all the areas */
const getFilePathForAllAreas = function (config: Config): string {
  return path.join(config.directoryForFiles, config.basenameForFiles + ".all-areas.tsv");
};


const writeFile = function (filePath: string, dataToWrite: string): void {

  console.log(`Writing file to ${filePath}`);
  fs.writeFileSync(filePath, dataToWrite);
  console.log("The file was saved to " + filePath);
};


const createReports = function (config: Config, context: ReportContext, sortedSamples: Sample[], samplesByReportRegion: Record<string, Sample[]>): void {

  console.log("In createReports");

  console.log("Creating report for all samples");

  writeFile(getFilePathForAllAreas(config), createReportFromList(context, sortedSamples));

  for (const reportRegion in samplesByReportRegion) {
     console.log("Creating report for report region " + reportRegion);
     writeFile(getFilePathForGeoArea(config, reportRegion), createReportFromList(context, samplesByReportRegion[reportRegion]));
  }
};

const printLookupData = function (sites: Sites, reportConstantsData: string[][], reportQACommentsData: string[][], areaToReportRegion: Record<string, string>): void {

  console.log("In printLookupData");
  console.log("Number of sites: " + Object.keys(sites).length);
  console.log("sites loop:");

  for (const siteCode in sites) {
    console.log(`siteCode : ${siteCode}`);
    console.log(util.inspect(sites[siteCode], false, null));
  }


  console.log("");
  console.log("Report Measurement Names:");
  console.log(util.inspect(reportMeasurementNames, false, null));

  console.log("");
  console.log("Report Precision:");
  console.log(util.inspect(reportPrecision, false, null));


  console.log("");
  console.log("Report Constants Data:");
  console.log(util.inspect(reportConstantsData, false, null));

  console.log("");
  console.log("Report QA Comments Data:");
  console.log(util.inspect(reportQACommentsData, false, null));

  console.log("");
  console.log("Area to Report Region");
  console.log(util.inspect(areaToReportRegion, false, null));
};


// Dates are MM/DD/YY and times are HH:MM, so they compare correctly as strings once
// the date is reordered to YY/MM/DD. Samples without a time sort after those with one.
const sortAscendingByDateAndTime = function(a: Sample, b: Sample): number {

  const dateKey = (sample: Sample) => {
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


const sortSamples = function(samples: Samples): Sample[] {
  // get all the samples in one list to be sorted
  return Object.values(samples).sort(sortAscendingByDateAndTime);
};


const filterSamplesByGeoArea = function(sortedSamples: Sample[], sites: Sites, areaToReportRegion: Record<string, string>, issues: IssueLog): Record<string, Sample[]> {

  const samplesByReportRegion: Record<string, Sample[]> = {};

  // Every sample has to map to a report region. Problems are collected for all of the samples
  // before stopping, so they can all be fixed at once.
  let problemCount = 0;
  const problem = (category: string, message: string, sample: Sample) => {
    ++problemCount;
    issues.error(category, message, { sampleId: sample.SampleID, date: isoDateFromShortDate(sample.Date) });
  };

  for (const sample of sortedSamples) {

    // some convience variables
    const siteCode   = sample.Location;  // the 3 digit code

    const site = sites[siteCode];
    if (! site) {
      problem('region-unknown-site', `site code ${siteCode} is not in the Site Codes sheet (or its row there is incomplete)`, sample);
      continue;
    }

    const area = site.Area;
    if (! area) {
      problem('region-no-area', `site ${siteCode} has no Area in the Site Codes sheet`, sample);
      continue;
    }

    const reportRegion = areaToReportRegion[area]?.toLowerCase();
    if (! reportRegion) {
      problem('region-unknown-area', `area "${area}" of site ${siteCode} has no AREA_TO_REPORT_REGION row in the Report Constants sheet`, sample);
      continue;
    }

    if (reportRegion === "n/a") {
      problem('region-not-reported', `area "${area}" of site ${siteCode} is mapped to report region "N/A". All data should map to a valid report region`, sample);
      continue;
    }

    if ( ! samplesByReportRegion[reportRegion] ) {
      samplesByReportRegion[reportRegion] = [];  // haven't seen this reporting region yet, so make an empty list
    }
    samplesByReportRegion[reportRegion].push(sample);
  }

  if (problemCount > 0) {
    fatal(`${problemCount} samples could not be mapped to a report region. See the region-* errors.`);
  }

  return samplesByReportRegion;
};


const warnAboutUnusedQAComments = function (sampleIdToQAComments: Record<string, QAComment>, samples: Samples, issues: IssueLog): void {
  for (const sampleID in sampleIdToQAComments) {
    if (! samples[sampleID]) {
      issues.warning('qa-comment-unused', `Report QA Comments sheet has a comment for a SampleID that is not in the team sheets`,
        { sampleId: sampleID });
    }
  }
};


const main = function (): void {

  const config = parseArgs();
  const issues = new IssueLog();

  runWithIssueSummary(issues, () => {
    const sites = getSiteData(config, issues);
    const { reportConstantsData, areaToReportRegion } = getReportConstantsData(config);
    const { reportQACommentsData, sampleIdToQAComments } = getReportQACommentsData(config);
    const samples = readSpreadSheetData(config, issues);
    const nutrientSamples = readNutrientData(config, sites, issues);
    updateSamplesWithNutrientData(samples, nutrientSamples, issues);
    warnAboutUnusedQAComments(sampleIdToQAComments, samples, issues);
    printLookupData(sites, reportConstantsData, reportQACommentsData, areaToReportRegion);
    const sortedSamples = sortSamples(samples);
    const samplesByReportRegion = filterSamplesByGeoArea(sortedSamples, sites, areaToReportRegion, issues);
    const context: ReportContext = { sites, sampleIdToQAComments, ignoreNoNutrientSamples: config.ignoreNoNutrientSamples, issues };
    createReports(config, context, sortedSamples, samplesByReportRegion);
  }, "Stopped before all of the report files were written.");
};

main();
