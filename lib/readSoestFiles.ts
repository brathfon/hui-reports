import * as fs from 'fs';
import * as path from 'path';
import { IssueLog, defaultIssueLog, dateFromSampleId } from './issues';
import type { Sites } from './readSiteGdriveSheet';

export interface NutrientSample {
  SampleID: string;   // ex: RNS180605
  Location: string;   // site code, ex: RNS
  Date: string;       // M/D/YY, ex: 6/5/18
  TotalN: string;
  TotalP: string;
  Phosphate: string;
  Silicate: string;
  NNN: string;
  NH4: string;
}

// key is SITECODE-M/D/YY, ex: 'RNS-6/5/18'
export type NutrientSamples = Record<string, NutrientSample>;


// Codes the lab uses for quality control samples rather than sites, ex: LBL260331-N-1.
// These are expected in the lab files and are not reported.
const QC_SAMPLE_CODES: Record<string, string> = {
  LBL: 'lab blank',
  FBL: 'field blank',
};


const isKnownSiteCode = function (siteCode: string, knownSites: Sites): boolean {
  return (knownSites[siteCode]) ? true : false;
}


const getSoestFiles = function(directory: string): string[] {
  //console.log("-- checking directory " + directory);
  return fs.readdirSync(directory)
     .map(file => path.join(directory, file))
     .filter(file =>
                  fs.statSync(file).isFile() &&
                  ((path.basename(file).match(/TNC/) != null) || (path.basename(file).match(/MNMRC/) != null)) &&  // there was a name change
                  (path.basename(file).match(/\.csv$/) != null)
     )
     .sort();
}

// The soest ids are supposed to be in this form RPO170103-N-1, with first 3 chars a known site
// and the next four the data.  The final part can be -N-1 or -N-2, if it a reference.

const isValidID = function(ID: string): boolean {
  return /^\w\w\w\d\d\d\d\d\d-N-(1|2|3)$/.test(ID);
};

// The nutrient files are named like MNMRC_260409_170_W.Maui.csv where the first number is the date
// of the report from the lab. Used to date issues on lines that have no usable sample ID.
const dateFromFilename = function(filename: string): string | undefined {
  const match = filename.match(/_(\d\d)(\d\d)(\d\d)_/);
  return match ? `20${match[1]}-${match[2]}-${match[3]}` : undefined;
};


const readSoestFile = function(soestFile: string, knownSites: Sites, issues: IssueLog): NutrientSample[] {
  const lineList: NutrientSample[] = [];
  const contents = fs.readFileSync(soestFile, 'utf8')
  let foundIDLine = false;  // second header line starts with ID
  const filename = path.basename(soestFile);
  const fileDate = dateFromFilename(filename);

  //console.log("contents: " + contents);
  const lines = contents.split(/\r\n|\r|\n/);  // should handle UNIX and DOS newlines
  lines.forEach( function (line, index) {
        //console.log("line: " + line);
        const lineCount = index + 1;
        const source = `${filename} line ${lineCount}`;
        const pieces = line.split(",");
        // console.log("line " + lineCount + " " + line);
        if (pieces[0] === "ID" || pieces[0] === '"ID"')  {
          foundIDLine = true;
        }
        else if (foundIDLine === true) {
          if (isValidID(pieces[0])) {
            const siteCode   = pieces[0].substring(0,3);
            const sampleDate = pieces[0].substring(3,9);

            const year = sampleDate.substring(0,2);
            // strip off leading zeros
            const mon  = sampleDate.substring(2,4).replace(/^0+/g, '');
            const day  = sampleDate.substring(4).replace(/^0+/g, '');


            const sampleIdExt   = pieces[0].substring(10);
            const sampleID = siteCode + sampleDate;
            // console.log("siteCode: " + siteCode +  " sampleData: " + sampleDate + " sampleIdExt: " + sampleIdExt);
            if (QC_SAMPLE_CODES[siteCode]) {
              issues.info('nutrient-qc-sample', `${QC_SAMPLE_CODES[siteCode]} QC sample ${pieces[0]}, skipping`, { sampleId: sampleID, source });
            }
            else if (sampleIdExt !== "N-1") {
              issues.info('nutrient-replicate', `replicate sample ${pieces[0]}, skipping`, { sampleId: sampleID, source });
            }
            else if (isKnownSiteCode(siteCode, knownSites)) {
               const obj: NutrientSample = {
                 SampleID:  sampleID,
                 Location:  siteCode,
                 Date:      mon + "/" + day + "/" + year,
                 TotalN:    pieces[2],
                 TotalP:    pieces[3],
                 Phosphate: pieces[4],
                 Silicate:  pieces[5],
                 NNN:       pieces[6],
                 NH4:       pieces[7],
               };
               //console.log("siteSample " + util.inspect(obj, false, null));
               // check some basic things on the measurements to make sure that there are not big problems.
               if (parseFloat(obj['NNN']) + parseFloat(obj['NH4']) > parseFloat(obj['TotalN'])) {
                 issues.warning('nutrient-n-sum', `NNN of ${obj['NNN']} + NH4 of ${obj['NH4']} > TotalN of ${obj['TotalN']}`,
                   { sampleId: sampleID, source });
               }
               if (parseFloat(obj['Phosphate'])  > parseFloat(obj['TotalP'])) {
                 issues.warning('nutrient-p-sum', `Phosphate of ${obj['Phosphate']} > TotalP of ${obj['TotalP']}`,
                   { sampleId: sampleID, source });
               }
               lineList.push(obj);
            } // is known site
            else {
              issues.error('nutrient-unknown-site', `found unknown site code "${siteCode}". Line: ${line}`,
                { sampleId: sampleID, source });
            }
          } // valid ID
          else {
            // there are some lines ofter the ID line that are known to be empty so test for them
            if (line !== "" &&
                ! line.match(/^,*,$/) &&  // finds lines like: ',,,,' ',,,,,,,'
                line !== ',,110,16,,,3.5,2') {
              issues.error('nutrient-invalid-id', `found invalid ID "${pieces[0]}". Line: ${line}`,
                { date: dateFromSampleId(pieces[0]) ?? fileDate, source });
            }
          }
        }
        else {
          //console.log("line is not ID line and the ID line has not been found yet");
        }
    });
  return lineList;
};


export const readSoestFiles = function(directory: string, knownSites: Sites, issues: IssueLog = defaultIssueLog): NutrientSamples {
  // this is what is returned: an object whos attributes are the combination of the code
  // and the date that site was collected.
  const locDateHash: NutrientSamples = {};

  const soestFiles = getSoestFiles(directory); // returning a list of paths of the sheet files

  for (const soestFile of soestFiles) {
    console.log("-- reading Soest file: " + path.basename(soestFile));
    const siteSamples = readSoestFile(soestFile, knownSites, issues);  // returns a list of objects, each object a site sample
    for (const siteSample of siteSamples) {
      //console.log("siteSample " + util.inspect(siteSample, false, null));
      const hashID = siteSample.Location + "-" + siteSample.Date;
      locDateHash[hashID] = siteSample;
    }
  }
  //console.log("sites " + util.inspect(locDateHash, false, null));
  return locDateHash;
};
