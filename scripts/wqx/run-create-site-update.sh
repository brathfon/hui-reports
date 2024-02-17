#!/bin/bash

# run to check

huiDataDir=~/development/water-quality/hui-reports/data/google-drive-downloads
huiSiteCodesFile='Hui o ka Wai Ola Data Entry - Site Codes.tsv'

wqxDataDir=~/development/water-quality/water-quality-data/storet/20240206a-wqx-4th-quarter-2023-sync-prep
wqxLocationFile=MonitoringLocationDetailExport.tsv

basename=20240206-add-lanai-sites

./create-wqx-site-update-files.js  \
    $huiDataDir/"$huiSiteCodesFile" \
    $wqxDataDir/$wqxLocationFile \
    ./load-files  \
    $basename \


