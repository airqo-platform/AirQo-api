/****
 * It takes an array of JSON objects and extracts the value of a
 * specified key from each object.
 * This script creates a new array with the results of
 * calling a provided function on every element in the array.
 * 
 * SAMPLE json.txt:
 * 
 * [
    {"ipv6_prefix": "2600:f0f0:2::/48", "region": "us-east-1", "service": "AMAZON", "network_border_group": "us-east-1" },
    {
      "ipv6_prefix": "2605:9cc0:1ff0:500::/56",
      "region": "us-east-1",
      "service": "AMAZON",
      "network_border_group": "us-east-1"
    },
    {
      "ipv6_prefix": "2a05:d07a:a000::/40",
      "region": "eu-south-1",
      "service": "AMAZON",
      "network_border_group": "eu-south-1"
    },
  ]
 */

const fs = require("fs");

function extractValues(arr, key) {
  const result = arr.map((obj) => obj[key]);
  return result;
}

function readJsonFile(filePath, key) {
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error(`Error reading file from disk: ${err}`);
    } else {
      const jsonData = JSON.parse(data);
      const result = extractValues(jsonData, key);
      const date = new Date();
      const fileName = `array-${date.getFullYear()}-${
        date.getMonth() + 1
      }-${date.getDate()}.txt`;
      const formattedResult = result.map((item) => `"${item}"`).join(", ");
      fs.writeFileSync(fileName, formattedResult);
      console.log(`Result written to ${fileName}`);
    }
  });
}

readJsonFile("json.txt", "ipv6_prefix");
