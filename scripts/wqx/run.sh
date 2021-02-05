#!/bin/bash


resultsDir=20210205b-wqp-4th-quarter-2020-post-load
basename=20210205-add-4th-quarter-2020-temp

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$resultsDir/ResultsExport.tsv 
