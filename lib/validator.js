
//EC6 style function
var isLeapYear = (yr) => ((yr % 4 == 0) && (yr % 100 != 0)) || (yr % 400 == 0);

// valid date, YYYY-MM-DD
var isDate = function(value) {
  var testTime = null;
  var dateParts = null;
  var year = null;
  var month = null;
  var day = null;
  // first make sure it is the basic form YYYY-MM-DD
  if (value.match(/^[1-2][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]$/) != null) {
    //console.log("general form is OK");

    dateParts = value.split("-");
    year = parseInt(dateParts[0]);
    month = parseInt(dateParts[1]);
    day = parseInt(dateParts[2]);

    if ((month < 1) || (month > 12)) {
      return false;
    }

    if (month == 2) {  // ah, February
      if (isLeapYear(year)){
        if ((day >= 1) && (day <= 29)) {
          return true;
        }
      } else {
        if ((day >= 1) && (day <= 28)) {
          return true;
        }
      }

    }
    else if ((month == 9) || (month == 4) || (month == 6) || (month == 11)) {
      if ((day >= 1) && (day <= 30)) {
        return true;
      }
    }
    else {
      if ((day >= 1) && (day <= 31 )) {
        return true;
      }
    }
  }  // end of basic match
  //console.log("something is BAD");

  return false;
};


// valid HH:MM time, 24 hour clock

var isHourMinute = function(value) {

  if (value.match(/^[0-9]:[0-5][0-9]$/) != null) {
    return true;
  }
  if (value.match(/^[0-1][0-9]:[0-5][0-9]$/) != null) {
    return true;
  }
  if (value.match(/^[2][0-3]:[0-5][0-9]$/) != null) {
    return true;
  }
  return false;
};

var isFloat = function(value) {
  var floatValues =  /^[+-]?([0-9]*[.])?[0-9]+$/;
  return (value.match(floatValues) === null) ? false : true;
};

exports.isDate = isDate;
exports.isHourMinute = isHourMinute;
exports.isFloat = isFloat;



