#!/bin/bash

#wq_files=/Users/bill/development/water-quality/water-quality-data

output_dir=../reports/web-export-quarterly-reports

./create-web-export.js  \
   --odir $output_dir \
   --bname 4th-quarter.1  \
   --gsdir  ../data/google-drive-downloads \
   --sfile ../data/sites.txt  \
   --ndir  ../data/nutrient-data \


#   --inns   # this is for removing data without nutrients option

