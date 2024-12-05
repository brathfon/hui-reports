#!/bin/bash


###################################################################################
#
# This script wraps the create-aqualink-data.js script, passing in the needed
# arguments. The csv output file is written to the current directory in the form
# "aqualink-data.arg1.csv", unless argument 2 (optional) is supplied, then it is
# "aqualink-data.arg2.csv".
# Args:
#   $1 the basename for the release, usually YYYY-QQQ-quarter.# example: 2024-3rd-quarter.0
# Optional:
#   $2 give the output a different basename
#
###################################################################################

scriptName=`basename $0`


if [[ $# -ne 1 && $# -ne 2 ]]
then
  echo "Usage: $scriptName <basename quarterly file to read ex: 2019-4th-quarter.0> [base name of output file ex: temp-test]"
  exit 1
fi

reportBasename=$1
samplesAllAreasFile=../../reports/web-export-quarterly-reports/$reportBasename.all-areas.tsv
sites="../../data/google-drive-downloads/Hui O Ka Wai Ola Data Entry - Site Codes.tsv"

if [[ $# -eq 1 ]]
then
  csvOutputOutToAqualink="./aqualink-data.$reportBasename.csv"
else
  csvOutputOutToAqualink="./aqualink-data.$2.csv"
fi

if [ ! -f "$sites" ]
then
  echo "ERROR: could not find site file $sites"
  exit 1
fi

if [ ! -f "$samplesAllAreasFile" ]
then
  echo "ERROR: could not find samples file $samplesAllAreasFile"
  exit 1
fi


./create-aqualink-data.js  \
  -w "$samplesAllAreasFile" \
  -s "$sites" \
  -c "$csvOutputOutToAqualink"
