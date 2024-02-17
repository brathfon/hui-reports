#!/bin/bash

# run to check
wqxFileDir=20240217a-wqx-4th-quarter-2023-post-load
basename=4th-quarter-2023-check-load-temp


# run to create
#wqxFileDir=20240206a-wqx-4th-quarter-2023-sync-prep
#basename=20240206-add-4th-quarter-2023-0

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultDetailExport.tsv 
