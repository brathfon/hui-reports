

// this is how many significate digits should be printed in the report
const reportPrecision = {};

reportPrecision['temperature']      = 1;
reportPrecision['salinity']         = 1;
reportPrecision['dissolved_oxygen'] = 2;
reportPrecision['dissolved_oxygen_pct'] = 1;
reportPrecision['ph']        = 2;
reportPrecision['turbidity'] = 2;
reportPrecision['turbidity_cv'] = 3;  // calculated in the spreadsheet but not used in reports

reportPrecision['total_nitrogen']    = 2;
reportPrecision['total_phosphorous'] = 2;
reportPrecision['phosphate'] = 2;
reportPrecision['silicate']  = 2;
reportPrecision['nitrates']  = 2;
reportPrecision['ammonia']   = 2;

reportPrecision['latitude']  = 6;
reportPrecision['longitude'] = 6;

var getPrecisionForMeasurement = function (column) {
  return reportPrecision[column];
};



var formatSampleWithSigFigs_ = function(theSample, numSigFigs) {

  var newSample = "";
  if ((theSample !== null) && (theSample !== undefined) && theSample !== "") {
    newSample = parseFloat(theSample).toFixed(numSigFigs);
  } else {
    newSample = "";
  }
  return newSample;
};

var setPrecision = function(attribute, value) {
  return formatSampleWithSigFigs_(value, getPrecisionForMeasurement(attribute));
};


exports.setPrecision = setPrecision;