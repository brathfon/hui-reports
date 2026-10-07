
import * as fs from 'fs';
import * as path from 'path';
import * as validator from './validator';
import { IssueLog, defaultIssueLog } from './issues';

// number of columns through 'Campers'. Any columns after that are comments.
const FIRST_COMMENT_COLUMN = 44;

/* one line (site sample) from a team spread sheet */
export interface TeamSheetRow {
  Downloaded: string;
  checkedByQA: string;
  Nut_Sample: string;
  Nut_Dup: string;
  Sed_Sample: string;
  Session: string;
  Team: string;
  Lab: string;
  Sampler: string;
  Sampler2: string;
  Sampler3: string;
  Station: string;
  SampleID: string;
  Location: string;
  SiteName: string;
  Date: string;   // YYYY-MM-DD
  Time: string;   // H:MM or HH:MM, or "null" if the sample was not collected
  '40D#': string;
  '2100Q#': string;
  'pHInst#': string;
  'DOInst#': string;
  'SalInst#': string;
  Moon: string;
  Cloud_1_8: string;
  Rain_1_4: string;
  Wind_dir: string;
  SampleID2: string;
  Temp: string;
  Salinity: string;
  DO: string;
  'DO%': string;
  pH: string;
  Turb1: string;
  Turb2: string;
  Turb3: string;
  'Average Turbidity': string;
  'CV Turbidity': string;
  blank: string;
  Waves: string;
  Wind: string;
  Stream: string;
  Swimmers: string;
  'On Beach': string;
  Campers: string;
  Comments: string;
}

/* returns the lines from the spread sheet in a list, one object per line

The objects look like this:
[ { Nut_Dup: 'no',
    Sed_Sample: 'no',
    Session: '28',
    Team: 'Olowalu',
    Lab: 'LLHS',
    Sampler: 'RN',
    Sampler2: 'MG',
    Sampler3: 'LO',
    Station: 'OPM',
    SampleID: 'OPM171005',
    Location: '2073',
    SiteName: 'Martin Hale',
    ......
*/

const readTeamSheet = function(teamSheetFile: string, issues: IssueLog): TeamSheetRow[] {
  const lineList: TeamSheetRow[] = [];
  const contents = fs.readFileSync(teamSheetFile, 'utf8')
  const filename = path.basename(teamSheetFile);
  //console.log("contents: " + contents);
  const lines = contents.split("\n");
  lines.forEach( function (line, index) {
      //console.log("line: " + line);
      const lineCount = index + 1;
      const source = `${filename} line ${lineCount}`;
      const pieces = line.split("\t");  // file is tab-delimited
      //console.log("line " + lineCount + " line length " + pieces.length);
      if (lineCount <= 3) {  // first three lines are header information
        return;
      }
      // for (j = 0; j < pieces.length; ++j) { console.log(j, pieces[j]); }  // print out all pieces for debug
      if (pieces[0].toLowerCase() != "yes") {  // the Downloaded column
        //console.log(`skipping ${line} because it has not been marked as downloaded`);
        return;  // to skip this iteration, just return from the function being call on each item in the list
      }

      const SampleID = pieces[12];
      if (pieces.length < FIRST_COMMENT_COLUMN) {
        issues.error('sheet-short-row',
          `row has ${pieces.length} columns, expecting at least ${FIRST_COMMENT_COLUMN}. Row skipped.`,
          { sampleId: SampleID, source });
        return;
      }

      const Date = pieces[15];

      // had a problem where spreadsheet was changed when sites were changed and had column shifts that mismatched the
      // stationID and SampleID.  Check here and report it
      const Station = pieces[11];
      const stationFromSampleID = SampleID.substring(0,3);
      //console.log(`STATIONID : ${obj.Station}, ID from SampleID : ${stationFromSampleID}`);
      if (Station !== stationFromSampleID) {
        issues.error('sheet-station-mismatch',
          `Station "${Station}" does not match the station in SampleID "${SampleID}"`,
          { sampleId: SampleID, date: validator.isDate(Date) ? Date : undefined, source });
      }

      if (! validator.isDate(Date)) {
        issues.error('sheet-bad-date', `'${Date}' date is not a correctly formed (YYYY-MM-DD). Row skipped.`,
          { sampleId: SampleID, source });
        return;
      }

      // had a problem where date in the SampleID did not the date field
      const dateFromSampleID = `20${SampleID.substring(3,5)}-${SampleID.substring(5,7)}-${SampleID.substring(7,9)}`;    // ex: RSN180622 -> 2018-06-22
      if (Date !== dateFromSampleID || SampleID.length !== 9) {
        issues.error('sheet-date-mismatch',
          `Date ${Date} does not match the date in SampleID "${SampleID}". Nutrient data will not match up with this sample.`,
          { sampleId: SampleID, date: Date, source });
      }

      let Time = pieces[16];
      if (Time === "") {  // if a site is not sampled due to conditions at the site, etc.  The time will be blank
        issues.info('sheet-blank-time', "time is blank, which may be a uncollected sample, setting to NULL",
          { sampleId: SampleID, date: Date, source });
        Time = "null";
      }
      else if (! validator.isHourMinute(Time)) {
        issues.error('sheet-bad-time', `'${Time}' time is not a correctly formed (HH:MM). Row skipped.`,
          { sampleId: SampleID, date: Date, source });
        return;
      }

      // any remaining columns become comments.  Put them into an array.
      // this allows users of the spread sheet to use multiple columns far right of the sheet
      // as does happen either by accident or on purpose.
      const comments = pieces.slice(FIRST_COMMENT_COLUMN);

      const obj: TeamSheetRow = {
        Downloaded:    pieces[0],  // not going to use this
        checkedByQA:   pieces[1],  // not going to use this
        Nut_Sample:    pieces[2],
        Nut_Dup:       pieces[3],
        Sed_Sample:    pieces[4],
        Session:       pieces[5],
        Team:          pieces[6],
        Lab:           pieces[7],
        Sampler:       pieces[8],
        Sampler2:      pieces[9],
        Sampler3:      pieces[10],
        Station,
        SampleID,
        Location:      pieces[13],
        SiteName:      pieces[14],
        Date,
        Time,
        '40D#':        pieces[17],
        '2100Q#':      pieces[18],
        'pHInst#':     pieces[19],
        'DOInst#':     pieces[20],
        'SalInst#':    pieces[21],
        Moon:          pieces[22],
        Cloud_1_8:     pieces[23],
        Rain_1_4:      pieces[24],
        Wind_dir:      pieces[25],
        SampleID2:     pieces[26],
        Temp:          pieces[27],
        Salinity:      pieces[28],
        DO:            pieces[29],
        'DO%':         pieces[30],
        pH:            pieces[31],
        Turb1:         pieces[32],
        Turb2:         pieces[33],
        Turb3:         pieces[34],
        'Average Turbidity': pieces[35],
        'CV Turbidity':      pieces[36],
        blank:         pieces[37],    // for some reason getting a blank column
        Waves:         pieces[38],
        Wind:          pieces[39],
        Stream:        pieces[40],
        Swimmers:      pieces[41],
        'On Beach':    pieces[42],
        Campers:       pieces[43],
        // join the elements of the comments array into one string.
        Comments:      comments.join(' ').trim(), // remove leading and trailing whitespace, which may reduce some to "". Also removes Microsoft end line ("\r")
      };

      lineList.push(obj);
    });
  return lineList;
};



