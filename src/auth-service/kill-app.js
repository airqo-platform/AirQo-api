const { execSync } = require("child_process");

try {
  // Platform detection
  const isWindows = process.platform === "win32";

  console.log(`Detected platform: ${isWindows ? "Windows" : "Unix/Linux"}`);

  // Find processes using port 3000
  try {
    // Command based on platform
    let pids = [];

    if (isWindows) {
      console.log("Using Windows commands to find processes...");
      const result = execSync(
        "netstat -ano | findstr :3000 | findstr LISTENING"
      )
        .toString()
        .trim();

      if (result) {
        // Extract PIDs from netstat output (last column)
        pids = result
          .split("\n")
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            return parts[parts.length - 1];
          })
          .filter((pid) => /^\d+$/.test(pid));

        // Remove duplicates
        pids = [...new Set(pids)];
      }
    } else {
      console.log("Using Unix/Linux commands to find processes...");
      const result = execSync("lsof -i :3000 -t").toString().trim();

      if (result) {
        pids = result.split("\n").filter(Boolean);
      }
    }

    if (pids.length > 0) {
      console.log(`Found ${pids.length} process(es) using port 3000:`);

      // Optional: Show more info about processes before killing
      if (!isWindows) {
        try {
          console.log("Process details:");
          execSync(`ps -p ${pids.join(",")} -o pid,ppid,user,command`)
            .toString()
            .split("\n")
            .forEach((line) => console.log(`  ${line}`));
        } catch (detailsError) {
          console.log("Could not get detailed process info");
        }
      }

      // Add confirmation for safety
      if (process.argv.indexOf("--force") === -1) {
        console.log("\nTo kill these processes, run with --force flag");
        process.exit(0);
      }

      // Kill processes if --force is provided
      pids.forEach((pid) => {
        console.log(`Killing process ${pid}...`);
        const killCommand = isWindows
          ? `taskkill /F /PID ${pid}`
          : `kill -9 ${pid}`;

        try {
          execSync(killCommand);
          console.log(`Successfully terminated process ${pid}`);
        } catch (killError) {
          console.error(`Failed to kill process ${pid}: ${killError.message}`);
        }
      });

      console.log("All matching processes have been terminated.");
    } else {
      console.log("No processes found using port 3000.");
    }
  } catch (cmdError) {
    if (cmdError.status === 1 || cmdError.status === 2) {
      console.log("No processes found using port 3000.");
    } else {
      throw cmdError; // Re-throw for the outer catch
    }
  }
} catch (error) {
  console.error("Error:", error.message);

  // Provide helpful message for common issues
  if (isWindows && error.message.includes("is not recognized")) {
    console.log(
      "\nTip: Make sure you're running this from a command prompt with admin privileges"
    );
  } else if (error.message.includes("Permission denied")) {
    console.log(
      "\nTip: You may need to run this script with sudo (Unix/Linux)"
    );
  }
}
