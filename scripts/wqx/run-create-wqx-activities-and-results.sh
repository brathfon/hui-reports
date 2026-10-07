#!/bin/bash

###################################################################################
#
# This script wraps the create-wqx-activities-and-results.ts script to make
# passing in parameters easier.
# Args:
# $1 the name of the directory in ./check-wqx/wqx-wqp-downloads where the WQX current download results file is stored.
#    That is either resultphyschem.tsv made by ./download-wqp-results.sh, or the Result Detail Export.txt
#    exported from the WQX web site and saved as tab separated text from Excel.
# $2 a basename for the output files that are created in the process and stored in ./load-files
#
# example: ./run-create-wqx-activities-and-results.sh  20241203a-wqx-3rd-quarter-2024-sync-prep 2024-3rd-quarter.0
#
# resulting files found in ./load-files :
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

wqxDownloadsDir=./check-wqx/wqx-wqp-downloads
wqxResultsDetailExportFile="$wqxDownloadsDir/$1/Result Detail Export.txt"
if [ ! -f "$wqxResultsDetailExportFile" ]
then
  wqxResultsDetailExportFile="$wqxDownloadsDir/$1/resultphyschem.tsv"
fi
basename=$2

outputFilesBasename=$2

if [ ! -f "$wqxResultsDetailExportFile" ]
then
  echo "ERROR: could not find Result Detail Export.txt or resultphyschem.tsv in $wqxDownloadsDir/$1"
  exit 1
fi

echo "Comparing against WQX results in $wqxResultsDetailExportFile"

./create-wqx-activities-and-results.ts  \
    -o ./load-files  \
    -b $basename  \
    -g ../../data/google-drive-downloads/ \
    -n ../../data/nutrient-data/  \
    -w "$wqxResultsDetailExportFile"

exit 0
