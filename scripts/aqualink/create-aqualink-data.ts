#!/usr/bin/env -S npx tsx

import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import minimist from 'minimist';

// app-specific requirements
import * as ru from '../../lib/reportUtils';
import * as rsgs from '../../lib/readSiteGdriveSheet';


const argv = minimist(process.argv.slice(2));
const scriptname = path.basename(process.argv[1]);
console.log(`arguments passed in ${util.inspect(argv, false, null)}`);


const printUsage = function () {
  console.log(`Usage: ${scriptname} --wxf <web export file> --sites <site data file> --csvfile <comma separated output file> `);
}


const webExportFile: string | undefined = argv.wxf ?? argv.w;
if (! webExportFile) {
  console.log("ERROR: you must the web export file to use to create the data for aqualink");
  printUsage();
  process.exit(1);
}


const siteFile: string | undefined = argv.sites ?? argv.s;
if (! siteFile) {
  console.log("ERROR: you must the tab separated file that has the site id mappings");
  printUsage();
  process.exit(1);
}


// the usage has always said --csvfile, but the code only accepted --csvFile, so accept both
const csvOutputFile: string | undefined = argv.csvfile ?? argv.csvFile ?? argv.c;
if (! csvOutputFile) {
  console.log("ERROR: you must specify and output file");
  printUsage();
  process.exit(1);
}

/* this is a utility in another branch, so use it if this gets ported over, etc.
*/

const writeStringToFile = function (filePath: string, aString: string): void {

  console.log(`Writing file to ${filePath}`);
  fs.writeFileSync(filePath, aString);
  console.log("The file was saved to " + filePath);
};


/*
// function getSites reads the lookup file to get a mapping from
// the HUI site ID to the aqualink site ID.
// Adds the Hui site to Aqualink site mapping data into the "data" object
// Key is the the Hui site ID, value is an object with the data from
// the sites created at Aqualink, including their site ID for us.
{
  RHL: {
    aqua_link_site_ID: '3400',
    site_name: 'Honolua Bay',
  },
  RON: {
    aqua_link_site_ID: '3401',
    site_name: 'Oneloa Bay',
  },.........

*/
// key is Hui site ID, value is the corresponding aqualink site ID
const getSiteData = function (): Record<string, string> {

  console.log("In getSiteData");


  /*
   readSiteGdriveSheet returns a object with keys as Hui Site ids and
   and a value with is an object with site information from the "Site Codes"
   sheet of the "Hui O Ka Wai Ola Data Entry".

  {
    PFF: {
      Hui_ID: 'PFF',
      siteCode: 'PFF',
      Status: 'Active',
      Area: 'Polanui',
      Site_Name: '505 Front Street',
      long_name: '505 Front Street',
      Station_Name: '',
      Display_Name: '505 Front St',
      DOH_ID: '',
      Surfrider_ID: '',
      Lat: '20.86732',
      lat: '20.86732',
      Long: '-156.67605',
      lon: '-156.67605',
      Aqualink_ID: '3411'
    },
    MAS: {
      Hui_ID: 'MAS',
      siteCode: 'MAS',
      Status: 'Active', ...
  */

  const sites = rsgs.readSiteGdriveSheet(siteFile);

  //console.log("sites " + util.inspect(sites, false, null));

  const huiToAqualinkSitesKV: Record<string, string> = {};

  // loop through the keys of the site data and get the site
  for (const siteDataObj of Object.values(sites)) {
    if (siteDataObj.Aqualink_ID != "") {
      huiToAqualinkSitesKV[siteDataObj.Hui_ID] = siteDataObj.Aqualink_ID;
    }
  }

  //console.log("huiToAqualinkSitesKV " + util.inspect(huiToAqualinkSitesKV, false, null));
  return huiToAqualinkSitesKV;
};

