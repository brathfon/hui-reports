#!/bin/bash -x

wxfile=../../reports/web-export-quarterly-reports/2023-2nd-quarter.0.all-areas.tsv
#wxfile=./test-web-export-file.tsv

sites="./HUI Aqualink Site Ids.tsv"
csvFile="data-for-aqualink-temp.csv"

./create-aqualink-data.js -w $wxfile -s "$sites" -c "$csvFile"
