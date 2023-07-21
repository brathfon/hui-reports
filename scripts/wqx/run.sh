#!/bin/bash

# run to check
wqxFileDir=20230721b-wqx-2nd-quarter-2023-post-load
basename=1st-quarter-2023-check-load-temp


# run to create
#wqxFileDir=20230721a-wqx-2nd-quarter-2023-sync-prep
#basename=20230721-add-2nd-quarter-2023-0

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultsExport.tsv 
