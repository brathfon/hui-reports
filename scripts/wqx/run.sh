#!/bin/bash


wqxFileDir=20210608a-wqx-1st-quarter-2021-sync-prep
basename=20210608-add-1st-quarter-2021-0

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w ~/development/water-quality/water-quality-data/storet/$wqxFileDir/ResultsExport.tsv 