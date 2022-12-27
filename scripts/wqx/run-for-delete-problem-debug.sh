#!/bin/bash

# this script is to be used when seeing if I have fixed problems with the 3rd quarter 2022 load where deleted activities did not work.

# run to check and see if we have the same problems
#wqxFileDir=20221115b-wqx-3rd-quarter-2022-post-load
#basename=3rd-quarter-2022-after-deletes-fixed-temp


# run to create the original 3rd quarter 2022 files with problems
wqxFileDir=20221115a_wqx-3rd-quarter-2022-sync-prep
basename=20221115-add-3rd-quarter-2022-0-check-repeat-temp

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/scripts/wqx/test-data-for-deletes-problem/google-drive-downloads-2022-3rd-quarter/ \
    -n ~/development/water-quality/hui-reports/scripts/wqx/test-data-for-deletes-problem/nutrient-data-2022-3rd-quarter/ \
    -w ~/development/water-quality/hui-reports/scripts/wqx/test-data-for-deletes-problem/$wqxFileDir/ResultsExport.tsv 
