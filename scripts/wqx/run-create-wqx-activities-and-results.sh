#!/bin/bash

###################################################################################
#
# This script wraps the create-wqx-activities-and-results.js script to make
# passing in parameters easier.
# Args:
# $1 the name of the directory in ~/hui-reports/scripts/wqx/check-wqx/wqx-wqp-downloads where the WQX current download results file is stored
# $2 a basename for the output files that are created in the process and stored in ./load-files
#
# example: ./run-create-wqx-activities-and-results.sh  20241203a-wqx-3rd-quarter-2024-sync-prep 2024-3rd-quarter.0
#
# resulting files found in ~/hui-reports/scripts/wqx/load-files :
#
#  2024-3rd-quarter.0.existing-update.txt
#  2024-3rd-quarter.0.new-add.txt
#
###################################################################################

scriptName=`basename $0`


if [[ $# -ne 2 ]]
then
  echo "Usage: $scriptName <WQX downloaded data directory ex: 20241203a-wqx-3rd-quarter-2024-sync-prep> <base name of output files ex: 20241203-add-3rd-quarter-2024-0>]"
  exit 1
fi

wqxDownloadsDir=~/development/water-quality/hui-reports/scripts/wqx/check-wqx/wqx-wqp-downloads
wqxResultsDetailExportFile="$wqxDownloadsDir/$1/Result Detail Export.txt"
basename=$2

outputFilesBasename=$2

if [ ! -f "$wqxResultsDetailExportFile" ]
then
  echo "ERROR: could not find WQX file $wqxResultsDetailExportFile"
  exit 1
fi

./create-wqx-activities-and-results.js  \
    -o ./load-files  \
    -b $basename  \
    -g ~/development/water-quality/hui-reports/data/google-drive-downloads/ \
    -n ~/development/water-quality/hui-reports/data/nutrient-data/  \
    -w "$wqxResultsDetailExportFile"

exit 0
