#!/bin/bash

scriptName=`basename $0`

theDate=`date '+%Y%m%d_%H-%M-%S'`

if (( $# != 1 ))
then
  echo "Usage: $scriptName <basename for file. ex: 2019-4th-quarter.0>"
  exit 1
fi

reportBasename=$1

output_dir=../reports/web-export-quarterly-reports
logFile=logs/$theDate.$reportBasename.txt

# stdout (progress, plus each issue as it is found) goes to the log file.
# stderr (the summary of errors and warnings, sorted by sample date) goes to the terminal.
../node_modules/.bin/tsx create-web-export.ts  \
   --odir $output_dir \
   --bname "$reportBasename"  \
   --gsdir  ../data/google-drive-downloads \
   --ndir  ../data/nutrient-data > "$logFile"
status=$?

echo ""
echo "Full log: $logFile"
exit $status


#   --inns   # this is for removing data without nutrients option

