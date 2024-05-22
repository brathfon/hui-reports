#!/bin/bash

# run to check afterwards
wqxFileDir=20240522a-wqx-1st-quarter-2024-post-load
basename=1st-quarter-2024-check-load-temp


# run to create
#wqxFileDir=20240514a-wqx-1st-quarter-2024-sync-prep
#basename=20240514-add-1st-quarter-2024-0

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/hui-reports/scripts/wqx/check-wqx/wqx-wqp-downloads/$wqxFileDir/ResultDetailExport.tsv 
