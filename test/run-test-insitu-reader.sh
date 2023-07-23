#!/bin/bash

# first session from each team
input=./one-session-baseline-data/google-drive-downloads
basename=one-session-each-sheets-test-with-parser_3

# old "full" data (just sessions 78w to 53s)
#input=./baseline-data/google-drive-downloads

# new full baseline, from same spreadsheet being used in GAS
#input=./sessions-93w-68s-baseline-data
#basename=93w-68s-sheets-test-with-parser-2


outputDir=./results

./test-insitu-reader.js -i $input -o $outputDir -b $basename
