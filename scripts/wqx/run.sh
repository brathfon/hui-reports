#!/bin/bash

# run to check
#wqxFileDir=20221115b-wqx-3rd-quarter-2022-post-load
#basename=3rd-quarter-2022-check-load-temp

# run to check after fixing 3rd quarter delete issue
wqxFileDir=20221226a-wqx-fix-delete-problems-post-load
basename=3rd-quarter-2022-check-load-after-delete-fix-temp

# run to create
#wqxFileDir=20221115a_wqx-3rd-quarter-2022-sync-prep
#basename=20221115-add-3rd-quarter-2022-0

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultsExport.tsv 
