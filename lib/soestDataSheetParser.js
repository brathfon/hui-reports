


// The soest ids are supposed to be in this form RPO170103-N-1, with first 3 chars a known site
// and the next four the data.  The final part can be -N-1 or -N-2 or -N-3, if it a reference.

const isValidID_ = function(ID) {
  return ID.match(/^\w\w\w\d\d\d\d\d\d-N-(1|2|3)$/);
};

const isNutrientDataRow_ = function (row) {
  if (row[0] == "") return false;
  if (row[1] == "") return false;
  if (row[2] == "") return false;
  if (row[3] == "") return false;
  if (row[4] == "") return false;
  if (row[5] == "") return false;
  if (row[6] == "") return false;
  if (row[7] == "") return false;
  return true;
};


const parseSoestSheet = function(sheetData, filename, logger) {
  let nutrientDataObjsList = [];
  let rowCount = 0;
  let foundIDrow = false; // second header row starts with ID
  let siteCode = null;
  let sampleDate = null;
  let year = null;
  let mon = null;
  let day = null;

  sheetData.forEach(function(row) {
    ++rowCount;
    // logger.debug("row " + rowCount + " " + row);
    //logger.debug("row " + rowCount + " row length " + row.length);

    // The row right above the actual data on the page has "ID" in the
    // cell in column 1. When this row is found, set the foundIDrow
    // to true and continue the loop to the next row, which is data.
    if (row[0] === "ID") {
      foundIDrow = true;
    } else if (foundIDrow === true) {
      if (isNutrientDataRow_(row)) {
        if (isValidID_(row[0])) {
          siteCode = row[0].substring(0, 3);
          sampleDate = row[0].substring(3, 9);

          year = sampleDate.substring(0, 2);
          mon = sampleDate.substring(2, 4);
          day = sampleDate.substring(4);

          // strip off leading zeros
          mon = mon.replace(/^0+/g, '');
          day = day.replace(/^0+/g, '');
          //mon = mon.replace(/0+$/g, '').replace(/\.+$/g, '').replace(/^0+/g, '');


          sampleIdExt = row[0].substring(10);
          // logger.debug("siteCode: " + siteCode +  " sampleDate: " + sampleDate + " sampleIdExt: " + sampleIdExt);
          if (sampleIdExt !== "N-1") {
            logger.info("-- replicate sample, skipping. siteCode: " + siteCode + " sampleDate: " + sampleDate + " sampleIdExt: " + sampleIdExt);
          } else {
            obj = {};
            obj['SampleID'] = siteCode + sampleDate;
            obj['Location'] = siteCode;
            obj['Date'] = mon + "/" + day + "/" + year; // i sthis really needed with the ID, too?
            obj['TotalN'] = row[2];
            obj['TotalP'] = row[3];
            obj['Phosphate'] = row[4];
            obj['Silicate'] = row[5];
            obj['NNN'] = row[6];
            obj['NH4'] = row[7];
            // check some basic things on the measurements to make sure that there are not big problems.
            if (parseFloat(obj['NNN']) + parseFloat(obj['NH4']) > parseFloat(obj['TotalN'])) {
              logger.warn(`NNN of ${obj['NNN']} + NH4 of ${obj['NH4']} > TotalN of ${obj['TotalN']} from row ${row}`);
            }
            if (parseFloat(obj['Phosphate']) > parseFloat(obj['TotalP'])) {
              logger.warn(`Phosphate of ${obj['Phosphate']} > TotalP of ${obj['TotalP']} from row ${row}`);
            }
            nutrientDataObjsList.push(obj);
          }
        } // is valid ID
        else {
          // GOING TO HAVE TO HANDLE THIS DIFFERENTLY
          // there are some rows after the ID row that are known to be empty so test for them
          //if (row !== "" &&
          //    ! row.match(/^,*,$/) &&  // finds rows like: ',,,,' ',,,,,,,'
          //    row !== ',,110,16,,,3.5,2') {
          logger.error(`******************** in ${filename} row ${rowCount} **********************`);
          logger.error(`found invalid ID ${row[0]} row -> |${row}|`);
          //}
        }
      } // is nutrient data row
    } // found ID row
  });
  return nutrientDataObjsList;
};

// can this exist and not bother cause an error in Apps Script Land
// No.  But it can be commented out
module.exports = {
  parseSoestSheet
};
