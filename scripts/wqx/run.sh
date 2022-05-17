#!/bin/bash


wqxFileDir=20220517a-wqx-1st-quarter-post-load
basename=1st-quarter-2022-check-load-temp


#wqxFileDir=20220421a-wqx-1st-quarter-2022-sync-prep
#basename=20220421-add-1st-quarter-2022-1

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultsExport.tsv 