/* gets the paths to the team sheets */

const getTeamSheets = function(directory: string): string[] {
  //console.log("checking directory " + directory);
  return fs.readdirSync(directory)
     .map(file => path.join(directory, file))
     .filter(file =>
                  fs.statSync(file).isFile() &&
                  (path.basename(file).match(/Team/) != null) &&
                  (path.basename(file).match(/\.tsv$/) != null)
     )
     .sort();
}

// key is a combination of Lab ID and Session, ex: 'NMS:1'. value is a list of the site samples for that session
export type Sessions = Record<string, TeamSheetRow[]>;

/* returns an object of session lists */

export const readTeamSheets = function(directory: string, issues: IssueLog = defaultIssueLog): Sessions {
  const sessions: Sessions = {};
  const teamSheets = getTeamSheets(directory); // returning a list of paths of the sheet files


  for (const teamSheet of teamSheets) {
    //console.log("Team sheet: " + teamSheets[i]);
    const siteSamples = readTeamSheet(teamSheet, issues);  // returns a list of objects, each object a site sample
    for (const siteSample of siteSamples) {
      //console.log("siteSample " + util.inspect(siteSample, false, null));
      // make the key to the list a combination of Lab ID and Session since the labs have their own independent Sessions number
      const session = siteSample.Lab + ":" + siteSample.Session;
      //console.log("session: " + session);
      if (sessions[session] == null) {
        sessions[session] = [];
      }
      sessions[session].push(siteSample);
    }
  }
  return sessions;
};


/*
takes a list of siteSamples and returns the earliest date. This will probably need to come from the sessions
   data sheet some time, but currently not in there.
*/
export const getStartDate = function(siteSamples: TeamSheetRow[]): string {

  let startDate = '9999-99-99';
  for (const siteSample of siteSamples) {
    //console.log("DATE : = " + siteSample['Date']);
    if (siteSample['Date'] < startDate) {
      startDate = siteSample['Date'];
    }
  }
  return startDate;
};


export const getLab = function(siteSamples: TeamSheetRow[]): string | null {

  let lab: string | null = null;
  for (const siteSample of siteSamples) {
    //console.log("LAB : = " + siteSample['Lab']);
    if (! lab ) {
      lab = siteSample['Lab'];
    }
    else {
      if (lab != siteSample['Lab']) {
        console.log("ERROR: expecting all lab values to be the same for this set of samples");
        console.log(`expecting ${lab} but found ${siteSample['Lab']} for sampleID ${siteSample['SampleID']} session ${siteSample['Session']}`);
        console.error("ERROR: expecting all lab values to be the same for this set of samples");
        console.error(`expecting ${lab} but found ${siteSample['Lab']} for sampleID ${siteSample['SampleID']} session ${siteSample['Session']}`);
      }
    }
  }
  return lab;
};
