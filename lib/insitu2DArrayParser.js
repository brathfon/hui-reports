
var validator = require('./validator.js');

/* Functions for reading 2D Arrays of insitu data and returning objects of
   insitu samples.  The public functions are at the bottom.  Private Functions
   end in _.

/*

parse2DArrays()
Input:

{
   readingSuccessful: true,
   sheet: [
      {
         source: one-session-baseline-data/google-drive-downloads/Hui o ka Wai Ola Data Entry - Team Kamaole.tsv,
         sheetLines: [
           [yes,yes,yes,no,no,1,Kamaole,NMS,MB,AQ,DH,KWP,KWP171107,,Waipuilani Park,2017-11-07,8:20,1,1,1,1,1,19,0,0,Trades,KWP171107,26.1,33.7,5.47,81.5,8.19,8.31,7.70,8.58,8.20,0.055,,0,1,,0,0,2,],
           [yes,yes,yes,no,no,1,Kamaole,NMS,MB,AQ,DH,KKS,KKS171107,,Kihei South,2017-11-07,9:05,1,1,1,1,1,19,0,0,Trades,KKS171107,26.8,34.7,5.97,90.5,8.22,5.14,5.12,5.25,5.17,0.014,,0,1,,2,8,0,],
           ........
         ]
      }
      {
         source: one-session-baseline-data/google-drive-downloads/Hui o ka Wai Ola Data Entry - Team Makena.tsv,
         sheetLines: [ .....
         ]
      }
    ]
}

returns an object with a flag for successful parsing and another attribute recalled
samples, which is an object whose attributes are sample IDs and values are sample objects:

{
  parsingSuccessful: true,
  samples: {
    KWP171107: {
      session: '1',
      lab: 'NMS',
      station: 'KWP',
      sample_ID: 'KWP171107',
      site_name: 'Waipuilani Park',
      the_date: '2017-11-07',
      the_time: '8:20',
      temperature: '26.1',
      salinity: '33.7',
      dissolved_oxygen: '5.47',
      dissolved_oxygen_pct: '81.5',
      pH: '8.19',
      turbidity_1: '8.31',
      turbidity_2: '7.70',
      turbidity_3: '8.58',
      average_turbidity: '8.20',
      comments: ''
    },
    KKS171107: {
      session: '1',
      lab: 'NMS',
      .......
    }
  }
}


 */

var parseInsituSheets = function(sheetsObj, logger) {

  let returnObj = {};
  returnObj['parsingSuccessful'] = false;
  returnObj['samples'] = {};

  //logger.debug(`sheetsObj keys ${Object.keys(sheetsObj)}`);
  //logger.debug(`sheetsObj sheets length ${sheetsObj.sheets.length}`)


  if (sheetsObj.readingSuccessful == true) {

    // each each sheet of the spreadsheet, one for each team
    sheetsObj.sheets.forEach(function(sheet) {
      let arrayOfSamples = parseSheet_(sheet, logger);
      arrayOfSamples.forEach(function (sampleObj) {

         logger.debug(`sample_ID => ${sampleObj.sample_ID}`);

         if (! returnObj.samples[sampleObj.sample_ID]) {
           returnObj.samples[sampleObj.sample_ID] = sampleObj;
         }
         else {
           logger.warn(`${sampleObj.sample_ID} already exists in the list of samples.  It must be be unique.}`)
         }

      });
    });

    returnObj['parsingSuccessful'] = true;

  }
  else
  {
    logger.warn(`2DArrayObj "readingSuccessful is FALSE. Will not parse."`);
  }

  return returnObj;
};

/*
  parseSheet_ parses one sheet of the spreadsheet, which is all the data for
  one team.  input: A sheet object

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

      returns: an array of objects, each object being a sample with the attributes
      being measurements for that sample along with meta data like the lab, session,
      time and date information, etc.

      [
        {
        session: '8',
        lab: 'NMS',
        station: 'NMP',
        sample_ID: 'NMP180222',
        site_name: 'Mai Poina Oe Iau',
        the_date: '2018-02-22',
        the_time: '10:00',
        temperature: '24.7',
        salinity: '34.3',
        dissolved_oxygen: '6.65',
        dissolved_oxygen_pct: '97.1',
        pH: '8.14',
        turbidity_1: '4.62',
        turbidity_2: '4.34',
        turbidity_3: '5.12',
        average_turbidity: '4.69',
        comments: ''
      },
      {
        session: '8',
        lab: 'NMS',
        ......
      }
    ]


 */

