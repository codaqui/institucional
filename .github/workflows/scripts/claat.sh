# Go to google-colab directory and install claat
cd google-colab
go install github.com/googlecodelabs/tools/claat@latest
export GOPATH="$HOME/go"
PATH="$GOPATH/bin:$PATH"

# For each .md file, export it to html
files=$(find . -name "*.md")
for file in $files; do
    claat export $file
done
cd ..

# Adjust index.html files
files=$(find google-colab -name "index.html")
for file in $files; do
    bash ./scripts/adjust-index.sh $file
done