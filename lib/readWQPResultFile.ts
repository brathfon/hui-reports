//************************************************************************************************
// This library reads the results file downloaded from the Water Quality Portal (WQP,
// https://www.waterqualitydata.us) with the resultPhysChem data profile, usually named
// resultphyschem.tsv. WQP publishes the data submitted to WQX, so this file holds the same results
// as the Results Detail Export from the WQX web site, and is much faster to get.
// See scripts/wqx/download-wqp-results.sh for how it is downloaded.
//
// The WQP file differs from the WQX web export in a few ways that are smoothed over here so the
// samples returned are the same as readWQXWebResultDetailFile returns:
//   - the column names are different, ex: ActivityIdentifier instead of Activity ID
//   - the activity and monitoring location IDs start with the organization, ex: HUIWAIOLA_WQX-RCB160614:SR:WB:
//   - dates are YYYY-MM-DD instead of MM-DD-YYYY
//************************************************************************************************

import * as fs from 'fs';
import * as log from './logFormatter';
import { addResult } from './readWQXWebResultDetailFile';
import type { WQXResults, WQXSample } from './readWQXWebResultDetailFile';

// key is the name used by addResult, value is the WQP column name
const columnNames: Record<string, string> = {
  Organization_ID: "OrganizationFormalName",
  Monitoring_Location_ID: "MonitoringLocationIdentifier",
  Activity_ID: "ActivityIdentifier",
  Activity_Start_Date: "ActivityStartDate",
  Activity_Type: "ActivityTypeCode",
  Media: "ActivityMediaName",
  Media_Subdivision: "ActivityMediaSubdivisionName",
  Result_UID: "ResultIdentifier",
  Characteristic: "CharacteristicName",
  Fraction: "ResultSampleFractionText",
  Statistic: "StatisticalBaseCode",
  Value: "ResultMeasureValue",
  Unit: "ResultMeasure/MeasureUnitCode",
  Value_Type: "ResultValueTypeName",
  Detection_Condition: "ResultDetectionConditionText",
  Taxon_Name: "SubjectTaxonomicName",
  Status: "ResultStatusIdentifier",
  Last_Changed: "LastUpdated",
};

/**
 * Returns true if the first line of the file looks like a WQP results file rather than a WQX web export.
 */
export const isWQPResultFile = function (file: string): boolean {
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const firstLine = buffer.toString('utf8', 0, bytesRead).split(/\r\n|\r|\n/)[0];
    return firstLine.split("\t").includes("ActivityIdentifier");
  } finally {
    fs.closeSync(fd);
  }
};

// WQP prefixes IDs with the organization ID, ex: HUIWAIOLA_WQX-RCB160614:SR:WB:
const removeOrganizationPrefix = function (id: string): string {
  const dash = id.indexOf("-");
  return dash === -1 ? id : id.slice(dash + 1);
};

// YYYY-MM-DD to MM-DD-YYYY to match the WQX web export
const wqxDate = function (isoDate: string): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[2]}-${match[3]}-${match[1]}` : isoDate;
};

/**
 * Reads a WQP resultphyschem.tsv file and returns the samples it holds, in the same form as
 * readWQXWebResultDetailFile.readWQXWebResultsFile.
 */
export const readWQPResultFile = function (wqpResultFile: string): WQXResults {
  const samples: Record<string, WQXSample> = {};
  const returnData: WQXResults = {
    samples,
    log: [],
    status: 'SUCCESS',
  };
  const logList = returnData.log;

  const lines = fs.readFileSync(wqpResultFile, 'utf8').split(/\r\n|\r|\n/);
  log.info(`${lines.length - 1} lines found in ${wqpResultFile}`, logList);

  const columns = lines[0].split("\t");
  const columnIndices: Record<string, number> = {};
  for (const [key, columnName] of Object.entries(columnNames)) {
    columnIndices[key] = columns.indexOf(columnName);
    if (columnIndices[key] === -1) {
      log.error(`Column ${columnName} not found in the file`, logList);
      returnData.status = 'FAILURE';
    }
  }
  if (returnData.status === 'FAILURE') {
    return returnData;
  }

  let resultsCount = 0;
  let samplesCount = 0;
  let lastChanged = "";
  for (let i = 1; i < lines.length; ++i) {
    if (lines[i].trim() === "") {  // skip blank lines, such as one at the end of the file
      continue;
    }
    const pieces = lines[i].split("\t");
    const row: Record<string, string> = {};
    for (const [key, index] of Object.entries(columnIndices)) {
      row[key] = (pieces[index] ?? "").trim();
    }
    row.Activity_ID = removeOrganizationPrefix(row.Activity_ID);
    row.Monitoring_Location_ID = removeOrganizationPrefix(row.Monitoring_Location_ID);
    row.Activity_Start_Date = wqxDate(row.Activity_Start_Date);
    if (row.Last_Changed > lastChanged) {
      lastChanged = row.Last_Changed;
    }

    ++resultsCount;
    if (addResult(samples, row)) {
      ++samplesCount;
    }
  }
  log.info(`Processed ${resultsCount} results from WQP resulting in ${samplesCount} samples`, logList);
  log.info(`Most recent change to the WQP data: ${lastChanged}`, logList);

  return returnData;
};
