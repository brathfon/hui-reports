#!/bin/bash



oldfile=$1
newfile=$2

echo ""
echo "Diffing $oldfile $newfile"

# fix the original mistake of have <.28 on the below detected level stuff (only in some old files)
perl -wnlp -e 's/<//g;' $oldfile | sort > /tmp/old-file-without-less-than-symbol

perl -wnlp -e 's/\tHUI_PCHEM\tEPABEACH//g;' $newfile | sort > /tmp/new-file-without-new-columns

diff /tmp/old-file-without-less-than-symbol /tmp/new-file-without-new-columns