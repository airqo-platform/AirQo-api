const { execSync } = require("child_process");

// Platform detection
const isWindows = process.platform === "win32";

// Command availability cache
const commandAvailability = {
  lsof: null,
  netstat: null,
  ss: null,
};

/**
 * Check if a command is available on the system
 */
function isCommandAvailable(command) {
  if (commandAvailability[command] !== null) {
    return commandAvailability[command];
  }

  try {
    if (isWindows) {
      execSync(`where ${command}`, { stdio: "pipe" });
    } else {
      execSync(`which ${command}`, { stdio: "pipe" });
    }
    commandAvailability[command] = true;
    return true;
  } catch (error) {
    commandAvailability[command] = false;
    return false;
  }
}

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
 * Find processes using a specific port with lsof (Unix/Linux)
 */
function findProcessesWithLsof(port) {
  try {
    const result = execSync(`lsof -i :${port} -t`)
      .toString()
      .trim();

    if (result) {
      return result.split("\n").filter(Boolean);
    }
    return [];
  } catch (error) {
    // Port not in use or other lsof error
    return [];
  }
}

/**
 * Find processes using a specific port with ss (modern alternative to netstat)
 */
function findProcessesWithSs(port) {
  try {
    const result = execSync(`ss -tlnp | grep :${port}`)
      .toString()
      .trim();

    if (result) {
      const pids = [];
      result.split("\n").forEach((line) => {
        // Extract PID from ss output format: users:(("process",pid=1234,fd=5))
        const pidMatch = line.match(/pid=(\d+)/);
        if (pidMatch) {
          pids.push(pidMatch[1]);
        }
      });
      return pids;
    }
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Find processes using a specific port with netstat (fallback)
 */
function findProcessesWithNetstat(port) {
  try {
    const result = execSync(`netstat -tlnp 2>/dev/null | grep :${port}`)
      .toString()
      .trim();

    if (result) {
      const pids = [];
      result.split("\n").forEach((line) => {
        // Extract PID from netstat output format: tcp ... 1234/process_name
        const pidMatch = line.match(/(\d+)\//);
        if (pidMatch) {
          pids.push(pidMatch[1]);
        }
      });
      return pids;
    }
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Find processes on Unix/Linux using multiple fallback methods
 */
function findUnixProcessesOnPort(port) {
  let pids = [];

  // Try lsof first (most reliable when available)
  if (isCommandAvailable("lsof")) {
    pids = findProcessesWithLsof(port);
    if (pids.length > 0) {
      return pids;
    }
  }

  // Try ss (modern alternative)
  if (isCommandAvailable("ss")) {
    pids = findProcessesWithSs(port);
    if (pids.length > 0) {
      return pids;
    }
  }

  // Fallback to netstat
  if (isCommandAvailable("netstat")) {
    pids = findProcessesWithNetstat(port);
    if (pids.length > 0) {
      return pids;
    }
  }

  return [];
}

/**
 * Find processes using common ports with better error handling
 */
function findProcessesOnCommonPorts() {
  const commonPorts = [3000, 3001, 3002, 8000, 8080, 8081];
  let allPortProcesses = [];
  const unavailableCommands = new Set();

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
        // Unix/Linux with multiple fallback methods
        pids = findUnixProcessesOnPort(port);

        // Track which commands are unavailable for user feedback
        if (pids.length === 0) {
          if (!isCommandAvailable("lsof")) unavailableCommands.add("lsof");
          if (!isCommandAvailable("ss")) unavailableCommands.add("ss");
          if (!isCommandAvailable("netstat"))
            unavailableCommands.add("netstat");
        }
      }

      if (pids.length > 0) {
        allPortProcesses.push({
          port,
          pids: [...new Set(pids)], // Remove duplicates
        });
      }
    } catch (error) {
      // Port not in use or command failed, continue
      console.log(`   ⚠️  Could not check port ${port}: ${error.message}`);
    }
  });

  // Inform user about missing commands
  if (unavailableCommands.size > 0 && !isWindows) {
    console.log(
      `   ⚠️  Some network commands unavailable: ${Array.from(
        unavailableCommands
      ).join(", ")}`
    );
    console.log(
      `   💡 Port scanning may be incomplete. Consider installing missing tools.`
    );
  }

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
 * Validate system requirements and provide helpful feedback
 */
function validateSystemRequirements() {
  console.log("🔧 Checking system requirements...");

  if (isWindows) {
    console.log("   ✅ Windows detected - using tasklist/netstat");
    return true;
  }

  // Check Unix/Linux tools
  const hasLsof = isCommandAvailable("lsof");
  const hasSs = isCommandAvailable("ss");
  const hasNetstat = isCommandAvailable("netstat");

  console.log(
    `   ${hasLsof ? "✅" : "❌"} lsof: ${hasLsof ? "available" : "not found"}`
  );
  console.log(
    `   ${hasSs ? "✅" : "❌"} ss: ${hasSs ? "available" : "not found"}`
  );
  console.log(
    `   ${hasNetstat ? "✅" : "❌"} netstat: ${
      hasNetstat ? "available" : "not found"
    }`
  );

  if (!hasLsof && !hasSs && !hasNetstat) {
    console.log(
      "   ⚠️  No network tools available - port scanning will be limited"
    );
    console.log(
      "   💡 Install one of: lsof, iproute2 (ss), or net-tools (netstat)"
    );
    return false;
  }

  if (!hasLsof) {
    console.log(
      "   💡 For best results, install lsof: apt-get install lsof (Ubuntu/Debian)"
    );
  }

  return true;
}

/**
 * Main cleanup function
 */
function main() {
  console.log("🧹 Starting comprehensive cleanup...");
  console.log(`📱 Platform: ${isWindows ? "Windows" : "Unix/Linux"}\n`);

  // Validate system requirements
  const hasRequiredTools = validateSystemRequirements();
  console.log("");

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
    if (!hasRequiredTools && !isWindows) {
      console.log("\n💡 Note: Limited scanning due to missing network tools.");
      console.log("   Some processes on ports might not have been detected.");
    }
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

Requirements:
  Windows: Built-in tools (tasklist, netstat)
  Unix/Linux: One or more of: lsof, ss (iproute2), netstat (net-tools)

Safety:
- Always run in preview mode first to see what will be killed
- Use --force flag only when you're sure
- This is a one-time cleanup for orphaned processes
- Works even with minimal system tools (graceful degradation)
`);
  process.exit(0);
}

// Run the cleanup
main();
