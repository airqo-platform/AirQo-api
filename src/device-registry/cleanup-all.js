const { execSync } = require("child_process");

// Platform detection
const isWindows = process.platform === "win32";

/**
 * Find all Node.js processes that might be related to your applications
 */
function findAllNodeProcesses() {
  try {
    let processes = [];

    if (isWindows) {
      console.log("🔍 Scanning Windows processes...");
      const result = execSync(
        'tasklist /FI "IMAGENAME eq node.exe" /FO CSV'
      ).toString();

      const lines = result.split("\n").slice(1); // Skip header
      processes = lines
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(",").map((part) => part.replace(/"/g, ""));
          return {
            pid: parts[1],
            name: parts[0],
            memory: parts[4],
            commandLine: `${parts[0]} (PID: ${parts[1]}, Memory: ${parts[4]})`,
          };
        })
        .filter((proc) => proc.pid && /^\d+$/.test(proc.pid));
    } else {
      console.log("🔍 Scanning Unix/Linux processes...");
      const result = execSync("ps aux | grep node").toString();

      processes = result
        .split("\n")
        .filter(
          (line) =>
            line.includes("node") &&
            !line.includes("grep") &&
            !line.includes("ps aux")
        )
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parts[1],
            user: parts[0],
            cpu: parts[2],
            memory: parts[3],
            commandLine: parts.slice(10).join(" "),
          };
        })
        .filter((proc) => proc.pid && /^\d+$/.test(proc.pid));
    }

    return processes;
  } catch (error) {
    console.error("❌ Error finding processes:", error.message);
    return [];
  }
}

/**
 * Filter processes that might be related to your applications
 */
function filterRelevantProcesses(processes) {
  const relevantKeywords = [
    "device-registry",
    "auth-service",
    "cron",
    "job",
    "store-signals",
    "store-readings",
    "check-network-status",
    "check-unassigned",
    "check-active-statuses",
    "health-tip-checker",
    "migration",
    "nodemon",
    "./bin",
  ];

  return processes.filter((proc) => {
    const commandLine = proc.commandLine.toLowerCase();
    return relevantKeywords.some((keyword) => commandLine.includes(keyword));
  });
}

/**
 * Find processes using common ports
 */
function findProcessesOnCommonPorts() {
  const commonPorts = [3000, 3001, 3002, 8000, 8080, 8081];
  let allPortProcesses = [];

  commonPorts.forEach((port) => {
    try {
      let pids = [];

      if (isWindows) {
        const result = execSync(
          `netstat -ano | findstr :${port} | findstr LISTENING`
        )
          .toString()
          .trim();

        if (result) {
          pids = result
            .split("\n")
            .map((line) => {
              const parts = line.trim().split(/\s+/);
              return parts[parts.length - 1];
            })
            .filter((pid) => /^\d+$/.test(pid));
        }
      } else {
        const result = execSync(`lsof -i :${port} -t`)
          .toString()
          .trim();
        if (result) {
          pids = result.split("\n").filter(Boolean);
        }
      }

      if (pids.length > 0) {
        allPortProcesses.push({
          port,
          pids: [...new Set(pids)], // Remove duplicates
        });
      }
    } catch (error) {
      // Port not in use, continue
    }
  });

  return allPortProcesses;
}

/**
 * Kill a process with validation
 */
function killProcess(pid) {
  try {
    if (isWindows) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "pipe" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "pipe" });
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Main cleanup function
 */
