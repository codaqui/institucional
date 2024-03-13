author: Marc DiPasquale
summary: Create a Codelab Using Markdown
id: codelab-102
tags:
categories: Solace, Codelabs
environments: Web
status: Draft
feedback link: https://github.com/SolaceDev/solace-dev-codelabs/tree/master/markdown/codelab-4-codelab
analytics_ga4_account: G-HT7G6WDWHT

# Codelab to Create a Codelab

## Codelab Overview

Duration: 0:02:00

Are you trying to create easy to use, visually appealing content for the tech community? This Codelab will show you how to quickly create your own Google Codelab just like the one you're using right now.

We'll be authoring the codelabs using markdown format. This gives us the flexibility of using our markdown file for other things and also storing it in our [github repo](https://github.com/SolaceDev/solace-dev-codelabs) with any code that might be used for a tutorial.

Here is an example image of another Codelab that I created:
![image_caption](./assets/python-101/certificado-python.png)
### Resources

- The markdown for this codelab is located here: [codelab.md](https://raw.githubusercontent.com/SolaceDev/solace-dev-codelabs/master/markdown/codelab-4-codelab/codelab-4-codelab.md)
- [Google Codelabs Tools Github](https://github.com/googlecodelabs/tools) - The repo that contains the claat tool we'll be using today
- [Google Group for Codelab Authors](https://groups.google.com/forum/#!forum/codelab-authors) - great forum for asking questions about codelabs and discussing future functionality
- [A blog that I used when getting started with Google Codelabs](https://medium.com/@mariopce/tutorial-how-to-make-tutorials-using-google-code-labs-gangdam-style-d62b35476816)

### Video

You can also watch a video on how you can contribute to authoring a codelab by visiting this [YouTube link](https://www.youtube.com/watch?v=2B8ev-hSbcM) or watching the video below

![https://www.youtube.com/watch?v=2B8ev-hSbcM](Video)

## Environment Setup

Duration: 0:04:00

In order to create a Codelab you need

- [Go](https://golang.org/dl/)
- [claat](https://github.com/googlecodelabs/tools/tree/master/claat) (the codelabs command line tool) installed.
- [Nodejs](https://nodejs.org/en/download/)

You have two options to download the dependencies:

### Option A: Download from source

- Install Go, claat, and NodeJs from the links above if you don't have them already installed. You can follow the documentation on Go's website and the Google Codelabs github repo.

### Option B: Download from cli: MacOS/Linux setup

#### Install Go

```bash
$ brew install go
```

#### Setup Go Environment Variables

Below is what I set on mac, but instructions are [here](https://golang.org/doc/install) for other OS options

```bash
$ export GOPATH=$HOME/Go
$ export GOROOT=/usr/local/opt/go/libexec
$ export PATH=$PATH:$GOPATH/bin
$ export PATH=$PATH:$GOROOT/bin
```

#### Install claat

**Option A: from CLI using go**

```bash
$ go install github.com/googlecodelabs/tools/claat@latest
```

**Option B: pre-compiled binary**

Navigate to the [Google Codelabs release page](https://github.com/googlecodelabs/tools/releases) and install it from there

#### Confirm claat installment

You should now have the _claat_ command available to you.

```bash
$ claat
```


#### Note if you have Go v1.17+ 

As of Go v1.17+, the go get command for installing executables is deprecated https://go.dev/doc/go-get-install-deprecation

A workaround for isntalling the claat command is the follwing:
1. Clone the google tools project repo into a google-tools directory `git clone git@github.com:googlecodelabs/tools.git google-tools` 
2. Navigate to the claat command directory `cd google-tools/claat`  
3. Build the claat command `go build .`. This will create a `claat` command executable that you can use.  
4. Now you can update your PATH env variable (this is either done in your .bashrc, .profile, or .zshrc depending on what your shell is). At the end of the file, isert the following line`export PATH=$PATH:$HOME/google-tools/claat`. Note: this assumes you clones the google-tools repo in your $HOME directory. If cloned elsewhere, make sure you use the right path in your path export  
5. After you do this, you can open up a new terminal window and executing `claat` from the command line should work   

## Solace Guidelines

Duration: 0:05:00

### Content Guidance

✅ Each codelab should be focused on one topic or a very small group of related topics.  
✅ Use sections to separate steps for ease of navigation  
✅ Include an "Overview" or "What You'll Learn Section" at the beginning of a codelab  
✅ Include an "Environment Setup" or "What You'll Need Section" section that sets up the environment, if necessary.  
✅ Try to make the codelab fun and engaging using images and/or gifs  
✅ Provide code used in a separate public git repo

### Tips 
💡 To capture a multi-part topic, create smaller sections of the topic and organize the section titles as parts and sub-sections to capture the grouping of content.
![image_caption](./assets/python-101/certificado-python.png)

💡 Attempt to give complete context when specifying properties, configuration etc as much as possible.
![image_caption](./assets/python-101/certificado-python.png)

### Where to create your codelab

📌 Create your codelab in the [Solace codelabs repo](https://github.com/SolaceDev/solace-dev-codelabs) for version tracking  
📌 All other code can be kept in a separate repo  
📌 Example codelab markdown structure can be found on the [Battleship markdown](https://github.com/SolaceDev/solace-dev-codelabs/tree/master/markdown/solace-battleship) and the [Battleship source code](https://github.com/solacetraining/solace-battleship)

### Content Reviewer

Upon authoring of your codelab, we request you have two reviewers:

1️⃣ Technical reviewer who is knowledgeable with the content. **Make sure they are tagged on github as a reviewer**  
2️⃣ A member of the Developer Relations team to confirm the structure of your codelab and merge it into the main github repo

✨ Now that we have the environment setup, you have two options you can follow to create your first codelab: Automated or Manual

## Prepare your repo

Duration: 0:02:00

Start by

1. Forking the solace-dev-codelabs repo from [https://github.com/SolaceDev/solace-dev-codelabs](https://github.com/SolaceDev/solace-dev-codelabs)  
   ![image_caption](./assets/python-101/certificado-python.png)

2. Clone your fork. Note: replace `<Your_Github_User>` with your github username and `<name_of_codelab>` with the name of your codelabs. See note below if you do not have ssh setup

```bash
git clone git@github.com:<Your_Github_User>/solace-dev-codelabs.git
cd solace-dev-codelabs
git checkout -b add-codelab-<name_of_codelab>
```

> aside positive
> If you do not have SSH setup on your machine and got an error cloning the repo, you can clone the https link instead as follows:
> ```
> git clone https://github.com/<Your_Github_User>/solace-dev-codelabs.git
> ```

> aside negative
> Do not forget to checkout the code into a new branch **git checkout -b \<add-codelab-name_of_codelab>**. This would help facilitating a peer review and approve/reject changes without affecting the published content.

Then follow one of the two options in the next two steps: Automated or Manual

## Create a new Codelab - Automated [Option A]

Duration: 0:05:00

### Prerequisites

- NodeJS

### Steps

1. After cloning the repository as per the earlier step, from the root directory, run the init script as follows `./init.sh <name-of-codelab>`
1. Navigate to the `/markdown/<name-of-codelab>` directory
1. Install the required dependencies for watching any changes you make in your markdown file by running the following from terminal `npm install`
1. Compile and start the claat server by running `npm run watch`. Note: This will open a tab in your browser and serve your markdown file
1. Edit your `<name-of-codelab>.md` file in your text editor of choice
1. When ready, run the export script as follows `./export.sh`

> aside negative
> If you're using Windows make sure to set your text editor to use UNIX line endings!

> aside positive
> Exporting your codelab will create the html static files under the `codelabs/<name-of-codelab>` directory

🚀 Go ahead to the **Step 8** and add your codelabs on the main repo

## Create a new Codelab - Manual [Option B]

Create a folder `<name-of-codelab>` under the `markdown` directory. This is where your markdown file and related artifacts (such as images) will reside.

Navigate to the `<name-of-codelab>` directory.

Go ahead and create a markdown file where you'll create the actual codelab.
Please have your markdown file name match the `id` in the header metadata that you will set in the next subsection.

> aside negative
> If you're using Windows make sure to set your text editor to use UNIX line endings!

####

```bash
$ vim unique-codelab-identifier.md
```

#### Fill-in the header metadata

Copy and paste the headers below into your markdown file and change the values appropriately.
Guidelines are available below the sample headers.

```
author: Author Name
summary: Summary of your codelab that is human readable
id: unique-codelab-identifier
tags: workshop,iguide
categories: Java,Spring
environments: Web
status: Published
feedback link: A link where users can go to provide feedback (e.g. the git repo or issue page)
```

Metadata consists of key-value pairs of the form "key: value". Keys cannot
contain colons, and separate metadata fields must be separated by blank lines.
At present, values must all be on one line. All metadata must come before the
title. Any arbitrary keys and values may be used; however, only the following
will be understood by the renderer:

- Author: Author name or git username
- Summary: A human-readable summary of the codelab. Defaults to blank
- Id: An identifier composed of lowercase letters ideally describing the content of the codelab. This field should be unique among codelabs. This will be in the URL of the codelab
- Tags: Leave "workshop" if creating a Developer workshop or "iguide" if creating an integration guide. Remove both if neither. Note: this is used for the "Filter by Type" feature on the [landing page](solace.dev/codelabs)
- Categories: A comma-separated list of the topics or technologies the codelab covers. Include items such as language(s) and protocol(s) used. The first one is used to create a new "Filter by category" feature on the [landing page](solace.dev/codelabs) and the styling of the category. The remaining will be used for the filtering.
  - Note that the list of available categories can be found in the main [site repo](https://github.com/SolaceDev/solace-dev-codelabs-site/blob/master/site/app/styles/_categories.scss#L178-L198)
  - The current list is (case insensitive): `[AMQP, Boomi, Codelab, Java, JMS, Kafka, MQTT, REST, Solace, Spring]`
- Environments: Leave as "Web"
- Status: The publication status of the codelab. Valid values are:
  - Draft: Codelab is not finished.
  - Published: Codelab is finished and visible.
  - Deprecated: Codelab is considered stale and should not be widely advertised.
  - Hidden: Codelab is not shown in index.
- Feedback Link: A link to send users to if they wish to leave feedback on the codelab. Link to git repo where code for the tutorial will live.
- Analytics Account: A Google Analytics ID to include with all codelab pages. Leave as shown above.

#### Add the Title

Next add your title using a single '#' character

```
# Title of codelab
```

#### Add Sections & Durations

Then for each section use Header 2 or '##' & specify an optional duration beneath for time remaining calculations
Optional section times will be used to automatically total & remaining tutorial times
In markdown I've found that the time is formatted hh:mm:ss

Example

```bash
## Section 1
Duration: 0:10:00

## Section 2
Duration: 0:05:00
```

#### Add Section Content

Now that we have 2 sections to our titled codelab let's go ahead and add some content to each section.
Make up your own or copy & paste the example below:

Copy into section 1 (Below Duration and above Section 2):

```
### Info Boxes
Plain Text followed by green & yellow info boxes

> aside negative
> This will appear in a yellow info box.
> This is line two of the negative block
> ```
> this is a code block
> with multiple lines
> ```

> aside positive
> This will appear in a green info box.

You created info boxes!

### Bullets
Plain Text followed by bullets
* Hello
* Codelab
* World

You created bullets!

### Numbered List
1. List
1. Using
1. Numbers

You created a numbered list!

```

Copy into section 2 (Below Duration):

```
### Add a Link
Add a link!
[Example of a Link](https://www.google.com)

### Add an Image
Add an image!
![image_caption](https://solace.com/wp-content/uploads/2019/09/goodbye_otter_v3.gif)

### Embed an iframe
![https://codepen.io/tzoght/embed/yRNZaP](https://en.wikipedia.org/wiki/File:Example.jpg "Try Me Publisher")
```

More Markdown Parser examples can be found [here](https://github.com/googlecodelabs/tools/tree/master/claat/parser/md).

### Export & Serve Locally

Now that you have an initial codelab defined in your markdown file let's go ahead and generate the static site content.
We can export & serve the content locally using the `claat` command that we installed earlier.

```bash
$ claat export codelab.md
$ claat serve
```

- Your browser should have opened (if it doesn't then try going to [http://localhost:9090/](http://localhost:9090/) in your browser).
- Choose the directory that matches your "id" that you put in the headers.
- Viola! You should have your first codelab!

Repeat the export and serve locally every ime you make a new change in the markdown file

> aside positive
> When you ran the `claat export` command you created the static web content needed to host your codelab.
It placed static web content in a directory specified by your unique "id" and you can view it locally by opening the index.html page.

> aside negative
> Note that when you view it locally by opening index.html some of the graphics may not show up (such as access_time, Next, Back), but they work once online.

### Export for production

When you're done, export your static web content to the `codelabs` folder.

> aside positive
> Make sure your markdown file name matches your header metadata `id` for ease of future updates.

```bash
# If creating a new codelab
mkdir markdown/<header-metadata-id>
# Add your markdown content in the markdown/<header-metadata-id>/<file-name>.md directory
# Add your images in the markdown/<header-metadata-id>/img directory

cd markdown/<header-metadata-id>
# Export into static content
# Note the google analytics code used. Keep as is below
claat export -o ../../codelabs/ <header-metadata-id>.md
```
> aside positive
> Exporting your codelab will create the html static files under the `codelabs/<name-of-codelab>` directory

🚀 Go ahead to **Step 8** and add your codelabs on the main repo

## Modify an existing Codelab

Duration: 0:03:00

### Steps

1. Navigate to the `/markdown/<name-of-codelab>` directory
2. Compile and start the claat server by running `npm run watch`. Note: This will open a tab in your browser and serve your markdown file
3. Edit your `<name-of-codelab>.md` file in your text editor of choice
4. When ready, run the export script as follows `./export.sh`

> aside negative
> If you're using Windows make sure to set your text editor to use UNIX line endings!

> aside positive
> Exporting your codelab will create the html static files under the `codelabs/<name-of-codelab>` directory

🚀 Go ahead to **Step 8** and add your codelabs on the main repo

## Add your Codelab to solace.dev/codelabs

Duration: 0:05:00

### Stage your Codelab

Add your changes and any newly created files, then commit & push the changes. From your **codelabs root** directory, execute:

```bash
cd solace-dev-codelabs
git add .
git commit -m 'Added or Updated <header-metadata-id> codelab'
git push origin add-codelab-<id>
```

### Create a Pull Request

Now that your changes have been pushed to a new branch, navigate to your fork `https://github.com/<Your_Github_User>/solace-dev-codelabs` and create a pull request against master.

Since your commit has already been pushed you should see a highlighted box near the top of the page; Choose the "Pull Request" button next to it and fill out the form with comments on what changes are being requested. Upon submitting the Pull Request the Codelabs team will be notified, perform a review and ensure the codelab goes live on the site.

> aside positive
> We recommend a technical review of the codelab to verify the technical steps and make sure they work as mentioned in the codelab.

### Thank You!

Thank you for contributing to Solace Codelabs!
Please reach out to the Solace DevRel team with any questions.

<video id="DchYaYXwhTk"></video>

![https://codepen.io/tzoght/embed/yRNZaP](https://en.wikipedia.org/wiki/File:Example.jpg "Try Me Publisher")

<form>
  <name>This is your last chance. Take the ...</name>
  <input type="radio" value="blue pill">
  <input type="radio" value="red pill">
</form>

> aside positive
> Você deseja obter a certificação Codaqui para trilha de desenvolvimento em Python? Inscreva-se [clicando aqui.](https://classroom.github.com/a/NxcWpy-1)

> Recomendamos que estude antes de se inscrever, e caso tenha qualquer dúvida entre em contato por e-mail [contato@codaqui.dev](mailto:contato@codaqui.dev)