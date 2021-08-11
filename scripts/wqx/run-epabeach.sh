#!/bin/bash

basename=20210808-epabeach-sessions-1-19

# To run them all with no delta check
#./create-wqx-activities-and-results.js  -o ./output-from-tests -b full -g ./test-data/google-drive-downloads -n ./test-data/nutrient-data

./create-wqx-activities-and-results.js  \
    -o ./load-files/epabeach-fix  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \

