/**
  This group of functions is used to extract the custom comments from a 2-dimensional array
  of information, probably from a spreadsheet.
  NOTE: the functions expect any header rows not to be included. That is the
  responsiblity of the caller.
*/

/**
 * const getSampleIdToQAComments - parses a 2D array representation of the data
 * from the "Report QA Comments" sheet and converts it into the object with
 * attribute keys of SampleIDs and values of objects with keys/value pairs of
 * type boolean 'append-or-override' and type string 'comments'. 'append-or-override'
 * lets the caller know if this commment should replace the whole comment in
 * the report or just be added to any auto-generated comments.
 *
 * @param  {2D array of strings} reportQACommentsArrayOfArrays rows and columns of table as 2D array
 * @return {object}                                            keys are SampleIDs and values are objects with report data
 *
 *
 [
   [
     'NKP210311',
     'Append',
     "nutrient data QA'ed out, hold time 47 days"
   ],
   [
     'RCB220906',
     'Append',
     "nutrient data QA'ed out, sample bottle contaminated"
   ]
 ]

and returns an object with key-value pairs.  The keys are SampleIDs and the values
are to an object with a key value information for using in the commments column
of the report.  See function description and example data above for more info.

 {
   NKP210311: {
     'append-or-override': 'Append',
     comment: "nutrient data QA'ed out, hold time 47 days"
   },
   RCB220906: {
     'append-or-override': 'Append',
     comment: "nutrient data QA'ed out, sample bottle contaminated"
   }
 }
 */
const getSampleIdToQAComments = function(reportQACommentsArrayOfArrays) {

  let returnKV = {}; // key value pair where area is key, object that includes
                     // whether to append or override

  reportQACommentsArrayOfArrays.forEach(function (row) {
    returnKV[row[0]] = {'append-or-override': row[1], 'comment': row[2]};
  });

  return returnKV;
};



exports.getSampleIdToQAComments = getSampleIdToQAComments;
