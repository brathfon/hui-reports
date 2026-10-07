#!/bin/bash

###################################################################################
#
# Downloads the Hui's results from the Water Quality Portal (WQP) into a new folder in
# ./check-wqx/wqx-wqp-downloads. This replaces exporting the Result Detail Export from the WQX
# web site: WQP publishes the data submitted to WQX, and the download takes seconds instead of
# a 30 minute export.
#
# Args:
# $1 the name of the folder to create in ./check-wqx/wqx-wqp-downloads
#
# example: ./download-wqp-results.sh 20261007a-wqx-2nd-quarter-2026-sync-prep
#
# resulting file:
#
#  ./check-wqx/wqx-wqp-downloads/20261007a-wqx-2nd-quarter-2026-sync-prep/resultphyschem.tsv
#
# which can be passed to ./run-create-wqx-activities-and-results.sh using the same folder name.
#
###################################################################################

scriptName=`basename $0`

if [[ $# -ne 1 ]]
then
  echo "Usage: $scriptName <folder name to create ex: 20261007a-wqx-2nd-quarter-2026-sync-prep>"
  exit 1
fi

cd "$(dirname "$0")"

downloadDir=./check-wqx/wqx-wqp-downloads/$1
resultsFile=$downloadDir/resultphyschem.tsv

if [ -e "$resultsFile" ]
then
  echo "ERROR: $resultsFile already exists"
  exit 1
fi

mkdir -p "$downloadDir" || exit 1

echo "Downloading results from the Water Quality Portal into $downloadDir"
curl --fail --silent --show-error --retry 3 -X POST \
    --header 'Content-Type: application/json' --header 'Accept: application/zip' \
    -d '{"organization":["HUIWAIOLA_WQX"],"dataProfile":"resultPhysChem","providers":["STORET"]}' \
    'https://www.waterqualitydata.us/data/Result/search?mimeType=tsv&zip=yes' \
    --output "$downloadDir/resultphyschem.zip" || { echo "ERROR: download failed"; exit 1; }

unzip -o -q "$downloadDir/resultphyschem.zip" -d "$downloadDir" || { echo "ERROR: could not unzip the download"; exit 1; }
rm "$downloadDir/resultphyschem.zip"

if [ ! -s "$resultsFile" ]
then
  echo "ERROR: the download did not contain resultphyschem.tsv"
  exit 1
fi

# WQP is only as current as the last WQX submission it has picked up, so show how recent the data is
# to check that the last load made it in.
awk -F'\t' '
  NR == 1 { for (i = 1; i <= NF; i++) column[$i] = i; next }
  {
    ++results
    if ($column["ActivityStartDate"] > newestActivity) newestActivity = $column["ActivityStartDate"]
    if ($column["LastUpdated"] > lastUpdated) lastUpdated = $column["LastUpdated"]
  }
  END {
    print "Results downloaded:     " results
    print "Newest activity date:   " newestActivity
    print "Most recent WQX change: " lastUpdated
  }' "$resultsFile"

echo
echo "Next: ./run-create-wqx-activities-and-results.sh $1 <base name of output files>"

exit 0
