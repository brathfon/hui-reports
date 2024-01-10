#!/bin/bash

# run to check
#wqxFileDir=20231107a-wqx-3rd-quarter-20213-post-load
#basename=3rd-quarter-2023-check-load-temp


# run to create
wqxFileDir=20231106a-wqx-3rd-quarter-2023-sync-prep
basename=temp-cleanup

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultDetailExport.tsv 
