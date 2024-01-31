#!/bin/bash

# Define the file
file=$1
if [ -z "$file" ]; then
  echo "Usage: $0 <file>"
  exit 1
fi

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