function main() {
  console.log("🧹 Starting comprehensive cleanup...");
  console.log(`📱 Platform: ${isWindows ? "Windows" : "Unix/Linux"}\n`);

  // Step 1: Find all Node.js processes
  console.log("📊 STEP 1: Finding all Node.js processes...");
  const allNodeProcesses = findAllNodeProcesses();
  console.log(`   Found ${allNodeProcesses.length} Node.js processes total\n`);

  // Step 2: Filter relevant processes
  console.log("🎯 STEP 2: Filtering relevant processes...");
  const relevantProcesses = filterRelevantProcesses(allNodeProcesses);

  if (relevantProcesses.length > 0) {
    console.log(
      `   Found ${relevantProcesses.length} potentially relevant processes:`
    );
    relevantProcesses.forEach((proc, index) => {
      console.log(`   ${index + 1}. PID: ${proc.pid} - ${proc.commandLine}`);
    });
  } else {
    console.log("   ✅ No relevant Node.js processes found");
  }
  console.log("");

  // Step 3: Find processes on common ports
  console.log("🔌 STEP 3: Checking common ports...");
  const portProcesses = findProcessesOnCommonPorts();

  if (portProcesses.length > 0) {
    console.log("   Found processes on these ports:");
    portProcesses.forEach(({ port, pids }) => {
      console.log(`   Port ${port}: PIDs ${pids.join(", ")}`);
    });
  } else {
    console.log("   ✅ No processes found on common ports");
  }
  console.log("");

  // Combine all processes to kill
  const allPidsToKill = new Set();

  // Add relevant Node processes
  relevantProcesses.forEach((proc) => allPidsToKill.add(proc.pid));

  // Add port processes
  portProcesses.forEach(({ pids }) => {
    pids.forEach((pid) => allPidsToKill.add(pid));
  });

  const uniquePidsToKill = Array.from(allPidsToKill);

  if (uniquePidsToKill.length === 0) {
    console.log("🎉 No cleanup needed! No relevant processes found.");
    return;
  }

  // Safety check
  if (process.argv.indexOf("--force") === -1) {
    console.log("⚠️  SUMMARY:");
    console.log(`   ${uniquePidsToKill.length} processes will be terminated:`);
    console.log(`   PIDs: ${uniquePidsToKill.join(", ")}\n`);

    console.log("🛡️  To proceed with cleanup, run with --force flag:");
    console.log("   node cleanup-all.js --force");
    console.log("   npm run cleanup:all -- --force\n");
    return;
  }

  // Actually kill the processes
  console.log("🚀 STEP 4: Terminating processes...");
  let successCount = 0;

  uniquePidsToKill.forEach((pid, index) => {
    console.log(
      `   [${index + 1}/${uniquePidsToKill.length}] Killing PID ${pid}...`
    );

    if (killProcess(pid)) {
      console.log(`   ✅ Successfully terminated PID ${pid}`);
      successCount++;
    } else {
      console.log(`   ❌ Failed to terminate PID ${pid}`);
    }
  });

  console.log("");
  console.log("📋 CLEANUP SUMMARY:");
  console.log(`   Attempted: ${uniquePidsToKill.length} processes`);
  console.log(`   Successful: ${successCount} processes`);
  console.log(`   Failed: ${uniquePidsToKill.length - successCount} processes`);

  if (successCount === uniquePidsToKill.length) {
    console.log("🎉 All processes cleaned up successfully!");
  } else if (successCount > 0) {
    console.log(
      "⚠️  Partial cleanup completed. Some processes may require manual intervention."
    );
  } else {
    console.log("❌ Cleanup failed. You may need elevated privileges.");

    if (isWindows) {
      console.log("💡 Try running as Administrator");
    } else {
      console.log("💡 Try running with sudo: sudo node cleanup-all.js --force");
    }
  }
}

// Handle help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🧹 Comprehensive Cleanup Tool

This script finds and terminates Node.js processes that might be:
- Related to your applications (device-registry, auth-service)
- Running cron jobs or background tasks
- Using common development ports (3000, 3001, 8000, etc.)

Usage:
  node cleanup-all.js                 # Preview mode (safe)
  node cleanup-all.js --force         # Actually kill processes
  npm run cleanup:all                 # Preview mode via npm
  npm run cleanup:all -- --force      # Force mode via npm

Safety:
- Always run in preview mode first to see what will be killed
- Use --force flag only when you're sure
- This is a one-time cleanup for orphaned processes
`);
  process.exit(0);
}

// Run the cleanup
main();