var parseSheet_ = function(sheetObj, logger) {

  let returnArray = [];  // array of samples to return

  //logger.debug("In parseSheet_");
  let source = sheetObj.source;  // convenience variable
  logger.info(`Parsing ${source}`);
  sheetObj.sheetLines.forEach(function (row) {

    const expectedNumColumns = 45;

    if (row.length !== expectedNumColumns) {
      logger.warn(`unexpected number of columns: ${row.length}. Expecting ${expectedNumColumns}.`);
      let rowAsString = row.join(', ');
      logger.warn("Line: " + rowAsString);
    }

    let obj = {};
    //obj['Added_to_Main'] =  row[0];  // not going to use this
    //obj['Ver_By_Dana']   =  row[1];  // not going to use this
    //obj['Nut_Sample']    =  row[2];
    //obj['Nut_Dup']       =  row[3];
    //obj['Sed_Sample']    =  row[4];
    obj['session']       =  row[5];
    //obj['Team']          =  row[6];
    obj['lab']           =  row[7];
    //obj['Sampler']       =  row[8];
    //obj['Sampler2']      =  row[9];
    //obj['Sampler3']      =  row[10];
    obj['station']       =  row[11];
    obj['sample_ID']      =  row[12];
    // had a problem where spreadsheet was changed when sites were changed and had column shifts that mismatched the
    // stationID and sample_ID.  Check here and print to stderr
    let stationFromSampleID = obj.sample_ID.substr(0,3);
    //logger.log(`STATIONID : ${obj.Station}, ID from SampleID : ${stationFromSampleID}`);
    if (obj.station !== stationFromSampleID) {
      let rowAsString = row.join(', ');
      logger.warn(`Found stationID inconsistance in row: ${rowAsString}`);
      logger.warn(`stationID : ${obj.station} not equal to ID from sample_ID : ${obj.sample_ID} source: ${source}`);
    }

    //obj['location']      = row[13];  DOH location number, not used
    obj['site_name']      = row[14];

    validator.isDate(row[15]) ? obj['the_date'] = row[15] : logger.warn("'" + row[15] + "' date is not a correctly formed (YYYY-MM-DD)", obj.sample_ID, source);

    // had a problem where date in the SampleID did not the date field
    let dateFromSampleID = `20${obj.sample_ID.substr(3,2)}-${obj.sample_ID.substr(5,2)}-${obj.sample_ID.substr(7,2)}`;    // ex: RSN180622 -> 2018-06-22
    // logger.warn(`DATES ${obj['the_date']} ${dateFromSampleID}`);
    if (obj.the_date !== dateFromSampleID) {
      let rowAsString = row.join(', ');
      logger.warn(`Found Date inconsistancy in row: ${rowAsString}, source: ${source}`);
      logger.warn(`date : ${obj.the_date} not equal to date from SampleID : ${dateFromSampleID}`);
    }


    if (validator.isHourMinute(row[16]) ) {
       obj['the_time']    = row[16];
    }
    else if (row[16] === "") {  // if a site is not sampled due to conditions at the site, etc.  The time will be blank
       logger.warn("'" + row[16] + "' time is blank, which may be a uncollected sample, setting to NULL", obj.sample_ID, source);
       obj['the_time']    = "null";
    }
    else {
       logger.warn("'" + row[16] + "' time is not a correctly formed (HH-MM)", obj.sample_ID, source);
    }
    /* not reporting on the next few things
    obj['40D#']          = row[17];
    obj['2100Q#']        = row[18];
    obj['pHInst#']       = row[19];
    obj['DOInst#']       = row[20];
    obj['SalInst#']      = row[21];
    obj['Moon']          = row[22];
    obj['Cloud_1_8']     = row[23];
    obj['Rain_1_4']      = row[24];
    obj['Wind_dir']      = row[25];
    obj['SampleID2']     = row[26];
    */
    obj['temperature']        = row[27];
    obj['salinity']           = row[28];
    obj['dissolved_oxygen']    = row[29];
    obj['dissolved_oxygen_pct'] = row[30];
    obj['pH']                 = row[31];
    obj['turbidity_1']         = row[32];
    obj['turbidity_2']         = row[33];
    obj['turbidity_3']         = row[34];
    obj['average_turbidity']   = row[35];  // this is recalulated, but should be equal
    /* another block of unused columns
    obj['CV Turbidity']      = row[36];
    obj['blank']      = row[37];    // for some reason getting a blank column
    obj['Waves']      = row[38];
    obj['Wind']       = row[39];
    obj['Stream']     = row[40];
    obj['Swimmers']   = row[41];
    obj['On Beach']   = row[42];
    obj['Campers']    = row[43];
    */
    obj['comments']   = row[44];
    // get rid of the Microsoft end of line char
    obj['comments']   = obj['comments'].replace("\r", "");
    returnArray.push(obj);

  });

  return returnArray;
};


exports.parseInsituSheets = parseInsituSheets;
