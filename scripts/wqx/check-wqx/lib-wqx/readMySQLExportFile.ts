import * as fs from 'fs';

// Despite the file name, this reads a web export file (ex: 2023-3rd-quarter.1.all-areas.tsv),
// which used to be dumped from the MySQL database.

// a type rather than an interface so it can be used where a Record<string, string> is expected
export type WebExportSample = {
  SampleID: string;
  SiteName: string;
  Location: string;
  Session: string;
  Date: string;   // MM/DD/YY
  Time: string;
  Temp: string;
  Salinity: string;
  DO: string;
  'DO%': string;
  pH: string;
  Turbidity: string;
  TotalN: string;
  TotalP: string;
  Phosphate: string;
  Silicate: string;
  NNN: string;
  NH4: string;
  Lat: string;
  Long: string;
  QA_Issues: string;
};


// returns an object with keys of SITECODE-MM/DD/YY, ex: 'RNS-06/05/18'
export const readWebExportFile = function(webExportFile: string): Record<string, WebExportSample> {
  const siteSamples: WebExportSample[] = [];
  const locDateHash: Record<string, WebExportSample> = {};

  const contents = fs.readFileSync(webExportFile, 'utf8')
  //console.log("contents: " + contents);
  const lines = contents.split("\n");
  for (let i = 0; i < lines.length; ++i) {
      const lineCount = i + 1;
      const pieces = lines[i].split("\t");
     // console.log("line " + lineCount + " line length " + pieces.length + " : " + lines[i]);
     // for (j = 0; j < pieces.length; ++j) { console.log(j + "\t" + pieces[j]); }
      if ((lineCount > 1) && (pieces.length > 4)){  // skip the header line some short last line
        siteSamples.push({
          SampleID:  pieces[1],
          SiteName:  pieces[2],
          Location:  pieces[3],
          Session:   pieces[4],
          Date:      pieces[5],
          Time:      pieces[6],
          Temp:      pieces[7],
          Salinity:  pieces[8],
          DO:        pieces[9],
          'DO%':     pieces[10],
          pH:        pieces[11],
          Turbidity: pieces[12],
          TotalN:    pieces[13],
          TotalP:    pieces[14],
          Phosphate: pieces[15],
          Silicate:  pieces[16],
          NNN:       pieces[17],
          NH4:       pieces[18],
          Lat:       pieces[19],
          Long:      pieces[20],
          QA_Issues: pieces[21],
        });
      }
  }

  for (const siteSample of siteSamples) {
    //console.log("siteSample " + util.inspect(siteSample, false, null));
    const hashID = siteSample.Location + "-" + siteSample.Date;
    locDateHash[hashID] = siteSample;
  }
  //console.log("sites " + util.inspect(locDateHash, false, null));
  return locDateHash;
};
