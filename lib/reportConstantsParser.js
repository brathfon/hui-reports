/**
  This group of functions is used to extract the report constants from a 2-dimensional array
  of information, probably from a spreadsheet.
*/


/**

Looks through an array of arrays for this kind of data

reportConstantsData [
  [ 'See comment', 'Area', 'Report Region' ],
  [ 'AREA_TO_REPORT_REGION', 'Hāna', 'N/A' ],
  [ 'AREA_TO_REPORT_REGION', 'Kīhei', 'South' ],
  [ 'AREA_TO_REPORT_REGION', 'Māʻalaea', 'South' ],
  [ 'AREA_TO_REPORT_REGION', 'Olowalu to Pali', 'West' ],
  [ 'AREA_TO_REPORT_REGION', 'Polanui', 'West' ],
  [ 'AREA_TO_REPORT_REGION', 'Pā‘ia', 'N/A' ],
  [ 'AREA_TO_REPORT_REGION', 'Ridge to Reef', 'West' ],
  [ 'AREA_TO_REPORT_REGION', 'Waihe‘e-Waiehu', 'South' ],
  [ 'AREA_TO_REPORT_REGION', 'Wailea-Mākena', 'South' ]
]

and returns an object with key-value pairst to match the area to a reporting region

areaToReportRegion {
  'Hāna': 'N/A',
  'Kīhei': 'South',
  'Māʻalaea': 'South',
  'Olowalu to Pali': 'West',
  Polanui: 'West',
  'Pā‘ia': 'N/A',
  'Ridge to Reef': 'West',
  'Waihe‘e-Waiehu': 'South',
  'Wailea-Mākena': 'South'
}

*/

const getAreaToReportRegion = function(reportConstantsArrayOfArrays) {

  let returnKV = {}; // key value pair where area is key, value region

  for (let row = 0; row < reportConstantsArrayOfArrays.length; ++row) {
    let column = reportConstantsArrayOfArrays[row];
    if (column[0] == "AREA_TO_REPORT_REGION") {
      returnKV[column[1]] = column[2];
    }
  }

  return returnKV;
};



exports.getAreaToReportRegion = getAreaToReportRegion;
