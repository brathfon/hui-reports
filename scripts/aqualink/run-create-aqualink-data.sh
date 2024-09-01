#!/bin/bash

#wxfile=../../reports/web-export-quarterly-reports/2024-1st-quarter.0.all-areas.tsv
#wxfile=./test-web-export-file.tsv

scriptName=`basename $0`

#theDate=`date '+%Y%m%d_%H-%M-%S'`

if (( $# != 1 ))
then
  echo "Usage: $scriptName <basename quarterly file to read ex: 2019-4th-quarter.0>"
  exit 1
fi

reportBasename=$1

wxfile=../../reports/web-export-quarterly-reports/$reportBasename.all-areas.tsv
csvFile="./aqualink-data.$reportBasename.csv"

#sites="./HUI Aqualink Site Ids.tsv"
sites="../../data/google-drive-downloads/Hui O Ka Wai Ola Data Entry - Site Codes.tsv"


./create-aqualink-data.js  \
  -w $wxfile \
  -s "$sites" \
  -c "$csvFile"
