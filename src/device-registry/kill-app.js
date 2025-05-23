const { execSync } = require("child_process");

// Make port configurable via environment variable or command line argument
const PORT = process.env.PORT || process.argv[2] || 3000;

// Platform detection - simpler and more direct
const isWindows = process.platform === "win32";

/**
 * Validate that a string is a valid process ID
 * @param {string} pid - Process ID to validate
 * @returns {boolean} - True if valid PID
 */
function isValidPid(pid) {
  return /^\d+$/.test(pid.toString().trim()) && parseInt(pid) > 0;
}

/**
 * Find processes using a specific port across different platforms
 * @param {number} port - The port number to check
 * @returns {string[]} - Array of process IDs
 */
function findProcessesOnPort(port) {
  try {
    let pids = [];

    if (isWindows) {
      console.log("Using Windows commands to find processes...");
      // More specific Windows filtering - only LISTENING processes
      const result = execSync(
        `netstat -ano | findstr :${port} | findstr LISTENING`
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
          .filter((pid) => pid && isValidPid(pid));

        // Remove duplicates using Set
        pids = [...new Set(pids)];
      }
    } else {
      console.log("Using Unix/Linux commands to find processes...");
      const result = execSync(`lsof -i :${port} -t`)
        .toString()
        .trim();

      if (result) {
        pids = result
          .split("\n")
          .map((pid) => pid.trim())
          .filter((pid) => pid && isValidPid(pid));

        // Remove duplicates using Set
        pids = [...new Set(pids)];
      }
    }

    return pids;
  } catch (error) {
    if (error.status === 1 || error.status === 2) {
      return []; // No processes found
    }
    throw error;
  }
}

/**
 * Display detailed process information (Unix/Linux only)
 * @param {string[]} pids - Array of process IDs
 */
function showProcessDetails(pids) {
  if (isWindows || pids.length === 0) return;

  try {
    console.log("\nProcess details:");
    const output = execSync(`ps -p ${pids.join(",")} -o pid,ppid,user,command`)
      .toString()
      .split("\n");

    output.forEach((line) => {
      if (line.trim()) {
        console.log(`  ${line}`);
      }
    });
    console.log("");
  } catch (detailsError) {
    console.log("Could not get detailed process info\n");
  }
}

/**
 * Check if a process is still running
 * @param {string} pid - Process ID to check
 * @returns {boolean} - True if process is still running
 */
