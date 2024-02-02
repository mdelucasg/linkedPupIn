# CS 579 - Project 1

Scrap LinkedIn profiles to get connections.

## Introduction

This is a simple LinkedIn scrapper based on [puppeteer](https://pptr.dev/).
The main objective is to scrape the connections of a profile in order to build a graph.

It creates a file with all the data in JSON format.

## Getting Started

Clone the repository

```
git clone https://github.com/mdelucasg/linkedPupIn
```

Enter directory

```
cd linkedPupIn
```

Install dependencies with [npm](https://yarnpkg.com/)

```
npm install
```

## Help

```
node puppetin.js -h
Usage: puppetin [options]

Scrap LinkedIn profiles

Options:
  -V, --version                  output the version number
  -c, --cookie <string>          provide li_at cookie instead of credentials
  -t, --timeout <milliseconds>   Set global timeout (default: 30000)
  --slowMo <milliseconds>        Slows down Puppeteer operations by the specified amount of time
```

## Examples

To get your cookier, you have to open Developer tools from your browser and go to Application. There, in Cookies section you will find it.

```
node puppetin.js -c <YOUR_LI_AT> --slowMo 300 --headful
```

## Manual Scrapping

In Steps.txt, we propose a manual form to get the contacts of a profile.

## License

This project is licensed under MIT license. See [LICENSE](LICENSE) for more
information.

## Disclaimer

For educational purposes only.
