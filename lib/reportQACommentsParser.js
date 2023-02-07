/**
  This group of functions is used to extract the custom comments from a 2-dimensional array
  of information, probably from a spreadsheet.
*/


/**

Looks through an array of arrays for this kind of data

reportQACommentsData [
   [ 'SampleID', 'Override or Append', 'Comment' ],
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

and returns an object with key-value pairst to match the area to a reporting region

 getSampleIdToQAComments {
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

  // there is a header row
  //for (let row = 1; row < reportQACommentsArrayOfArrays.length; ++row) {
  reportQACommentsArrayOfArrays.forEach(function (row) {
    //let column = reportQACommentsArrayOfArrays[row];
    returnKV[row[0]] = {'append-or-override': row[1], 'comment': row[2]};
  });

  return returnKV;
};



exports.getSampleIdToQAComments = getSampleIdToQAComments;