/* function getSamples reads in the samples file that are going to be used
   to create the file to go to Aqualink.  It adds a 2D array of the data
   to the "data" object with key name "samples".  Value is the 2D array

[
  [
    '1',           'RPO160614',
    'Pohaku',      'RPO',
    '1',           '06/14/16',
    '08:03',       '25.7',
    '33.3',        '6.86',
    '102.1',       '8.11',
    '13.90',       '311.07',
    '26.26',       '18.72',
    '1697.47',     '233.11',
    '2.81',        '20.967083',
    '-156.681390', ''
  ],
  [
    '2',                'RKS160614',
    'Kaanapali Shores', 'RKS',
    '1',                '06/14/16',
    '08:37',            '24.9',
    '23.8',             '6.86',
    '100.6',            '8.07',
    '16.80',            '75.08',
    '18.80',            '9.06',
    '1720.37',          '5.65',
    '4.15',             '20.949331',
    '-156.691124',      ''
  ],

*/
const getSamples = function (): string[][] {

  console.log("In getSamples");

  // skip first header line, and blank lines
  return ru.tsvFileToArrayOfArrays(webExportFile, 1).filter(function (sampleArray) { return sampleArray.length > 1});
};



const createAqualinkFile = function (huiToAqualinkSitesKV: Record<string, string>, samples: string[][]): void {

  console.log("In createAqualinkFile");

  const sampleList = [];

  const stationsWithNoAqualinkID = new Set<string>();

  for (const sampleArray of samples) {

    const station = sampleArray[3];


    if (huiToAqualinkSitesKV[station]) {

      const obj = { 'sample_ID' : sampleArray[1],
                    'site_name' : sampleArray[2],
                    'station' : sampleArray[3],  // skip 4, session ID, not needed
                    'the_date' : sampleArray[5],
                    'the_time': sampleArray[6],
                    'temperature' : sampleArray[7],
                    'salinity' : sampleArray[8],
                    'dissolved_oxygen' : sampleArray[9],
                    'dissolved_oxygen_pct' : sampleArray[10],
                    'pH' : sampleArray[11],
                    'turbidity' : sampleArray[12],
                    'total_N' : sampleArray[13],
                    'total_P' : sampleArray[14],
                    'phosphate' : sampleArray[15],
                    'silicate' : sampleArray[16],
                    'NNN' : sampleArray[17],
                    'NH4' : sampleArray[18]
              };

        sampleList.push(obj);

    }
    else {
      stationsWithNoAqualinkID.add(station);
    }
  }

  // log that there are some sites without Aqualink IDs.  This is usually intentional.  For example: non-active sites.
  for (const missingID of stationsWithNoAqualinkID) {
    console.log(`WARNING: station ${missingID} not found in hui to aqualink site lookup.`);
  }

  //console.log("samples objs " + util.inspect(sampleList, false, null));

  const header = ["aqualink_site_id", "Date",	"Time",	"Temp",	"Salinity",	"DO",	"DO_sat",	"pH",	"Turbidity",	"TotalN",	"TotalP",	"Phosphate",	"Silicate",	"NNN",	"NH4"];

  let fileText = header.join(",");
  fileText = fileText.concat("\n");
  let counter = 0;
  sampleList.forEach( function (sampleObj) {
    const sampleArray = [];
    //console.log("sample obj " + util.inspect(sampleObj.station, false, null));
    //console.log("kv object " + util.inspect(data.huiToAqualinkSitesKV[sampleObj.station], false, null));

    sampleArray.push(huiToAqualinkSitesKV[sampleObj.station]);  // first column gets Aqualinks site ID
    sampleArray.push(sampleObj.the_date);
    sampleArray.push(sampleObj.the_time);
    sampleArray.push(sampleObj.temperature);
    sampleArray.push(sampleObj.salinity);
    sampleArray.push(sampleObj.dissolved_oxygen);
    sampleArray.push(sampleObj.dissolved_oxygen_pct);
    sampleArray.push(sampleObj.pH);
    sampleArray.push(sampleObj.turbidity);
    sampleArray.push(sampleObj.total_N);
    sampleArray.push(sampleObj.total_P);
    sampleArray.push(sampleObj.phosphate);
    sampleArray.push(sampleObj.silicate);
    sampleArray.push(sampleObj.NNN);
    sampleArray.push(sampleObj.NH4);

    //console.log("sample array " + util.inspect(sampleArray, false, null));
    fileText = fileText.concat(sampleArray.join(","));
    fileText = fileText.concat("\n");

    ++counter;
  });

  //console.log(`file text : ${fileText} count ${counter}`);
  //
  console.log(`${counter} samples written`);


  writeStringToFile(csvOutputFile, fileText);
};


createAqualinkFile(getSiteData(), getSamples());
