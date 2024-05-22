#!/bin/bash

# This script runs curl command to download the various tables as tsv files from the EPA/STORET WQP (Water Quality Portal) for comparisons against the known Hui Data
# It places .zip files in the folder where you are running, so you should probably make a folder for that day, cd into it, then run this script.
#
# Example:
#   mkdir 20240301a-wqp-4th-quarter-2023-post-load
#   cd 20240301a-wqp-4th-quarter-2023-post-load/
#   ../get-wqx-zips.sh 


curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/zip' -d '{"countrycode":["US"],"statecode":["US:15"],"organization":["HUIWAIOLA_WQX"],"providers":["STORET"]}' 'https://www.waterqualitydata.us/data/Organization/search?mimeType=tsv&zip=yes' --output "organizationData.zip"

curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/zip' -d '{"countrycode":["US"],"statecode":["US:15"],"organization":["HUIWAIOLA_WQX"],"providers":["STORET"]}' 'https://www.waterqualitydata.us/data/Project/search?mimeType=tsv&zip=yes' --output "projectData.zip"

curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/zip' -d '{"countrycode":["US"],"statecode":["US:15"],"organization":["HUIWAIOLA_WQX"],"providers":["STORET"]}' 'https://www.waterqualitydata.us/data/Station/search?mimeType=tsv&zip=yes' --output "siteDataOnly.zip"

curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/zip' -d '{"countrycode":["US"],"statecode":["US:15"],"organization":["HUIWAIOLA_WQX"],"dataProfile":"resultPhysChem","providers":["STORET"]}' 'https://www.waterqualitydata.us/data/Result/search?mimeType=tsv&zip=yes' --output "resultsPhysChem.zip"

curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/zip' -d '{"countrycode":["US"],"statecode":["US:15"],"organization":["HUIWAIOLA_WQX"],"dataProfile":"biological","providers":["STORET"]}' 'https://www.waterqualitydata.us/data/Result/search?mimeType=tsv&zip=yes' --output "resultsBiological.zip"

curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/zip' -d '{"countrycode":["US"],"statecode":["US:15"],"organization":["HUIWAIOLA_WQX"],"dataProfile":"narrowResult","providers":["STORET"]}' 'https://www.waterqualitydata.us/data/Result/search?mimeType=tsv&zip=yes' --output "resultsNarrow.zip"

curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/zip' -d '{"countrycode":["US"],"statecode":["US:15"],"organization":["HUIWAIOLA_WQX"],"dataProfile":"activityAll","providers":["STORET"]}' 'https://www.waterqualitydata.us/data/Activity/search?mimeType=tsv&zip=yes' --output "samplingActivity.zip"

curl -X POST --header 'Content-Type: application/json' --header 'Accept: application/zip' -d '{"countrycode":["US"],"statecode":["US:15"],"organization":["HUIWAIOLA_WQX"],"providers":["STORET"]}' 'https://www.waterqualitydata.us/data/ResultDetectionQuantitationLimit/search?mimeType=tsv&zip=yes' --output "detectionQuantitationLimitData.zip"