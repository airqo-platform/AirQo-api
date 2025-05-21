const { execSync } = require("child_process");

try {
  // Find Node.js processes that might be running your cron jobs
  console.log("Searching for Node.js processes...");

  // List all Node.js processes
  const result = execSync("ps aux | grep node").toString();
  const lines = result.split("\n");

  // Filter and identify potential cron job processes
  const cronProcesses = lines.filter(
    (line) =>
      line.includes("node") &&
      (line.includes("cron") ||
        line.includes("store-signals-job") ||
        line.includes("store-readings-job")) &&
      !line.includes("grep")
  );

  if (cronProcesses.length > 0) {
    console.log(`Found ${cronProcesses.length} potential cron processes:`);

    cronProcesses.forEach((process) => {
      console.log(process);

      // Extract PID from the process line (usually the second column)
      const pid = process.trim().split(/\s+/)[1];

      if (pid) {
        console.log(`Killing process ${pid}...`);
        try {
          execSync(`kill -9 ${pid}`);
          console.log(`Successfully killed process ${pid}`);
        } catch (killError) {
          console.error(`Failed to kill process ${pid}: ${killError.message}`);
        }
      }
    });
  } else {
    console.log("No matching cron processes found.");
  }
} catch (error) {
  console.error("Error:", error.message);
}
