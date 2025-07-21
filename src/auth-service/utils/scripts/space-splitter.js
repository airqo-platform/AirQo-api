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

function convertIP(ip) {
  // Split the IP address into octets
  let octets = ip.split(".");

  // Replace the third and last octet with "0" if they contain "xxx"
  if (octets[2].includes("xxx")) octets[2] = "0";
  if (octets[3].includes("xxx")) octets[3] = "0";

  // Join the octets back together
  let newIP = octets.join(".");

  // Append "/16" to the end of the IP address
  // newIP += "/16";

  return newIP;
}

let ipList = `
129.91.32.0/21
129.91.48.0/20
`;

// Split the string into an array of IP addresses, using \s+ to match any amount of whitespace
// let ipArray = ipList.split(/\s+/);

let ipArray = ipList.split(/[\s,]+/);

// Remove any empty strings from the array
ipArray = ipArray.filter((ip) => ip !== "");

// uncomment the following line for cases we need to explicitly convert the ip ranges to
// to the cicdr format.....
// ipArray = ipArray.map((ip) => convertIP(ip));

// Remove duplicate IP addresses
ipArray = Array.from(new Set(ipArray));

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
