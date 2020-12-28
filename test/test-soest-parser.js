#!/usr/bin/env node


"use strict";


const argv = require('minimist')(process.argv.slice(2));
const util  = require('util');
//const fs    = require('fs');
const path  = require('path');

// app-specific requirements
const rnf  = require('../lib/readSoestFiles');
var rsgs   = require('../lib/readSiteGdriveSheet');
//const sp   = require('../lib/SOESTParser');

const scriptname = path.basename(process.argv[1]);
console.dir(`arguments passed in ${argv}`);
console.dir(`arguments passed in ${util.inspect(argv, false, null)}`);


const printUsage = function () {
  console.log(`Usage: ${scriptname} --gsdir <Google sheets directory> --ndir <nutrient data directory`);
}


if (! (argv.n || argv.ndir )) {
  console.log("ERROR: you must specify a directory to find nutrient data csv files");
  printUsage();
  process.exit();
}


if (! (argv.g || argv.gsdir )) {
  console.log("ERROR: you must specify a google spread sheet directory for reading the exported data");
  printUsage();
  process.exit();
}




// this will be passed from function to function to gather results
const data = {};

if (argv.g)     data['googleSheetsDirectory']  = argv.g;
if (argv.gsdir) data['googleSheetsDirectory']  = argv.gsdir;

// the site information comes from a downloaded sheet of the google drive spreadsheet where the insitu data is recorded
data['siteFile'] = data['googleSheetsDirectory'] + '/' + "Hui o ka Wai Ola Data Entry - Site Codes.tsv";

if (argv.n)     data['nutrientDirectory']  = argv.n;
if (argv.ndir)  data['nutrientDirectory']  = argv.ndir;


var getSiteData = function (data, callback) {

  console.log("In getSiteData");
  data['sites'] = rsgs.readSiteGdriveSheet(data.siteFile);

  //console.log("sites " + util.inspect(data.sites, false, null));

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

  console.dir(combined);

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


  getSiteData(data, function() {
    readNutrientData(data, null);
  });
