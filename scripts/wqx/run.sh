#!/bin/bash

# run to check
wqxFileDir=20230509b-wqx-1st-quarter-2023-post-load
basename=1st-quarter-2023-check-load-temp


# run to create
#wqxFileDir=20230509a-wqx-1st-quarter-2023-sync-prep
#basename=20230509-add-1st-quarter-2023-0

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultsExport.tsv 
