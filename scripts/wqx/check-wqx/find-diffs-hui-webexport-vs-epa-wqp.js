#!/usr/bin/env node

// This script is used to check against web export files and the data dumped down from the EPA WQP, formerly called
// STORET, so you might see some referencs to that.

"use strict";

const util  = require('util');
const path  = require('path');
const argv  = require('minimist')(process.argv.slice(2));


const rspc  = require('./lib-wqx/readStoretPhysicalChemical');
const rsql  = require('./lib-wqx/readMySQLExportFile');

const scriptname = path.basename(process.argv[1]);

console.dir(`arguments passed in ${util.inspect(argv, false, null)}`);

const printUsage = function () {
  console.log(`Usage: ${scriptname} --web <web export file ex: 2023-3rd-quarter.1.all-areas.tsv> --rpc <result physical chemical file ex: resultphyschem.tsv>`);
}

if (argv.help || argv.h ) {
  printUsage();
  process.exit();
}

if (! (argv.w || argv.web )) {
  console.log("ERROR: you must specify a web export file. ex: 2023-3rd-quarter.1.all-areas.tsv");
  printUsage();
  process.exit();
}


if (! (argv.r || argv.rpc )) {
  console.log("ERROR: you must specify a result physical chemical file from WQP ex: resultphyschem.tsv");
  printUsage();
  process.exit();
}

var webExportFile = "";
if (argv.w)     webExportFile  = argv.w;
if (argv.web)   webExportFile  = argv.web;


var resultPhysChemFile = "";
if (argv.r)     resultPhysChemFile  = argv.r;
if (argv.rpc)   resultPhysChemFile  = argv.rpc;



var siteLocKey = "";


var aSamples = rsql.readWebExportFile(webExportFile);
var bSamples = rspc.readStoretFile(resultPhysChemFile);


//console.log("aSamples " + util.inspect(aSamples, false, null));
var numASamples = Object.keys(aSamples).length;
//console.log("bSamples " + util.inspect(bSamples, false, null));
var numBSamples = Object.keys(bSamples).length;

var sample = null;
var i      = 0;

// sometimes list A or B might have blank fields just to show that no samples were taken
var isEmptySample = function(sample) {
  return ((sample.Temp === '') && (sample.Salinity === '')) ? true : false;
};


var diffAB = function(sampleA, sampleB) {

  //console.log("sampleA " + util.inspect(sampleA, false, null));
  //console.log("sampleB " + util.inspect(sampleB, false, null));

  var diffsFound = false;
  var paramsInCommon = [];
  var aValue = null;
  var bValue = null;

  var aValueStripped = null;
  var bValueStripped = null;

  var i = 0;
  var theLocation
  var theDate;
  var p;
  var param = null;

  for (param in sampleA) {
    if (sampleB[param]) {
      paramsInCommon.push(param);
    }
  }

  //console.log("Number of params in common : " + paramsInCommon.length + " for sample " + sampleA.SampleID);

  //console.log("common params " + util.inspect(paramsInCommon, false, null));

  for (p = 0; p < paramsInCommon.length; ++p) {


    param = paramsInCommon[p];

    aValue = sampleA[param];
    bValue = sampleB[param];

    //console.log("param : " + param + " bValue " + bValue);

    // get rid of leading trailing zeros on the numbers
    if (param !== "Date" ) {
      aValue = aValue.replace(/0+$/g, '').replace(/\.+$/g, '').replace(/^0+/g, '');
      bValue = bValue.replace(/0+$/g, '').replace(/\.+$/g, '').replace(/^0+/g, '');
    }

    //if ((aValue !== bValue) && (param !== "SiteName")) {   // DANGER: not comparing SiteName, but may later
    if ((aValue !== bValue)) {   // DANGER: not comparing SiteName, but may later
      //console.log("found a diff for param " + param);
      diffsFound = true;
    }
  }

  //console.log("common params " + util.inspect(paramsInCommon, false, null));
  //console.log("diffs found " + diffsFound);

  if (diffsFound === true) {
    theLocation = sampleA.Location;
    theDate = sampleA.Date;
    console.log("------------------ diffs found for " + theLocation + " on " + theDate + "  -----------------------");
    for (i = 0; i < paramsInCommon.length; ++i) {
      param = paramsInCommon[i];
      aValue = sampleA[param];
      bValue = sampleB[param];
      // get rid of leading trailing zeros on the numbers
      if (param !== "Date" ) {
        aValueStripped = aValue.replace(/0+$/g, '').replace(/\.+$/g, '').replace(/^0+/g, '');
        bValueStripped = bValue.replace(/0+$/g, '').replace(/\.+$/g, '').replace(/^0+/g, '');
      }
      //console.log("comparing param " + param + " with values " + aValue + " and " + bValue);
      //if ((aValueStripped !== bValueStripped) && (param !== "SiteName")){
      if (aValueStripped !== bValueStripped){
        console.log(param + "\t" + aValue + "\t" + bValue + " DIFF");
      }
      else {
        console.log(param + "\t" + aValue + "\t" + bValue);
      }
    }
  }
};


var fixDate = function(aDate) {
   var parts = aDate.split("/");
   var year = parts[2];
   var day = parts[1];
   var month = parts[0];
   if (day < 10) {
     day = "0" + day;
   }
   if (month < 10) {
     month = "0" + month;
   }
   return year + "-" + month + "-" + day;
};

console.log(numASamples + " samples found in group A");
console.log(numBSamples + " samples found in group B");

// these are lists of the keys
var samplesInAOnly = [];
var samplesInBOnly = [];
var samplesInCommon = [];
var aSample = null;
var bSample = null;

// first see if there anything in b that is not in a at a high level
for (siteLocKey in aSamples) {

  aSample = aSamples[siteLocKey];

  if (bSamples[siteLocKey]) {
    samplesInCommon.push(siteLocKey);
  }
  else {
    samplesInAOnly.push(siteLocKey);
    // don't need to fix the dates on this data
    //console.log("A sample " + fixDate(aSample.Date) + " @ " + aSample.Location + " NOT FOUND in B");
    console.log("A sample " + aSample.Date + " @ " + aSample.Location + " NOT FOUND in B");
  }
}

for (siteLocKey in bSamples) {

  bSample = bSamples[siteLocKey];

  // don't need to check about in common since we did that above for A vs B

  if (! aSamples[siteLocKey]) {
    //console.log("B sample " + siteLocKey + " NOT FOUND in A");
    samplesInBOnly.push(siteLocKey);
    // don't need to fix the dates on this data
    //console.log("B sample " + fixDate(bSample.Date) + " @ " + bSample.Location + " NOT FOUND in A");
    console.log("B sample " + bSample.Date + " @ " + bSample.Location + " NOT FOUND in A");
  }
}

console.log("Samples only in A: " + samplesInAOnly.length);
console.log("Samples only in B: " + samplesInBOnly.length);
console.log("Samples in common: " + samplesInCommon.length);

// Now loop through the common files
for (i = 0; i < samplesInCommon.length; ++i)
{

  siteLocKey = samplesInCommon[i];
  aSample = aSamples[siteLocKey];
  bSample = bSamples[siteLocKey];

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
