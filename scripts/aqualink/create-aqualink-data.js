#!/usr/bin/env node


"use strict";


const argv = require('minimist')(process.argv.slice(2));
const util  = require('util');
const fs    = require('fs');
const path  = require('path');

// app-specific requirements
const ru = require('../../lib/reportUtils');

const scriptname = path.basename(process.argv[1]);
console.dir(`arguments passed in ${argv}`);
console.dir(`arguments passed in ${util.inspect(argv, false, null)}`);


const printUsage = function () {
  console.log(`Usage: ${scriptname} --wxf <web export file> --sites <site data file> --csvfile <comma separated output file> `);
}


if (! (argv.w || argv.wxf )) {
  console.log("ERROR: you must the web export file to use to create the data for aqualink");
  printUsage();
  process.exit();
}


if (! (argv.s || argv.sites )) {
  console.log("ERROR: you must the tab separated file that has the site id mappings");
  printUsage();
  process.exit();
}


if (! (argv.c || argv.csvFile )) {
  console.log("ERROR: you must specify and output file");
  printUsage();
  process.exit();
}


// this will be passed from function to function to gather results
const data = {};

if (argv.w)     data['webExportFile']  = argv.w;
if (argv.wxf)   data['webExportFile']  = argv.wxf;

if (argv.s)     data['siteFile']  = argv.s;
if (argv.sites)  data['siteFile']  = argv.sites;

if (argv.c)     data['csvOutputFile']  = argv.c;
if (argv.csvFile)  data['csvOutputFile']  = argv.csvFile;

/* this is a utility in another branch, so use it if this gets ported over, etc.
*/

const writeStringToFile = function (filePath, aString) {

  console.log(`Writing file to ${filePath}`);

  try {
    fs.writeFileSync(filePath, aString);
    console.log("The file was saved to " + filePath);
  } catch (err){
    console.error(`problem writing ${filePath}`);
    console.error(err);
  }
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
    point_location: 'POINT(-156.6384 21.0135)'
  },
  RON: {
    aqua_link_site_ID: '3401',
    site_name: 'Oneloa Bay',
    point_location: 'POINT(-156.659 21.00406)'
  },.........

*/
const getSiteData = function (data, callback) {

  console.log("In getSiteData");
/* Get the site data in the form of:
  [
    [ 'RHL', '3400', 'Honolua Bay', 'POINT(-156.6384 21.0135)' ],
    [ 'RON', '3401', 'Oneloa Bay', 'POINT(-156.659 21.00406)' ],
    ....
  ]
  */

  const sites2DArray = ru.tsvFileToArrayOfArrays(data.siteFile, 1);  // skip firt header line
  console.log("sites " + util.inspect(sites2DArray, false, null));

  // loop through the array of arrays and make a hash were to key is the hui site ID
  // and the value and object with the aqualink site id and other data from aqualink.
  data["sitesKV"] = {};  // key is Hui site ID, value is object with site data from aqualink
  // the most important being their ID for the sight.
  //
  for (let i = 0; i < sites2DArray.length; ++i){

    const huiSiteID = sites2DArray[i][0];
    const aqualinkSiteID = sites2DArray[i][1];
    const siteName = sites2DArray[i][2];   // our site name, but probably the DOH one when available
    const pointLocation = sites2DArray[i][3];

    const value = {'aqualink_site_ID': aqualinkSiteID,
                   'site_name': siteName,
                   'point_location': pointLocation
                  };

    data["sitesKV"][huiSiteID] = value;

  }

  console.log("sitesKV " + util.inspect(data['sitesKV'], false, null));


  if (callback) {
    callback();
  }

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
const getSamples = function (data, callback) {

  console.log("In getSamples");

  //data['samples'] = ru.tsvFileToArrayOfArrays(data.webExportFile, 1);  // skip firt header line
  data['samples'] = ru.tsvFileToArrayOfArrays(data.webExportFile, 1).filter(function (sampleArray) { return sampleArray.length > 1});  // skip firt header line

  //console.log("samples " + util.inspect(data.samples, false, null));

  if (callback) {
    callback();
  }


};



const createAqualinkFile = function (data, callback) {

  console.log("In createAqualinkFile");

  let sampleList = [];

  for (let i = 0; i < data.samples.length; ++i) {

    let sampleArray = data.samples[i];

    const station = sampleArray[3];


    if (data.sitesKV[station]) {

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
      console.error(`WARNING: station ${station} not found in hui to aqualink site lookup.`);
    }
  }

  //console.log("samples objs " + util.inspect(sampleList, false, null));

  const header = ["aqualink_site_id", "Date",	"Time",	"Temp",	"Salinity",	"DO",	"DO_sat",	"pH",	"Turbidity",	"TotalN",	"TotalP",	"Phosphate",	"Silicate",	"NNN",	"NH4"];

  let fileText = header.join(",");
  fileText = fileText.concat("\n");
  let counter = 0;
  sampleList.forEach( function (sampleObj) {
    let sampleArray = [];
    //console.log("sample obj " + util.inspect(sampleObj.station, false, null));
    //console.log("kv object " + util.inspect(data.sitesKV[sampleObj.station], false, null));

    sampleArray.push(data.sitesKV[sampleObj.station]['aqualink_site_ID']);  // first column gets Aqualinks site ID
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


  writeStringToFile(data.csvOutputFile, fileText);


  if (callback) {
    callback();
  }


};


  getSiteData(data, function() {
    getSamples(data, function() {
      createAqualinkFile(data, null);
    });
  });
