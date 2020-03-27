#!/bin/bash

scriptName=`basename $0`

if (( $# != 1 ))
then
  echo "Usage: $scriptName <basename for file. ex: DOH-IR-2019.0>"
  exit 1
fi

reportBasename=$1

./create-web-export.js  \
   --odir ../reports//doh-reports \
   --bname $reportBasename \
   --gsdir  ../data/google-drive-downloads \
   --sfile ../data/sites.txt  \
   --ndir  ../data/nutrient-data \
   --inns

