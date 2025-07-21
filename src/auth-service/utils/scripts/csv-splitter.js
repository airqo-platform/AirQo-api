/****
 * The script separates a list of records separated by commas
 * where each record falls on a new line,
 * and turns the first column into an array of strings,
 * 
 * SAMPLE csv.txt
 * 
2600:3c00::/32,US,US-TX,Richardson,
2600:3c01::/32,US,US-CA,Fremont,
2600:3c02::/32,US,US-GA,Atlanta,
2400:8903::/32,US,US-NJ,Cedar Knolls
 */

const fs = require("fs");
const readline = require("readline");

function processLine(line, columnIndex, result) {
  const columns = line.split(",");
  if (columns[columnIndex]) {
    result.push(columns[columnIndex]);
  }
}

function readFile(filePath, columnIndex) {
  const result = [];
  const lineReader = readline.createInterface({
    input: fs.createReadStream(filePath),
    output: process.stdout,
    terminal: false,
  });

  lineReader.on("line", function (line) {
    processLine(line, columnIndex, result);
  });

  lineReader.on("close", function () {
    const date = new Date();
    const fileName = `array-${date.getFullYear()}-${
      date.getMonth() + 1
    }-${date.getDate()}.txt`;
    const formattedResult = result.map((item) => `"${item}"`).join(", ");
    fs.writeFileSync(fileName, formattedResult);
    console.log(`Result written to ${fileName}`);
  });
}

readFile("csv.txt", 0);
