author: samlinux
summary: Página modelo sobre o novo modelo de Codelabs.
id: codelab-101
categories: codelab, 101-category
environments: Web
status: Published
feedback link: https://github.com/orgs/codaqui/discussions/new/choose
analytics_ga4_account: G-HT7G6WDWHT

# Create a CodeLab with CLaaT

## CodeLab Overview
Duration: 0:01:00

In this Codelab we create a short tutorial with the CLaaT (Codelabs as a Thing) tool and publish it as a static site.

Codelabs are interactive instructional tutorials which can be authored in Google Docs using some simple formatting conventions. You can also author codelabs using markdown syntax like in this tutorial. For more information about Codelabs check out the references.

The basic building process of a Codelab tutorial can be divided into following steps:

1. Install the CLaat tool if not already done.
2. Write your tutorial with markdown or Google Docs.
3. Use to CLaat tool to build the static HTML site.
4. Publish the tutorial on the internet into the Web2 or Web3 sphere.

___This tutorial is written by Bole Roland.___

## Install Claat
Duration: 0:04:00

Firstly, you have to install the CLaat tool. For the installation process you have two possibilities: You can use the native bianry version or a Docker based version. 

In this tutorial we use the binary MacOs version. You can download the proper version for your OS here https://github.com/googlecodelabs/tools/releases/tag/v2.2.4.

After the download copy the claat-darwin-amd64 file to the $HOME/usr/local/bin folder and rename it for better usage.

```bash
# copy the bianry file to the users bin folder
cp claat-darwin-amd64 $HOME/usr/local/bin

# rename the command, alternatively you can create a symlink as well
mv $HOME/usr/local/bin/claat-darwin-amd64 $HOME/usr/local/bin/claat
```

Make sure that you have the $HOME/usr/local/bin folder in your $PATH. Check your setup with the following command which should bring up the command's help section.

```bash
claat -h
```

Well done! Your preparation is completed. Now you can move forward and write your first tutorial.


## Create the tutorial
Duration: 0:04:00

The tutorial is basically written in one markdown file. CLaat itself divides your tutorial into sections. The section is represented by a HTML header h2 tag which is expressed in markdown with the '##' sign.

You can start by selecting a base folder for your tutorial. You can call this folder lab01. Then, create a markdown file for your content inside of this folder. 

The markdown file is divided into two sections:

1. metadata
2. content

### Add the metadata
Copy and paste the headers below into your markdown file and change the values appropriately. Guidelines are available below the sample headers. 

``` bash
author: Author Name
summary: Summary of your codelab that is human readable
id: unique-codelab-identifier
categories: codelab,markdown,internet computer
environments: Web
status: Published
feedback link: A link where users can go to provide feedback (e.g. the git repo)
analytics account: Google Analytics ID
```
According to the offical documentation the metadata consists of key-value pairs of the form "key: value". Keys cannot contain colons and separate metadata fields must be separated by blank lines. At present, values must all be on one line. All metadata must come before the title. Any arbitrary keys and values may be used. However, only the following will be understood by the renderer:

* Summary: A human-readable summary of the codelab. Defaults to blank.
* Id: An identifier composed of lowercase letters ideally describing the
  content of the codelab. This field should be unique among
  codelabs.
* Categories: A comma-separated list of the topics the codelab covers.
* Environments: A list of environments the codelab should be discoverable in.
  Codelabs marked "Web" will be visible at the codelabs index. Codelabs marked
  "Kiosk" will only be available at codelabs kiosks which have special
  equipment attached.
* Status: The publication status of the codelab. Valid values are:
  - Draft: Codelab is not finished.
  - Published: Codelab is finished and visible.
  - Deprecated: Codelab is considered stale and should not be widely advertised.
  - Hidden: Codelab is not shown in index.
* Feedback Link: A link to send users to if they wish to leave feedback on the
  codelab.
* Analytics Account: A Google Analytics ID to include with all codelab pages.

### Add the Content
Next, add your title using a single '#' character. For your content you can use any valid markdown.

Example
```bash
# Title of your codelab
```

#### Add Section and Duration
Then, for each section use Header 2 h2 or '##' and specify an optional duration beneath for time remaining calculations. Optional section times will be used to automatically total and remaining tutorial times. In markdown you have to use the following format: hh:mm:ss.

Example
``` bash
## Section 1
Duration: 0:02:00
```

#### Add Section Content
Now, as you have a section to your titled codelab, go ahead and add some content for this section. 

Example
``` bash
## Content section 1
Write some valid markdown to represent your tutorial content.
```

Finally, a full example would look like this:
```bash
author: Author name
summary: Summary of your codelab that is human readable
id: unique-codelab-identifier
categories: codelab,markdown,internet computer
environments: Web
status: Published
feedback link: A link where users can go to provide feedback (e.g. the git repo)
analytics account: Google Analytics ID

# Title of codelab

## Section 1
Duration: 0:02:00

Content of section 1.
```

After finishing your content writing you are ready to build the static HTML version of this tutorial.

## Build static HTML
Duration: 0:04:00


To create a ready to use static codelab you can use the following command.
```bash
claat export index.md
```

Below, you can find the result. The result is a ready to use index.html file. In detail the CLaat tool creates a folder with the name of the "id" value from your metadata and puts the needed HTML and used images into that folder.

```bash
├── index.md
└── lab01
    ├── codelab.json
    └── index.html
```

After building the static version of your short tutorial you can use the CLaat tool for a preview as well. 

## Preview the tutorial
Duration: 0:04:00

The CLaat tool also allows the preview of your tutorial. Use the following command to run a local webserver on port 9090. Make sure you are in your base folder.

```bash
claat serve
```

Now, open your browser and open the following link http://localhost:9090. The CLaat tool has placed static web content in a directory specified by your unique "id" and you can view it locally by opening the index.html page. 

## Use custom CSS
Duration: 0:04:00

The CLaat tool comes with a ready to use HTML implementation that includes CSS as well. Sometimes you want to change the CSS settings. One way to do that is presented below.

To make things easier, make a short build script. In the base folder of your tutorial create the following script.

```bash
#!/bin/bash

# export or rebuild codelabs
claat export index.md

# add a custom css file before the end of the html body tag
sed -i "" -e "/body/i\\
<link rel=\"stylesheet\" href=\"css/format.css\">" lab01/index.html
```

Create a CSS folder in the new lab01 folder and put your custom CSS in it. Name your CSS file format.css. Every time you rebuild your tutorial the **sed** command will add the link to the custom CSS file before the end of the HTML body. In this approach you overwrite the pre-built CSS definitions.

The ready structure should look like this.

```bash
tree .
.
├── build.sh
├── index.md
└── lab01
    ├── codelab.json
    ├── css
    │   └── format.css
    ├── img
    └── index.html
```

Make sure that the build script has the proper execution rights.
```bash
chmod 755 build.sh
```

Now, you can rebuild your tutorial with custom CSS every time you make some changes to your tutorial.

```bash
./build.sh
```

## References

- [codelabs.developers.google.com](https://codelabs.developers.google.com/) 