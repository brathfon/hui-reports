#!/bin/bash


#wqxFileDir=20211013b-wqx-3rd-quarter-2021-post-load
wqxFileDir=20211023a-wqx-3rd-quarter-2021-post-2nd-load
basename=20211013-add-3rd-quarter-2021-1
basename=temp-20211013-add-3rd-quarter-2021-1

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultsExport.tsv 
