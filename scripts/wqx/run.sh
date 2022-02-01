#!/bin/bash


#wqxFileDir=20220201a-wqx-4th-quarter-2021-post-load
wqxFileDir=20220129a-wqx-4th-quarter-2021-sync-prep
basename=20220129-add-4th-quarter-2021-0

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultsExport.tsv 
