const rp = require("../../lib/reportPrecision");


// converts the intermediate structure of sheets of data into
// something readable  The input and resulting output is structured like:
/*
{
   readingSuccessful: true,
   sheets: [
      {
         source: one-session-baseline-data/google-drive-downloads/Hui o ka Wai Ola Data Entry - Team Kamaole.tsv,
         sheetLines: [
           [yes,yes,yes,no,no,1,Kamaole,NMS,MB,AQ,DH,KWP,KWP171107,,Waipuilani Park,2017-11-07,8:20,1,1,1,1,1,19,0,0,Trades,KWP171107,26.1,33.7,5.47,81.5,8.19,8.31,7.70,8.58,8.20,0.055,,0,1,,0,0,2,],
           [yes,yes,yes,no,no,1,Kamaole,NMS,MB,AQ,DH,KKS,KKS171107,,Kihei South,2017-11-07,9:05,1,1,1,1,1,19,0,0,Trades,KKS171107,26.8,34.7,5.97,90.5,8.22,5.14,5.12,5.25,5.17,0.014,,0,1,,2,8,0,],
           [yes,yes,yes,no,no,1,Kamaole,NMS,MB,AQ,DH,KKP,KKP171107,,Kalama Park,2017-11-07,9:27,1,1,1,1,1,19,0,0,Trades,KKP171107,27.0,34.8,6.26,95.2,8.22,8.88,8.32,8.21,8.47,0.042,,2,1,,1,0,0,Turtles visible in the water],
           [yes,yes,yes,no,no,1,Kamaole,NMS,MB,AQ,DH,KCP,KCP171107,,Cove park,2017-11-07,9:55,1,1,1,1,1,19,0,0,Trades,KCP171107,26.9,34.3,6.24,94.5,8.24,1.31,0.98,1.08,1.12,0.151,,0,1,,20+,1,0,],
           [yes,yes,yes,no,no,1,Kamaole,NMS,MB,AQ,DH,KKO,KKO171107,,Kamaole Beach I,2017-11-07,10:23,1,1,1,1,1,19,0,0,Trades,KKO171107,27.7,35.0,6.44,98.7,8.27,0.97,0.91,1.11,1.00,0.103,,0,0,,20+,20+,0,],
           [yes,yes,yes,no,no,1,Kamaole,NMS,MB,AQ,DH,KKT,KKT171107,,Kamaole Beach III,2017-11-07,10:50,1,1,1,1,1,19,0,0,Trades,KKT171107,28.0,35.6,6.36,98.9,8.26,1.10,1.43,1.22,1.25,0.134,,0,1,,20+,20+,0,]
         ]
      }
      {
         source: one-session-baseline-data/google-drive-downloads/Hui o ka Wai Ola Data Entry - Team Makena.tsv,
         sheet: [
           [yes,yes,yes,no,no,1,Makena,NMS,SF,AW,TW,MML,MML171108,,Makena Landing,2017-11-08,8:30,1,1,1,1,1,20,6,1,Trades,MML171108,26.7,35.2,6.45,97.8,8.26,1.41,1.48,1.44,1.44,0.024,,1,0,,2,0,0,],
           [yes,yes,yes,no,no,1,Makena,NMS,SF,AW,TW,MMB,MMB171108,,Maluaka Beach,2017-11-08,8:52,1,1,1,1,1,20,6,1,Trades,MMB171108,26.9,35.4,6.43,98.1,8.28,0.60,0.61,0.64,0.62,0.034,,1,0,,7,5,0,],

         .......
*/


let convertInsitu2DArrayToText = function(teamSheetsObj, logger) {

  let lines = [];

  lines.push("{");

  lines.push(`   readingSuccessful: ${teamSheetsObj.readingSuccessful},`)
  lines.push("   sheets: [");
  for (let i = 0; i < teamSheetsObj.sheets.length; ++i){
    lines.push("      {");
    let sheetObj = teamSheetsObj.sheets[i];
    lines.push(`         source: ${sheetObj.source},`);
    lines.push(`         sheetLines: [`);

    // loop through the lines of the sheet, each line being an array,
    // and join the elements of that array with a comma as a separator
    // of the elements of the line from that arrays. Since each team
    // sheet is an array of arrays, collect up the rows first and join
    // them with a ",", too.
    let rows = [];
    for (let j = 0; j < sheetObj.sheetLines.length; ++j) {
      let comma = "";
      let sheetLine = sheetObj.sheetLines[j];

      // set precisions for output so diffs are consistent
      sheetLine[27] = rp.setPrecision("temperature", sheetLine[27]);
      sheetLine[28] = rp.setPrecision("salinity", sheetLine[28]);
      sheetLine[29] = rp.setPrecision("dissolved_oxygen", sheetLine[29]);
      sheetLine[30] = rp.setPrecision("dissolved_oxygen_pct", sheetLine[30]);
      sheetLine[31] = rp.setPrecision("ph", sheetLine[31]);
      // turbidity, 3 measurements, average and CV
      sheetLine[32] = rp.setPrecision("turbidity", sheetLine[32]);
      sheetLine[33] = rp.setPrecision("turbidity", sheetLine[33]);
      sheetLine[34] = rp.setPrecision("turbidity", sheetLine[34]);
      sheetLine[35] = rp.setPrecision("turbidity", sheetLine[35]);
      sheetLine[36] = rp.setPrecision("turbidity_cv", sheetLine[36]);


      //console.log(`ITEM 27 => ${sheetLine[27]}`);
      if (j < sheetObj.sheetLines.length - 1) {
        comma = ",";
      }
      lines.push(`           [${sheetLine.join(",")}]${comma}`);
    }

    lines.push(`         ]`);
    lines.push("      }");

  }

  lines.push("   ]");
  lines.push("}");

  return lines.join("\n");

};


exports.convertInsitu2DArrayToText = convertInsitu2DArrayToText;