function isProcessRunning(pid) {
  try {
    if (isWindows) {
      execSync(`tasklist /FI "PID eq ${pid}"`, { stdio: "pipe" });
      // On Windows, tasklist returns success even if process doesn't exist
      // We need to check the output
      const output = execSync(`tasklist /FI "PID eq ${pid}"`).toString();
      return output.includes(pid);
    } else {
      execSync(`ps -p ${pid}`, { stdio: "pipe" });
      return true;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Wait for a process to terminate (synchronous approach)
 * @param {string} pid - Process ID to check
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {boolean} - True if process terminated within timeout
 */
function waitForProcessToExit(pid, timeout = 3000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    // Sleep for 100ms before checking again
    execSync("ping localhost -n 1 > nul", { stdio: "pipe" }); // Windows
    if (!isWindows) {
      execSync("sleep 0.1", { stdio: "pipe" }); // Unix/Linux
    }
  }

  return false;
}

/**
 * Kill a process with graceful termination attempt followed by force kill if needed
 * @param {string} pid - Process ID to kill
 * @returns {boolean} - True if process was successfully terminated
 */
function killProcess(pid) {
  if (!isValidPid(pid)) {
    console.error(`Invalid process ID: ${pid}`);
    return false;
  }

  try {
    console.log(`Attempting to kill process ${pid} gracefully...`);

    // Step 1: Try graceful termination
    const gracefulKillCommand = isWindows
      ? `taskkill /PID ${pid}`
      : `kill -15 ${pid}`; // SIGTERM

    try {
      execSync(gracefulKillCommand, { stdio: "pipe" });
      console.log(`Successfully sent termination signal to process ${pid}`);

      // Wait for graceful termination
      if (waitForProcessToExit(pid, 3000)) {
        console.log(`✅ Process ${pid} terminated gracefully.`);
        return true;
      }

      console.log(
        `⚠️  Process ${pid} did not terminate gracefully. Forcing termination...`
      );
    } catch (gracefulError) {
      console.log(
        `⚠️  Graceful termination failed for process ${pid}. Forcing termination...`
      );
    }

    // Step 2: Force kill
    const forceKillCommand = isWindows
      ? `taskkill /F /PID ${pid}`
      : `kill -9 ${pid}`; // SIGKILL

    execSync(forceKillCommand, { stdio: "pipe" });
    console.log(`✅ Successfully force terminated process ${pid}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to kill process ${pid}: ${error.message}`);
    return false;
  }
}

/**
 * Main function to kill processes using the specified port
 */
function main() {
  try {
    console.log(
      `🔍 Detected platform: ${isWindows ? "Windows" : "Unix/Linux"}`
    );
    console.log(`🔍 Finding processes using port ${PORT}...`);

    const pids = findProcessesOnPort(PORT);

    if (pids.length === 0) {
      console.log(`✅ No processes found using port ${PORT}.`);
      return;
    }

    console.log(`🎯 Found ${pids.length} process(es) using port ${PORT}:`);
    console.log(`   PIDs: ${pids.join(", ")}`);

    // Show detailed process information (Unix/Linux only)
    showProcessDetails(pids);

    // Safety check: require --force flag
    if (process.argv.indexOf("--force") === -1) {
      console.log("⚠️  To kill these processes, run with --force flag");
      console.log(`   Example: npm run kill -- --force`);
      console.log(`   Example: node kill-app.js ${PORT} --force`);
      process.exit(0);
    }

    console.log("🚀 --force flag detected. Proceeding with termination...\n");

    // Kill each process
    let successCount = 0;
    pids.forEach((pid, index) => {
      console.log(`[${index + 1}/${pids.length}] Processing PID ${pid}:`);

      if (killProcess(pid)) {
        successCount++;
      }

      console.log(""); // Add spacing between processes
    });

    // Summary
    if (successCount === pids.length) {
      console.log(
        `🎉 All ${pids.length} processes have been terminated successfully.`
      );
    } else {
      console.log(
        `⚠️  ${successCount}/${pids.length} processes terminated successfully.`
      );
      if (successCount < pids.length) {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("❌ Error:", error.message);

    // Provide helpful error messages
    if (isWindows && error.message.includes("is not recognized")) {
      console.log(
        "\n💡 Tip: Make sure you're running this from a command prompt with admin privileges"
      );
    } else if (
      error.message.includes("Permission denied") ||
      error.message.includes("Operation not permitted")
    ) {
      console.log(
        "\n💡 Tip: You may need to run this script with elevated privileges"
      );
      if (!isWindows) {
        console.log("   Try: sudo npm run kill -- --force");
      }
    } else if (error.message.includes("ENOENT")) {
      console.log("\n💡 Tip: Required system commands may not be available");
      if (isWindows) {
        console.log(
          "   Make sure you're running from Command Prompt or PowerShell"
        );
      }
    }

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

// Show usage help if requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🔧 Kill App - Port Process Terminator

Usage:
  node kill-app.js [PORT] [--force] [--help]
  npm run kill [-- [PORT] [--force]]

Arguments:
  PORT          Port number to check (default: 3000)
  --force       Actually kill the processes (required for safety)
  --help, -h    Show this help message

Environment Variables:
  PORT          Set default port number

Examples:
  node kill-app.js                    # Find processes on port 3000 (preview mode)
  node kill-app.js --force            # Kill processes on port 3000
  node kill-app.js 8080 --force       # Kill processes on port 8080
  PORT=9000 node kill-app.js --force  # Kill processes on port 9000
  npm run kill -- --force             # Kill processes using npm script
  npm run kill -- 8080 --force        # Kill processes on port 8080 using npm script
`);
  process.exit(0);
}

// Run the script
main();
