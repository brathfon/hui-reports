/**
  This library provides functions to parse the information stored in the Google
  sheet "Report Constants" that are used for organizing and formating the reports.
  NOTE: the functions expect any header rows not to be included.  That is the
  responsiblity of caller.
*/


/**
 * const getAreaToReportRegion - parses a 2D array representation of the data
 * from the "Report Constants" sheet and converts it into the object with
 * attribute keys that represent a region of the island and the value is which lab
 * is associated with the sites in this region.
 *
 * @param  {2D array of strings} reportConstantsArrayOfArrays rows and columns of table as 2D array
 * @return {object}                                           key-value pairs to match the area to a reporting region
 *
 * example reportConstantsArrayOfArrays param :
 [
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

 example of return object:

 {
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

  let returnKV = {}; // key value pair where area is key, value is report region

  for (let row = 0; row < reportConstantsArrayOfArrays.length; ++row) {
    let column = reportConstantsArrayOfArrays[row];
    if (column[0] == "AREA_TO_REPORT_REGION") {
      returnKV[column[1]] = column[2];
    }
  }

  return returnKV;
};

exports.getAreaToReportRegion = getAreaToReportRegion;
