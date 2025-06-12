const { execSync } = require("child_process");
const os = require("os");

// Target job names specific to device-registry service
const TARGET_JOB_PATTERNS = [
  "store-signals-job",
  "v2.1-store-readings-job",
  "v2.1-check-network-status-job",
  "check-unassigned-devices-job",
  "check-active-statuses",
  "check-unassigned-sites-job",
  "check-duplicate-site-fields-job",
  "update-duplicate-site-fields-job",
  "health-tip-checker-job",
  "run-migrations",
  "cron",
];

// Service identifier to ensure we only target our specific service
const SERVICE_IDENTIFIER = "device-registry";

/**
 * Validate that a string is a valid process ID
 * @param {string} pid - Process ID to validate
 * @returns {boolean} - True if valid PID
 */
function isValidPid(pid) {
  return /^\d+$/.test(pid.toString().trim()) && parseInt(pid) > 0;
}

/**
 * Find Node.js processes across different platforms
 * @returns {string} - Raw command output
 */
function findNodeProcesses() {
  try {
    const platform = os.platform();
    let cmd = "";

    if (platform === "win32") {
      // Windows: Use tasklist to find Node.js processes
      cmd = 'tasklist /FI "IMAGENAME eq node.exe" /FO CSV';
    } else {
      // Unix/Linux/MacOS: Use ps to find Node.js processes
      cmd = "ps aux | grep node";
    }

    return execSync(cmd, { encoding: "utf8" });
  } catch (error) {
    if (error.status === 1) {
      return ""; // No processes found
    }
    throw error;
  }
}

/**
 * Parse process information from command output
 * @param {string} output - Raw command output
 * @returns {Array} - Array of process objects {pid, commandLine}
 */
function parseProcessInfo(output) {
  if (!output) return [];

  const platform = os.platform();
  const lines = output.split("\n").filter((line) => line.trim());

  if (platform === "win32") {
    // Windows tasklist CSV format parsing
    return lines
      .slice(1) // Skip header
      .map((line) => {
        const parts = line.split(",").map((part) => part.replace(/"/g, ""));
        return {
          pid: parts[1],
          commandLine: parts[0], // Image name
        };
      })
      .filter((proc) => proc.pid && isValidPid(proc.pid));
  } else {
    // Unix/Linux/MacOS ps output parsing
    return lines
      .filter(
        (line) => line.includes("node") && !line.includes("grep") // Exclude the grep process itself
      )
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parts[1],
          commandLine: line,
        };
      })
      .filter((proc) => proc.pid && isValidPid(proc.pid));
  }
}

/**
 * Check if a process matches our target criteria
 * @param {Object} processInfo - Process information object
 * @returns {boolean} - True if process should be targeted
 */
function isTargetProcess(processInfo) {
  const { commandLine } = processInfo;

  // Must include our service identifier
  const hasServiceIdentifier = commandLine.includes(SERVICE_IDENTIFIER);

  // Must match at least one of our target job patterns
  const hasTargetPattern = TARGET_JOB_PATTERNS.some((pattern) =>
    commandLine.includes(pattern)
  );

  return hasServiceIdentifier && hasTargetPattern;
}

/**
 * Kill a process with platform-specific commands
 * @param {string} pid - Process ID to kill
 * @param {boolean} graceful - Whether to attempt graceful termination first
 * @returns {boolean} - True if process was successfully terminated
 */
function killProcess(pid, graceful = true) {
  if (!isValidPid(pid)) {
    console.error(`Invalid process ID: ${pid}`);
    return false;
  }

  try {
    const platform = os.platform();

    if (platform === "win32") {
      // Windows: Use taskkill
      const force = graceful ? "" : "/F";
      execSync(`taskkill /PID ${pid} ${force}`, { stdio: "pipe" });
    } else {
      // Unix/Linux/MacOS: Use kill
      const signal = graceful ? "TERM" : "KILL";
      execSync(`kill -${signal} ${pid}`, { stdio: "pipe" });
    }

    return true;
  } catch (error) {
    console.error(
      `Failed to ${
        graceful ? "gracefully terminate" : "force kill"
      } process ${pid}:`,
      error.message
    );
    return false;
  }
}

/**
 * Wait for a process to terminate
 * @param {string} pid - Process ID to check
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} - True if process terminated
 */
function waitForProcessToExit(pid, timeout = 5000) {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkProcess = () => {
      try {
        const platform = os.platform();

        if (platform === "win32") {
          execSync(`tasklist /FI "PID eq ${pid}"`, { stdio: "pipe" });
        } else {
          execSync(`kill -0 ${pid}`, { stdio: "pipe" });
        }

        // Process still exists
        if (Date.now() - startTime >= timeout) {
          resolve(false); // Timeout reached
        } else {
          setTimeout(checkProcess, 100); // Check again in 100ms
        }
      } catch (error) {
        // Process no longer exists
        resolve(true);
      }
    };

    checkProcess();
  });
}

/**
 * Main function to kill device-registry cron job processes
 */
async function main() {
  try {
    console.log("Searching for Node.js processes...");

    const processOutput = findNodeProcesses();
    const allProcesses = parseProcessInfo(processOutput);

    // Filter processes that match our criteria
    const targetProcesses = allProcesses.filter(isTargetProcess);

    if (targetProcesses.length === 0) {
      console.log(`No matching ${SERVICE_IDENTIFIER} cron processes found.`);
      return;
    }

    // Check for --force flag
    const forceFlag = process.argv.includes("--force");

    if (!forceFlag) {
      console.log("Found the following processes that will be terminated:");
      targetProcesses.forEach((proc) => {
        console.log(`PID: ${proc.pid} - ${proc.commandLine}`);
      });
      console.log("\nRun with --force to proceed with termination");
      console.log("Example: npm run kill-jobs -- --force");
      process.exit(0);
    }

    console.log(
      `Found ${targetProcesses.length} ${SERVICE_IDENTIFIER} cron process(es) - terminating due to --force flag:`
    );

    for (const processInfo of targetProcesses) {
      const { pid, commandLine } = processInfo;

      console.log(`\nProcessing PID: ${pid}`);
      console.log(`Command: ${commandLine}`);
      console.log(`Attempting graceful termination of process ${pid}...`);

      // Try graceful termination first
      const gracefulSuccess = killProcess(pid, true);

      if (gracefulSuccess) {
        // Wait for the process to actually exit
        const exited = await waitForProcessToExit(pid, 5000);

        if (exited) {
          console.log(`✅ Process ${pid} terminated gracefully.`);
          continue;
        } else {
          console.log(
            `⚠️  Process ${pid} did not exit gracefully, forcing termination...`
          );
        }
      }

      // Force kill if graceful termination failed or timed out
      const forceSuccess = killProcess(pid, false);

      if (forceSuccess) {
        console.log(`✅ Process ${pid} force terminated.`);
      } else {
        console.error(`❌ Failed to terminate process ${pid}.`);
      }
    }

    console.log("\n🎉 Process termination complete.");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Handle script termination gracefully
process.on("SIGINT", () => {
  console.log("\n⚠️  Script interrupted by user");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Script terminated");
  process.exit(0);
});

// Run the script
main();
