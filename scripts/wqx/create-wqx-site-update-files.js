#!/usr/bin/env node


// This script reads the site code sheet from gdrive and the csv version of the data in wqx web
// from from the xcel spread sheet "MonitoringLocationsExport".
  

"use strict";

const util  = require('util');
const fs    = require('fs');
const path  = require('path');
var rsgs  = require('../../lib/readSiteGdriveSheet');
var rwwml = require('../../lib/readWQXWebMonitoringLocationsExport.js');

const scriptname = path.basename(process.argv[1]);

const printUsage = function () {
  console.log(`Usage: ${scriptname} <tab delimited site code file> <WQX Web Monitoring Locations csv file> <directory to write report files> <basename for the files>`);
}

if (process.argv.length != 6 ) {
  printUsage();
  process.exit();
}

let gDriveSiteSheet = process.argv[2];
let wqxWebSiteFile  = process.argv[3];
let outputDir       = process.argv[4];  // out files go here
let outputBasename  = process.argv[5];  // out files go here

if (! fs.existsSync(wqxWebSiteFile)) {
  console.error(`${wqxWebSiteFile} does not exist .... exiting`);
  process.exit(1);
}

if (! fs.existsSync(gDriveSiteSheet)) {
  console.error(`${gDriveSiteSheet} does not exist .... exiting`);
  process.exit(1);
}

if (! fs.existsSync(outputDir)) {
  console.error(`${outputDir} does not exist .... exiting`);
  process.exit(1);
}

// This is sort of the global data.  It will be passed from function to function to store temporary results
// It will also have the args in it.
var data = {};
data['wqxWebSiteFile'] = wqxWebSiteFile;
data['gDriveSiteSheet'] = gDriveSiteSheet;

// read the original site data that is used in the database and HUI reports

var getWQXWebSiteData = function (data, callback) {

  console.log("In getWQXWebSiteData");
  data['wQXWebSites'] = rwwml.readWQXWebLocationsCsvFile(data.wqxWebSiteFile);

  console.dir(data.wQXWebSites);

  if (callback) {
    callback();
  }

};


// Read the tab separated data from the Google Sheets for each site

var readSiteGdriveData = function (data, callback) {

  console.log("In readSiteGdriveData");

  data['gDriveSites'] = rsgs.readSiteGdriveSheet(data.gDriveSiteSheet);

  console.dir(data.gDriveSites);

  if (callback) {
    callback();
  }

};

/*

  Find the diffs in the sites.  Only interested in comparing a few of the attributes and
  are using the site_id/Hui_ID is a the key.

  from WQX
  RNS: {
    Organization_ID: 'HUIWAIOLA_WQX',
    Monitoring_Location_ID: 'RNS',
    Monitoring_Location_Name: 'Napili (south end)',
    Monitoring_Location_Type: 'Ocean',
    Latitude: '20.994222',
    Longitude: '-156.667417',
    Last_Changed: '05-23-2017 12:11:17 AM'
  },

   
  from gDrive sheet
  RNS: {
    Hui_ID: 'RNS',
    Status: 'Active',
    Area: 'Ridge to Reef',
    Site_Name: 'Napili',
    Station_Name: 'Napili',
    Display_Name: 'Napili Bay',
    DOH_ID: '723',
    Surfrider_ID: '',
    Lat: '20.994222',
    Long: '-156.667417',
    Dates_Sampled: ''
  },
*/


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


/*
 RKT: {
    Hui_ID: 'RKT',
    siteCode: 'RKT',
    Status: 'Active',
    Area: 'Ridge to Reef',
    Site_Name: 'Kahekili Two',
    long_name: 'Kahekili Two',
    Station_Name: 'Kahekili/Airport 2',
    Display_Name: 'Kahekili Two',
    DOH_ID: '733',
    Surfrider_ID: '',
    Lat: '20.941269',
    lat: '20.941269',
    Long: '-156.692439',
    lon: '-156.692439',
    Dates_Sampled: ''
  }
*/


