#!/bin/bash

##########################################################################################################
# This script is only run every 2 years and the results given to DOH. There is an example of the output in
# hui-reports/reports/doh-reports/2019-integrated-report folder.  There is a README.txt file
# in there that explains the files.  One difference between the quarterly reports and the DOH integrated
# report is that the DOH report does not include samples that do not have nutrient data.  The flag
# "-inns" removes those non-nutrient samples.
##########################################################################################################

scriptName=`basename $0`

theDate=`date '+%Y%m%d_%H-%M-%S'`

if (( $# != 1 ))
then
  echo "Usage: $scriptName <basename for file. ex: DOH-IR-2019.0>"
  exit 1
fi

reportBasename=$1

logFile=logs/$theDate.$reportBasename.txt

../node_modules/.bin/tsx create-web-export.ts  \
   --odir ../reports/doh-reports \
   --bname "$reportBasename" \
   --gsdir  ../data/google-drive-downloads \
   --ndir  ../data/nutrient-data \
   --inns > "$logFile"       # inns flag causes output to not output samples without nutrient data
status=$?

echo ""
echo "Full log: $logFile"
exit $status

