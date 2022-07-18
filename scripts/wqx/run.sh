#!/bin/bash


wqxFileDir=20220719b-wqx-2nd-quarter-2022-post-load
basename=2nd-quarter-2022-check-load-temp


#wqxFileDir=20220719a-wqx-2nd-quarter-2022-sync-prep
#basename=20220719-add-2nd-quarter-2022-0

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultsExport.tsv 
