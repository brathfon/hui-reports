#!/usr/bin/env -S npx tsx

// This script is used to check against web export files and the data dumped down from the EPA WQP, formerly called
// STORET, so you might see some referencs to that.

import * as util from 'util';
import * as path from 'path';
import minimist from 'minimist';

import * as rspc from './lib-wqx/readStoretPhysicalChemical';
import * as rsql from './lib-wqx/readMySQLExportFile';

// a sample from either file: keys are measurement names, values are the measurement
type Sample = Record<string, string>;

const argv = minimist(process.argv.slice(2));
const scriptname = path.basename(process.argv[1]);

console.log(`arguments passed in ${util.inspect(argv, false, null)}`);

const printUsage = function () {
  console.log(`Usage: ${scriptname} --web <web export file ex: 2023-3rd-quarter.1.all-areas.tsv> --rpc <result physical chemical file ex: resultphyschem.tsv>`);
}

if (argv.help || argv.h ) {
  printUsage();
  process.exit();
}

const webExportFile: string | undefined = argv.web ?? argv.w;
if (! webExportFile) {
  console.log("ERROR: you must specify a web export file. ex: 2023-3rd-quarter.1.all-areas.tsv");
  printUsage();
  process.exit(1);
}

const resultPhysChemFile: string | undefined = argv.rpc ?? argv.r;
if (! resultPhysChemFile) {
  console.log("ERROR: you must specify a result physical chemical file from WQP ex: resultphyschem.tsv");
  printUsage();
  process.exit(1);
}


const aSamples: Record<string, Sample> = rsql.readWebExportFile(webExportFile);
const bSamples: Record<string, Sample> = rspc.readStoretFile(resultPhysChemFile);


//console.log("aSamples " + util.inspect(aSamples, false, null));
const numASamples = Object.keys(aSamples).length;
//console.log("bSamples " + util.inspect(bSamples, false, null));
const numBSamples = Object.keys(bSamples).length;

// sometimes list A or B might have blank fields just to show that no samples were taken
const isEmptySample = function(sample: Sample): boolean {
  return ((sample.Temp === '') && (sample.Salinity === '')) ? true : false;
};


// get rid of leading trailing zeros on the numbers so 25.70 matches 25.7. Dates are compared as is.
const stripZeros = function(param: string, value: string): string {
  if (param === "Date") {
    return value;
  }
  return value.replace(/0+$/g, '').replace(/\.+$/g, '').replace(/^0+/g, '');
};


const MEASUREMENTS = ['Temp', 'Salinity', 'DO', 'DO%', 'pH', 'Turbidity', 'TotalN', 'TotalP', 'Phosphate', 'Silicate', 'NNN', 'NH4'];

// Measurements that have a value in A (not blank, QA'ed out or below the detection limit) but are not in B at all.
// Only comparing the params in common would miss these, which is how Lanai nutrient data went missing from WQX.
const measurementsMissingFromB = function(sampleA: Sample, sampleB: Sample): string[] {
  return MEASUREMENTS.filter(param => {
    const aValue = sampleA[param] ?? "";
    return aValue !== "" && aValue.toUpperCase() !== "#N/A" && ! aValue.startsWith("<") && ! (param in sampleB);
  });
};


const diffAB = function(sampleA: Sample, sampleB: Sample): void {

  //console.log("sampleA " + util.inspect(sampleA, false, null));
  //console.log("sampleB " + util.inspect(sampleB, false, null));

  const missingFromB = measurementsMissingFromB(sampleA, sampleB);
  if (missingFromB.length > 0) {
    console.log(`MISSING: ${sampleA.Location} on ${sampleA.Date} has ${missingFromB.join(", ")} in A but not in B`);
  }

  const paramsInCommon = Object.keys(sampleA).filter(param => sampleB[param]);

  //console.log("Number of params in common : " + paramsInCommon.length + " for sample " + sampleA.SampleID);

  const differs = (param: string) => stripZeros(param, sampleA[param]) !== stripZeros(param, sampleB[param]);

  if (paramsInCommon.some(differs)) {
    console.log("------------------ diffs found for " + sampleA.Location + " on " + sampleA.Date + "  -----------------------");
    for (const param of paramsInCommon) {
      if (differs(param)) {
        console.log(param + "\t" + sampleA[param] + "\t" + sampleB[param] + " DIFF");
      }
      else {
        console.log(param + "\t" + sampleA[param] + "\t" + sampleB[param]);
      }
    }
  }
};


// MM/DD/YY or M/D/YY to YY-MM-DD
const fixDate = function(aDate: string): string {
   const [month, day, year] = aDate.split("/");
   return year + "-" + month.padStart(2, "0") + "-" + day.padStart(2, "0");
};

console.log(numASamples + " samples found in group A");
console.log(numBSamples + " samples found in group B");

// these are lists of the keys
const samplesInAOnly: string[] = [];
const samplesInBOnly: string[] = [];
const samplesInCommon: string[] = [];

// first see if there anything in b that is not in a at a high level
for (const siteLocKey in aSamples) {

  const aSample = aSamples[siteLocKey];

  if (bSamples[siteLocKey]) {
    samplesInCommon.push(siteLocKey);
  }
  else {
    samplesInAOnly.push(siteLocKey);
    // don't need to fix the dates on this data
    console.log("A sample " + aSample.Date + " @ " + aSample.Location + " NOT FOUND in B");
  }
}

for (const siteLocKey in bSamples) {

  const bSample = bSamples[siteLocKey];

  // don't need to check about in common since we did that above for A vs B

  if (! aSamples[siteLocKey]) {
    samplesInBOnly.push(siteLocKey);
    // don't need to fix the dates on this data
    console.log("B sample " + bSample.Date + " @ " + bSample.Location + " NOT FOUND in A");
  }
}

console.log("Samples only in A: " + samplesInAOnly.length);
console.log("Samples only in B: " + samplesInBOnly.length);
console.log("Samples in common: " + samplesInCommon.length);

// Now loop through the common files
for (const siteLocKey of samplesInCommon) {

  const aSample = aSamples[siteLocKey];
  const bSample = bSamples[siteLocKey];

  if (isEmptySample(aSample)) {
    console.log("A sample " + fixDate(aSample.Date) + " @ " + aSample.Location + " is empty");
  }
  else if (isEmptySample(bSample)) {
    console.log("B sample " + fixDate(bSample.Date) + " @ " + bSample.Location + " is empty");
  }
  else {
    diffAB(aSample, bSample);
  }

}
