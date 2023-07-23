const rp = require("../../lib/reportPrecision");

/*
convertSamplesToText: converts an object of sample data into a large glob of text
Input: object with sample parsing results.  A boolean flag to say if the
parsing was successful and an object where each key is a sample ID and each
value is an object of sample information.

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
      ......
    }
  }
}

Output: text that looks just like above input

*/

let convertSamplesToText = function(samplesObj, logger) {

  let lines = [];

  lines.push("{");

  lines.push(`  parsingSuccessful: ${samplesObj.parsingSuccessful},`)
  lines.push(`  samples: {`);

  // going to sort these just alphabetically just for consistency, not how
  // they are usually sorted in reports.
  let sampleIDList = Object.keys(samplesObj.samples).sort();
  let count = 0;
  let numSamples = sampleIDList.length;
  sampleIDList.forEach(function (sampleID){

    ++count;

    let sampleObj = samplesObj.samples[sampleID];
    // set all the precisions
    sampleObj.temperature = rp.setPrecision("temperature", sampleObj.temperature);
    sampleObj.salinity = rp.setPrecision("salinity", sampleObj.salinity);
    sampleObj.dissolved_oxygen = rp.setPrecision("dissolved_oxygen", sampleObj.dissolved_oxygen);
    sampleObj.dissolved_oxygen_pct = rp.setPrecision("dissolved_oxygen_pct", sampleObj.dissolved_oxygen_pct);
    sampleObj.ph = rp.setPrecision("pH", sampleObj.pH);
    sampleObj.turbidity_1 = rp.setPrecision("turbidity", sampleObj.turbidity_1);
    sampleObj.turbidity_2 = rp.setPrecision("turbidity", sampleObj.turbidity_2);
    sampleObj.turbidity_3 = rp.setPrecision("turbidity", sampleObj.turbidity_3);
    sampleObj.average_turbidity = rp.setPrecision("turbidity", sampleObj.average_turbidity);

    // now add the key/value pairs to the output
    lines.push(`    ${sampleObj.sample_ID}: {`);
    lines.push(`      session: '${sampleObj.session}',`);
    lines.push(`      lab: '${sampleObj.lab}',`);
    lines.push(`      station: '${sampleObj.station}',`);
    lines.push(`      sample_ID: '${sampleObj.sample_ID}',`);
    if (sampleObj.site_name.includes("'")) {   // handle okinas in Hawaiian site names
      lines.push(`      site_name: "${sampleObj.site_name}",`);
    }
    else {
      lines.push(`      site_name: '${sampleObj.site_name}',`);
    }
    lines.push(`      the_date: '${sampleObj.the_date}',`);
    lines.push(`      the_time: '${sampleObj.the_time}',`);
    lines.push(`      temperature: '${sampleObj.temperature}',`);
    lines.push(`      salinity: '${sampleObj.salinity}',`);
    lines.push(`      dissolved_oxygen: '${sampleObj.dissolved_oxygen}',`);
    lines.push(`      dissolved_oxygen_pct: '${sampleObj.dissolved_oxygen_pct}',`);
    lines.push(`      pH: '${sampleObj.pH}',`);
    lines.push(`      turbidity_1: '${sampleObj.turbidity_1}',`);
    lines.push(`      turbidity_2: '${sampleObj.turbidity_2}',`);
    lines.push(`      turbidity_3: '${sampleObj.turbidity_3}',`);
    lines.push(`      average_turbidity: '${sampleObj.average_turbidity}',`);
    lines.push(`      comments: '${sampleObj.comments}'`);
    if (count === numSamples) {  // the last sample, no comma needed
      lines.push(`    }`);
    }
    else {
      lines.push(`    },`);
    }

  });


  lines.push("  }");
  lines.push("}");

  return lines.join("\n");

};


exports.convertSamplesToText = convertSamplesToText;
