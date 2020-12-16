#!/bin/bash


#Example of a sample set that has detection limit:
#./create-wqx-activities-and-results.js  -o /tmp -b wqx -g ../../data/google-drive-downloads -n ../../data/nutrient-data/ -s RWA160614
./create-wqx-activities-and-results.js  -o ./output-from-tests -b RWA160614  -g ./test-data/google-drive-downloads -n ./test-data/nutrient-data/  -s RWA160614

#example of insitu only with a QA's out value (pH)
./create-wqx-activities-and-results.js  -o ./output-from-tests -b RNS200818  -g ./test-data/google-drive-downloads -n ./test-data/nutrient-data/  -s RNS200818

#example of full set with 1 QA's out value (Salinity)
#./create-wqx-activities-and-results.js  -o ./initial-results-test-load/ -b wqx -g ../../data/google-drive-downloads -n ../../data/nutrient-data/ -s RCB170124
./create-wqx-activities-and-results.js  -o ./output-from-tests -b RCB170124  -g ./test-data/google-drive-downloads -n ./test-data/nutrient-data/  -s RCB170124

#To run them all just for testing no delta check
./create-wqx-activities-and-results.js  -o ./output-from-tests -b full -g ./test-data/google-drive-downloads -n ./test-data/nutrient-data

#An example in the first 1/8 that has a QA'ed out 
./create-wqx-activities-and-results.js  -o ./output-from-tests -b PFF160727  -g ./test-data/google-drive-downloads -n ./test-data/nutrient-data/ -s PFF160727

# ammonium under detection limit
./create-wqx-activities-and-results.js  -o ./output-from-tests -b RAB161115  -g ./test-data/google-drive-downloads -n ./test-data/nutrient-data/ -s RAB161115

# Nitrate and Nitrate under detection limit 
./create-wqx-activities-and-results.js  -o ./output-from-tests -b PPU161019  -g ./test-data/google-drive-downloads -n ./test-data/nutrient-data/ -s PPU161019


#for one to compare in the first 1/8 already sent:
./create-wqx-activities-and-results.js  -o ./output-from-tests -b delta  -g ./test-data/google-drive-downloads -n ./test-data/nutrient-data/ -w ./test-data/storet/ResultsExport.tsv

