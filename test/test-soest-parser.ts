#!/usr/bin/env -S npx tsx

import * as util from 'util';
import * as path from 'path';
import minimist from 'minimist';

import * as rnf from '../lib/readSoestFiles';
import * as rsgs from '../lib/readSiteGdriveSheet';
import type { NutrientSample } from '../lib/readSoestFiles';

const argv = minimist(process.argv.slice(2));
const scriptname = path.basename(process.argv[1]);
console.log(`arguments passed in ${util.inspect(argv, false, null)}`);


const printUsage = function () {
  console.log(`Usage: ${scriptname} --gsdir <Google sheets directory> --ndir <nutrient data directory>`);
}


const nutrientDirectory: string | undefined = argv.ndir ?? argv.n;
if (! nutrientDirectory) {
  console.log("ERROR: you must specify a directory to find nutrient data csv files");
  printUsage();
  process.exit(1);
}


const googleSheetsDirectory: string | undefined = argv.gsdir ?? argv.g;
if (! googleSheetsDirectory) {
  console.log("ERROR: you must specify a google spread sheet directory for reading the exported data");
  printUsage();
  process.exit(1);
}

// the site information comes from a downloaded sheet of the google drive spreadsheet where the insitu data is recorded
const siteFile = path.join(googleSheetsDirectory, "Hui o ka Wai Ola Data Entry - Site Codes.tsv");


console.log("In getSiteData");
const sites = rsgs.readSiteGdriveSheet(siteFile);

const westMaui  = rnf.readSoestFiles(path.join(nutrientDirectory, 'west-maui'), sites);
const southMaui = rnf.readSoestFiles(path.join(nutrientDirectory, 'south-maui'), sites);

console.log("-- Number of west Maui nutrient samples : " + Object.keys(westMaui).length);
console.log("-- Number of south Maui nutrient samples : " + Object.keys(southMaui).length);

const combined = Object.assign({}, westMaui, southMaui);

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

const nutrientSamples: Record<string, NutrientSample> = {};  // key will be SampleID, value will be object with location information
for (const weirdCode in combined) {
  nutrientSamples[combined[weirdCode].SampleID] = combined[weirdCode];
}
