#!/usr/bin/env node


"use strict";


const argv = require('minimist')(process.argv.slice(2));
const util  = require('util');
const path  = require('path');

// app-specific requirements
const ifr  = require('../lib/insituFileTo2DArrayReader');
const cll  = require('../lib/commandLineLogger');
const i2dp = require('../lib/insitu2DArrayParser');
const fw   = require('../lib/fileWriter');


// libraries only for testing
//const ifw  = require('./testlib/insitu2DArrayFileWriter');
const ia2t = require('./testlib/insitu2DArrayToText');
const is2t = require('./testlib/insituSamplesToText');

const scriptname = path.basename(process.argv[1]);
console.dir(`arguments passed in ${argv}`);
console.dir(`arguments passed in ${util.inspect(argv, false, null)}`);


const printUsage = function () {
  console.error(`Usage: ${scriptname} --idir <insitu file directory --odir <output directory>`);
}


if (! (argv.i || argv.idir )) {
  console.error("ERROR: you must specify a directory to find insitu data tsv files");
  printUsage();
  process.exit(1);
}

if (! (argv.o || argv.odir )) {
  console.error("ERROR: you must specify a directory to write out file");
  printUsage();
  process.exit(1);
}

if (! (argv.b || argv.bname )) {
  console.log("ERROR: you must specify a basename to write the report files");
  printUsage();
  process.exit();
}


// this will be passed from function to function to gather results
const data = {};

if (argv.i)     data['insituFileDirectory']  = argv.i;
if (argv.idir)  data['insituFileDirectory']  = argv.idir;

if (argv.o)     data['outputDirectory']  = argv.o;
if (argv.odir)  data['outputDirectory']  = argv.odir;

if (argv.b)     data['basenameForFiles']  = argv.b;
if (argv.bname) data['basenameForFiles']  = argv.bname;


var readInsituData = function (data, callback) {

  const logger = cll.CommandLineLogger();
  logger.setPrintDebug(true);

  var sheets = ifr.readTeamSheets(data.insituFileDirectory, logger);
  logger.info("sheets  " + util.inspect(sheets, false, null));

  var sheetsAsText = ia2t.convertInsitu2DArrayToText(sheets, logger);
  //logger.info("sheets as text  " + sheetsAsText);

  let teamSheetsFileFullPath = path.join(data.outputDirectory, `${data.basenameForFiles}.teamSheets.txt`);

  logger.info(`Full path to team sheets file ${teamSheetsFileFullPath}`);


  fw.writeStringToFile(teamSheetsFileFullPath, sheetsAsText, logger);

  // continue on and test the insitu parser

  let sampleObjs = i2dp.parseInsituSheets(sheets, logger);

  logger.info("insitu samples  " + util.inspect(sampleObjs, false, null));

  let insituSamplesAsText = is2t.convertSamplesToText(sampleObjs);

  logger.debug(`insituSamplesAsText ${insituSamplesAsText}`);

  let insituSamplesFileFullPath = path.join(data.outputDirectory, `${data.basenameForFiles}.insituSamples.txt`);

  logger.info(`Full path to insitu samples file ${insituSamplesFileFullPath}`);

  // will create a testlib lib that changes the sheets in-memory structure into
  // a UNIX text file.  Should work for both GAS and command line
  // this will be sent to writeTeamSheets

  fw.writeStringToFile(insituSamplesFileFullPath, insituSamplesAsText, logger);



/*
  //logger.setAddSQLComment(false);
  //logger.setPrintInfo(false);
  //console.dir(logger);
  //logger.info("LOG Number of west Maui nutrient samples : " + Object.keys(westMaui).length);
  //logger.info("Number of west Maui nutrient samples : " + Object.keys(westMaui).length);
  //logger.info("Number of south Maui nutrient samples : " + Object.keys(southMaui).length);

  let combined = Object.assign({}, westMaui, southMaui);

  logger.info("Combined : " + Object.keys(combined).length);

  // can't really use the logger.info here, just prints [object Object]
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

  //logger.info("nutrient  " + util.inspect(data.nutrientSamples, false, null));
*/

  if (callback) {
    callback();
  }
};

// main

readInsituData(data, null);
