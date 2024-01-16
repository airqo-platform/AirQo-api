const fs = require("fs");
const moment = require("moment");

// Read the logs
let logs = fs.readFileSync("logs.txt", "utf8").split("\n");

console.log("\u{1F4C0} Reading logs..."); // Progress indicator

// Filter the logs
let filteredLogs = [];
logs.forEach((log, index) => {
  console.log(`\u{1F9E0} Processing log ${index + 1} of ${logs.length}...`); // Progress indicator
  let parts = log.split(
    " -- event-model - :low_battery::low_battery: Last refreshed time difference exceeds 14 hours for device: "
  );
  if (parts.length === 2) {
    let details = parts[1].split(",");
    if (details.length >= 4) {
      let deviceName = details[0];
      let frequency = details[1].replace("Frequency: ", "").trim();
      let timeStr = details[2].replace("Time: ", "").trim();
      let siteName = details[3].replace("Site Name: ", "").trim();
      let time = moment(timeStr, "ddd MMM DD YYYY HH:mm:ss ZZ");
      if (moment().diff(time, "hours") > 14) {
        filteredLogs.push({ deviceName, frequency, time, siteName });
      }
    }
  }
});

console.log("\u{1F64C} Logs processed successfully!"); // Progress indicator

// Ensure no duplicate device names
filteredLogs = filteredLogs.filter(
  (value, index, self) =>
    index === self.findIndex((t) => t.deviceName === value.deviceName)
);

// Get the current date and time
let now = new Date();
let dateStr = now
  .toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  })
  .replace(/ /g, "_");

// Convert the date string to lowercase
dateStr = dateStr.toLowerCase();

// Create a writable stream to the CSV file with the date in the filename
let csvStream = fs.createWriteStream(
  `report_${dateStr}devices_last_sent_measurements_over_14_hours_ago.csv`
);

console.log("\u{1F4AA} Writing report to CSV file..."); // Progress indicator

// Write the title to the CSV file
csvStream.write("Title: Devices Last Sent Measurements Over 14 Hours Ago\n");

// Write the headers to the CSV file
csvStream.write("Device Name,Frequency,Time,Site Name\n");

let count = 0;
filteredLogs.forEach((log) => {
  console.log(
    `\u{1F58A} Writing log ${count + 1} of ${
      filteredLogs.length
    } to CSV file...`
  ); // Progress indicator
  csvStream.write(
    `${log.deviceName},${log.frequency},${log.time.toString()},${
      log.siteName
    }\n`
  );
  count++;
});

console.log("\u{1F514} Report written to CSV file successfully!"); // Progress indicator

// Close the CSV file and print the first three lines of the CSV output to the console
csvStream.end(() => {
  console.log(
    "\u{1F37B} Printing first three lines of CSV output to console..."
  ); // Progress indicator
  let csvOutput = fs
    .readFileSync(
      `report_${dateStr}devices_last_sent_measurements_over_14_hours_ago.csv`,
      "utf8"
    )
    .split("\n")
    .slice(0, 3);
  console.log(csvOutput.join("\n"));
});
