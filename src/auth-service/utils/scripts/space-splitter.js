/*****
 *
 * This script will split the string by any amount of
 * whitespace, filter out any empty strings,
 * surround each IP address with double quotes,
 * join the array of strings into a single string
 * where each IP address is separated by a comma,
 * then split the string again into an array of single characters,
 * and finally join the array of characters into a single string
 * where each character is on a new line. It will then write this
 * string to a text file with a name that includes today's day.
 *
 */

const fs = require("fs");

let ipList = `51.15.78.0	51.15.78.1	
51.15.78.12	51.15.78.13		
51.15.78.96	51.15.78.97	51.15.78.100	51.15.78.101
`;

// Split the string into an array of IP addresses, using \s+ to match any amount of whitespace
let ipArray = ipList.split(/\s+/);

// Remove any empty strings from the array
ipArray = ipArray.filter((ip) => ip !== "");

// Surround each IP address with double quotes
ipArray = ipArray.map((ip) => `"${ip}",`);

// Join the array of strings into a single string separated by commas
let formattedIPAddresses = ipArray.join("\n");

// Create filename with today's date
const date = new Date();
const fileName = `array-${date.getFullYear()}-${
  date.getMonth() + 1
}-${date.getDate()}.txt`;

// Write the formatted IP addresses to the file
fs.writeFile(fileName, formattedIPAddresses, (err) => {
  if (err) throw err;
  console.log(`IP addresses saved to ${fileName}`);
});