var gDriveSiteObjToString = function( obj, separator) {

    let siteAsStr = "";
    siteAsStr += obj.Hui_ID + separator;
    siteAsStr += obj.Site_Name + separator;
    siteAsStr += obj.Lat + separator;
    siteAsStr += obj.Long;
    return  siteAsStr;
};

var findDiffs = function (data, callback) {

  console.log("In findDiffs");
   
  //console.dir(data.gDriveSites);
  //console.dir(data.wQXWebSites);

  console.log(`Number of key IDs in WQX:         ${Object.keys(data.wQXWebSites).length}`);
  console.log(`Number of key IDs in gDriveSites: ${Object.keys(data.gDriveSites).length}`);

  let sitesToDelete = [];
  let sitesToAdd    = {};  // key is site code, value is data from gDriveSites hash
  let sitesToUpdate = {};  // key is site code, value is data from gDriveSites hash

  // look for sites only in WQX Web sites - these will be deleted
  for (let wqxSite in data.wQXWebSites) {
    if (! data.gDriveSites[wqxSite]) {
      sitesToDelete.push(wqxSite);
      console.log(`site ${wqxSite} missing from gDrive sites`);
    }
  }

  // look for sites only in gDrive sheet - these will be added
  for (let gDriveSite in data.gDriveSites) {
    if (! data.wQXWebSites[gDriveSite]) {
      let obj = data.gDriveSites[gDriveSite];  // convenience ref
      sitesToAdd[gDriveSite] = obj;
      console.log(`site ${gDriveSite} missing from WQX sites ${obj.Site_Name}`);
    }
  }

  // now compare the common sites by matching IDs and then looking at several attributes
  // these will be updated
  for (let wqxSite in data.wQXWebSites) {
    let wqxObj    = data.wQXWebSites[wqxSite];
    let gDriveObj = data.gDriveSites[wqxSite];

    if (gDriveObj != null) {

      // if any of these don't match, add this site to the key-value array
      if (wqxObj.Monitoring_Location_Name != gDriveObj.Site_Name) {
         console.log(`${wqxSite} names do not match. WQX: ${wqxObj.Monitoring_Location_Name} gDrive: ${gDriveObj.Site_Name}`);
         sitesToUpdate[wqxSite] = gDriveObj;
      }

      if (wqxObj.Latitude != gDriveObj.Lat) {
         console.log(`${wqxSite} latitudes do not match. WQX: ${wqxObj.Latitude} gDrive: ${gDriveObj.Lat}`);
         sitesToUpdate[wqxSite] = gDriveObj;
      }

      if (wqxObj.Longitude != gDriveObj.Long) {
         console.log(`${wqxSite} longitudes do not match. WQX: ${wqxObj.Longitude} gDrive: ${gDriveObj.Long}`);
         sitesToUpdate[wqxSite] = gDriveObj;
      }
    }
  }


  let header = "Monitoring Location ID,Monitoring Location Name,Monitoring Location Latitude,Monitoring Location Longitude\n";
  
  // create the delete file
  // put the data into a string with returns in between the site codes and write them to a file
  writeFile(outputDir + '/' + outputBasename + '-delete-sites.csv', "Monitoring Location ID\n" + sitesToDelete.join("\n") + "\n");
  
  // write the sites to add file.
  let sitesToAddStr = header;
  let separator = ",";
  for (let siteCode in sitesToAdd) {
    sitesToAddStr += gDriveSiteObjToString(sitesToAdd[siteCode], separator);
    sitesToAddStr += "\n";
    
  }
  writeFile(outputDir + '/' + outputBasename + '-add-sites.csv', sitesToAddStr);


  // write the sites to update file.
  let sitesToUpdateStr = header;
  for (let siteCode in sitesToUpdate) {
    sitesToUpdateStr += gDriveSiteObjToString(sitesToUpdate[siteCode], separator);
    sitesToUpdateStr += "\n";
    
  }
  writeFile(outputDir + '/' + outputBasename + '-update-sites.csv', sitesToUpdateStr);



  if (callback) {
    callback();
  }

};


// this is the main

getWQXWebSiteData(data, function () {
  readSiteGdriveData(data, function () {
    findDiffs(data, null);
  });
});

