#!/bin/bash

scriptName=`basename $0`

if (( $# != 1 ))
then
  echo "Usage: $scriptName <basename for file. ex: 2019-4th-quarter.0>"
  exit 1
fi

reportBasename=$1

output_dir=../reports/web-export-quarterly-reports

./create-web-export.js  \
   --odir $output_dir \
   --bname $reportBasename  \
   --gsdir  ../data/google-drive-downloads \
   --sfile ../data/sites.txt  \
   --ndir  ../data/nutrient-data \


#   --inns   # this is for removing data without nutrients option

