#!/bin/bash

# Define the file
file=$1
if [ -z "$file" ]; then
  echo "Usage: $0 <file>"
  exit 1
fi
echo "Adjusting $file"

# ----- Case 1: Google Analytics -----

# Define the new code to be inserted
new_code='<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-HT7G6WDWHT"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('"'"'js'"'"', new Date());

  gtag('"'"'config'"'"', '"'"'G-HT7G6WDWHT'"'"');
</script>'

# Create a temporary file
temp_file=$(mktemp)

# Delete the code exacly: <google-codelab-analytics gaid="UA-49880327-14" ga4id=""></google-codelab-analytics>
sed '/<google-codelab-analytics gaid="UA-49880327-14" ga4id=""><\/google-codelab-analytics>/d' "$file" > "$temp_file"

# Delete the attributes codelab-ga4id and codelab-gaid from google-codelab tag
sed -i 's/codelab-ga4id="[^"]*"//g' "$temp_file"
sed -i 's/codelab-gaid="[^"]*"//g' "$temp_file"

# Insert the new code after the <head> tag
awk -v ncode="$new_code" '/<head>/ {print; print ncode; next} 1' "$temp_file" > "$file"

# Remove the temporary file
rm "$temp_file"

# ----- Case 2: Identify IMGs ending with .webm and change the tag to video -----
# Eg. <img src="img/1.webm" alt="1" />
# After. <video src="img/1.webm" alt="1" />

while IFS= read -r line; do
  # Check if the line contains a .webm file
  if [[ $line == *".webm"* ]]; then
    # Replace the tag
    new_line=$(echo "$line" | sed 's/<img/<video/')
    new_line=$(echo "$new_line" | sed 's/<\/img/<\/video/')

    # Set the width and controls attributes
    new_line=$(echo "$new_line" | sed 's/.webm"/.webm" width="100%" controls/')

    # Replace the line
    sed -i "s|$line|$new_line|g" "$file"
  fi
done < "$file"

# ----- Case 3: Add script on the end of the file -----
# Add the <script type="text/javascript" src="https://cdn.datacamp.com/dcl-react.js.gz"></script>
# After the last </script> tag

LINE_NUMBER=$(grep -n "</script>" $file | tail -1 | cut -d: -f1)
head -n $LINE_NUMBER $file > temp.txt
echo '<script type="text/javascript" src="https://cdn.datacamp.com/dcl-react.js.gz"></script>' >> temp.txt
tail -n +$((LINE_NUMBER+1)) $file >> temp.txt
mv temp.txt $file

# ----- Case 4: Identify ![iframe][code][file] -----
# Eg. ![iframe][code][1.html]
# $file = ./python-101/index.html
# After. Catch the content of ./coding/python-101/1.html and put replace the tag for all the file

COUNTER=1
while IFS= read -r line; do
  # Check if the line contains ![iframe][code][file]
  TEMP_REGEX='\!\[iframe\]\[code\]\[(.*?)\]'
  if [[ $line =~ $TEMP_REGEX ]]; then
    FOLDER=$(echo $file | awk -F'/' '{print $2}')
    FINAL_FOLDER="./google-colab/coding/$FOLDER"
    TEMP_FILE="${BASH_REMATCH[1]}"
    FINAL_FILE="$FINAL_FOLDER/$TEMP_FILE"
    FILE_CONTENT=$(cat $FINAL_FILE)
    COUNTER_WITHOUT_LINE=$(($COUNTER-1))
    head -n $COUNTER_WITHOUT_LINE $file > temp.txt
    echo "$FILE_CONTENT" >> temp.txt
    tail -n +$((COUNTER+1)) $file >> temp.txt
    mv temp.txt $file
    sed -i "s|$line||g" "$file"
  fi
  COUNTER=$((COUNTER+1))
done < "$file"
