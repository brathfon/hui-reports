#!/bin/bash

# run to check
wqxFileDir=20230217b-wqx-4th-quarter-2022-post-load
basename=4th-quarter-2022-check-load-temp


# run to create
#wqxFileDir=20230217a-wqx-4th-quarter-2022-sync-prep
#basename=20230217-add-4th-quarter-2022-0

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultsExport.tsv 
