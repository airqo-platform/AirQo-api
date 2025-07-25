const { execSync } = require("child_process");

// Platform detection
const isWindows = process.platform === "win32";

// Auth Service specific patterns to identify cron jobs and related processes
const AUTH_SERVICE_JOB_PATTERNS = [
  // General cron patterns
  "cron",
  "node-cron",
  "schedule",
  "job",

  // Auth Service specific job patterns
  "incomplete-profile",
  "token-expiration",
  "active-status-job",
  "preferences-log",
  "preferences-update",
  "profile-picture-update",
  "role-init",
  "user-activities",

  // Auth Service patterns
  "auth-service",
  "user-management",
  "authentication",

  // Framework patterns
  "nodemon",
  "./bin",
  "/bin/jobs",
  "background",
  "worker",

  // Mail/notification related (common in auth services)
  "mailer",
  "notification",
  "reminder",
  "email-job",
];

// Safe patterns to NEVER kill (protect system processes)
const PROTECTED_PATTERNS = [
  "system",
  "root",
  "/usr/bin",
  "/usr/local/bin",
  "npm install",
  "package-lock",
  "node_modules/.bin",
  "vscode",
  "code",
  "electron",
  "chrome",
  "firefox",
  "safari",
];

/**
 * Emergency script to find and kill ALL auth service cron jobs and related processes
 */
function findAndKillAllAuthJobs() {
  try {
    console.log(
      "🚨 EMERGENCY AUTH SERVICE: Searching for ALL cron jobs and related Node.js processes..."
    );

    let allNodeProcesses = [];
    let relevantProcesses = [];

    if (isWindows) {
      console.log("🔍 Scanning Windows Node.js processes...");

      // Get all Node.js processes with command line details
      try {
        const wmicResult = execSync(
          "wmic process where \"name='node.exe'\" get ProcessId,CommandLine /format:csv"
        ).toString();
        allNodeProcesses = wmicResult
          .split("\n")
          .filter((line) => line.trim() && line.includes("node"))
          .map((line) => {
            const parts = line.split(",");
            const pid = parts[parts.length - 1]?.trim();
            const commandLine = parts.slice(1, -1).join(",");
            return {
              pid,
              commandLine: commandLine || "Unknown Command",
              platform: "windows",
            };
          })
          .filter((proc) => proc.pid && /^\d+$/.test(proc.pid));
      } catch (wmicError) {
        console.log("⚠️  WMIC failed, using fallback method...");

        // Fallback: Get PIDs from tasklist
        const tasklistResult = execSync(
          'tasklist /FI "IMAGENAME eq node.exe" /FO CSV'
        ).toString();
        allNodeProcesses = tasklistResult
          .split("\n")
          .slice(1) // Skip header
          .filter((line) => line.trim())
          .map((line) => {
            const parts = line.split(",").map((part) => part.replace(/"/g, ""));
            return {
              pid: parts[1],
              commandLine: `${parts[0]} (Memory: ${parts[4]})`,
              platform: "windows",
            };
          })
          .filter((proc) => proc.pid && /^\d+$/.test(proc.pid));
      }
    } else {
      console.log("🔍 Scanning Unix/Linux Node.js processes...");

      // Get all Node.js processes
      const result = execSync("ps aux | grep node | grep -v grep").toString();

      if (result) {
        allNodeProcesses = result
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            return {
              pid: parts[1],
              user: parts[0],
              cpu: parts[2],
              memory: parts[3],
              commandLine: parts.slice(10).join(" "),
              platform: "unix",
            };
          })
          .filter((proc) => proc.pid && /^\d+$/.test(proc.pid));
      }
    }

    console.log(`📊 Found ${allNodeProcesses.length} total Node.js processes`);

    // Filter processes based on auth service patterns
    console.log("🎯 Filtering auth service relevant processes...");

    relevantProcesses = allNodeProcesses.filter((proc) => {
      const commandLine = proc.commandLine.toLowerCase();

      // Skip protected processes
      const isProtected = PROTECTED_PATTERNS.some((pattern) =>
        commandLine.includes(pattern.toLowerCase())
      );

      if (isProtected) {
        return false;
      }

      // Include processes matching our auth service patterns
      const isRelevant = AUTH_SERVICE_JOB_PATTERNS.some((pattern) =>
        commandLine.includes(pattern.toLowerCase())
      );

      return isRelevant;
    });

    // Also show potentially dangerous processes for manual review
    const potentiallyDangerous = allNodeProcesses.filter((proc) => {
      const commandLine = proc.commandLine.toLowerCase();
      const isProtected = PROTECTED_PATTERNS.some((pattern) =>
        commandLine.includes(pattern.toLowerCase())
      );
      const isRelevant = AUTH_SERVICE_JOB_PATTERNS.some((pattern) =>
        commandLine.includes(pattern.toLowerCase())
      );

      return !isProtected && !isRelevant;
    });

    if (relevantProcesses.length === 0) {
      console.log("✅ No auth service cron jobs or related processes found!");

      if (potentiallyDangerous.length > 0) {
        console.log(
          `\n🤔 Found ${potentiallyDangerous.length} other Node.js processes that might be relevant:`
        );
        potentiallyDangerous.slice(0, 5).forEach((proc, index) => {
          // Show max 5
          console.log(
            `${index + 1}. PID: ${proc.pid} - ${proc.commandLine.substring(
              0,
              80
            )}...`
          );
        });

        if (potentiallyDangerous.length > 5) {
          console.log(`   ... and ${potentiallyDangerous.length - 5} more`);
        }

        console.log(
          "\n💡 To kill ALL Node.js processes (DANGER), use --nuclear flag"
        );
      }

      return;
    }

    console.log(
      `\n🎯 Found ${relevantProcesses.length} auth service cron job/related process(es):`
    );
    relevantProcesses.forEach((proc, index) => {
      console.log(`${index + 1}. PID: ${proc.pid}`);
      console.log(`   User: ${proc.user || "N/A"}`);
      console.log(`   Command: ${proc.commandLine}`);
      console.log("");
    });

    // Show other processes for context
    if (potentiallyDangerous.length > 0) {
      console.log(
        `\n🤔 Also found ${potentiallyDangerous.length} other Node.js processes:`
      );
      potentiallyDangerous.slice(0, 3).forEach((proc, index) => {
        console.log(
          `${index + 1}. PID: ${proc.pid} - ${proc.commandLine.substring(
            0,
            60
          )}...`
        );
      });
      if (potentiallyDangerous.length > 3) {
        console.log(`   ... and ${potentiallyDangerous.length - 3} more`);
      }
      console.log("   (Use --nuclear to kill these too)");
    }

    // Determine what to kill based on flags
    let processesToKill = relevantProcesses;
    let killMode = "targeted";

    if (process.argv.includes("--nuclear")) {
      processesToKill = allNodeProcesses.filter((proc) => {
        const commandLine = proc.commandLine.toLowerCase();
        return !PROTECTED_PATTERNS.some((pattern) =>
          commandLine.includes(pattern.toLowerCase())
        );
      });
      killMode = "nuclear";
      console.log(
        `\n☢️  NUCLEAR MODE: Will kill ${processesToKill.length} Node.js processes!`
      );
    }

    // Safety checks
    if (!process.argv.includes("--force")) {
      console.log(
        `\n⚠️  ${killMode.toUpperCase()} MODE: To kill these processes, use --force flag:`
      );

      if (killMode === "targeted") {
        console.log("node emergency-auth-killer.js --force");
        console.log(
          "  (Kills only auth service cron jobs and related processes)"
        );
      } else {
        console.log("node emergency-auth-killer.js --nuclear --force");
        console.log(
          "  (⚠️  DANGER: Kills ALL non-protected Node.js processes)"
        );
      }

      console.log("\nAlternatives:");
      console.log(
        "node emergency-auth-killer.js --force           # Target auth jobs only"
      );
      console.log(
        "node emergency-auth-killer.js --nuclear --force # Kill all Node.js processes"
      );

      return;
    }

    // Kill the processes
    console.log(
      `\n🚀 ${killMode.toUpperCase()} MODE with --force flag detected!`
    );
    console.log(`💥 Killing ${processesToKill.length} processes...\n`);

    let successCount = 0;
    processesToKill.forEach((proc, index) => {
      console.log(
        `[${index + 1}/${processesToKill.length}] Killing PID ${proc.pid}...`
      );
      console.log(`   Command: ${proc.commandLine.substring(0, 60)}...`);

      try {
        if (isWindows) {
          execSync(`taskkill /F /PID ${proc.pid}`, { stdio: "pipe" });
        } else {
          execSync(`kill -9 ${proc.pid}`, { stdio: "pipe" });
        }
        console.log(`✅ Successfully killed PID ${proc.pid}`);
        successCount++;
      } catch (error) {
        console.log(`❌ Failed to kill PID ${proc.pid}: ${error.message}`);
      }
      console.log("");
    });

    console.log(`📊 RESULTS:`);
    console.log(`   Service: AUTH SERVICE`);
    console.log(`   Mode: ${killMode.toUpperCase()}`);
    console.log(`   Attempted: ${processesToKill.length} processes`);
    console.log(`   Successful: ${successCount} processes`);
    console.log(
      `   Failed: ${processesToKill.length - successCount} processes`
    );

    if (successCount === processesToKill.length) {
      console.log(
        "🎉 All targeted auth service processes terminated successfully!"
      );
    } else if (successCount > 0) {
      console.log(
        "⚠️  Partial success. Some processes may require elevated privileges."
      );
    } else {
      console.log(
        "❌ No processes were killed. You may need elevated privileges."
      );
    }

    // Post-cleanup verification
    console.log("\n🔍 Running post-cleanup verification...");
    setTimeout(() => {
      try {
        const checkCmd = isWindows
          ? 'tasklist /FI "IMAGENAME eq node.exe"'
          : "ps aux | grep node | grep -v grep";

        const remainingProcesses = execSync(checkCmd).toString();
        const remainingCount = remainingProcesses
          .split("\n")
          .filter(
            (line) =>
              line.trim() &&
              (isWindows ? line.includes("node.exe") : line.includes("node"))
          ).length;

        if (remainingCount === 0) {
          console.log("✅ No Node.js processes remaining!");
        } else {
          console.log(`⚠️  ${remainingCount} Node.js processes still running.`);
          console.log("   Run this script again or check manually with:");
          console.log("   npm run diagnose-jobs");
        }
      } catch (verifyError) {
        console.log("⚠️  Could not verify cleanup results.");
      }
    }, 2000);
  } catch (error) {
    console.error("❌ Error:", error.message);

    if (
      error.message.includes("not recognized") ||
      error.message.includes("command not found")
    ) {
      console.log("\n💡 Try running these manual commands:");

      if (isWindows) {
        console.log("Windows:");
        console.log("1. tasklist | findstr node");
        console.log("2. taskkill /F /PID [PID_NUMBER]");
        console.log(
          "3. taskkill /F /IM node.exe  (NUCLEAR - kills ALL Node.js)"
        );
      } else {
        console.log("Unix/Linux/macOS:");
        console.log("1. ps aux | grep node");
        console.log("2. kill -9 [PID_NUMBER]");
        console.log("3. pkill -f node  (NUCLEAR - kills ALL Node.js)");
      }
    } else if (
      error.message.includes("Permission denied") ||
      error.message.includes("Access denied")
    ) {
      console.log("\n🔐 Permission issue detected:");

      if (isWindows) {
        console.log("- Run Command Prompt as Administrator");
        console.log("- Then retry: node emergency-auth-killer.js --force");
      } else {
        console.log(
          "- Try with sudo: sudo node emergency-auth-killer.js --force"
        );
        console.log("- Or: sudo pkill -f node  (kills all Node.js processes)");
      }
    }
  }
}

// Enhanced help system
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🚨 Emergency Auth Service Job Killer

This script can find and terminate ANY running auth service cron jobs, 
background tasks, and Node.js processes related to your authentication service.

USAGE:
  node emergency-auth-killer.js                    # Preview mode (SAFE)
  node emergency-auth-killer.js --force            # Kill auth jobs only
  node emergency-auth-killer.js --nuclear --force  # Kill ALL Node.js processes

MODES:
  🎯 TARGETED MODE (default):
     - Kills auth service cron jobs and background tasks
     - Targets: incomplete-profile, token-expiration, user activities, etc.
     - Protects: system processes, editors, npm installs

  ☢️  NUCLEAR MODE (--nuclear):
     - Kills ALL Node.js processes except protected ones
     - Use when targeted mode isn't enough
     - ⚠️  DANGER: Will kill your editors, development tools, etc.

WHAT IT TARGETS (Auth Service Specific):
  ✅ Auth Service Cron Jobs:
     - incomplete-profile-job
     - token-expiration-job
     - active-status-job
     - preferences-log-job
     - preferences-update-job
     - profile-picture-update-job
     - role-init-job
     - user-activities-job

  ✅ Auth Service Processes:
     - auth-service application
     - mailer/notification services
     - authentication workers
     - user management background tasks

  ✅ General Patterns:
     - Any process with "cron", "job", "schedule"
     - nodemon, background workers
     - Processes using ./bin, /bin/jobs

  🛡️  PROTECTED (never killed):
     - System processes (/usr/bin, /usr/local/bin)
     - Code editors (vscode, code, electron)
     - Package managers (npm install, package-lock)
     - Web browsers (chrome, firefox, safari)

EXAMPLES:
  # Safe preview - see what would be killed
  node emergency-auth-killer.js

  # Kill only auth service cron jobs and related processes
  node emergency-auth-killer.js --force

  # Nuclear option - kill everything Node.js related
  node emergency-auth-killer.js --nuclear --force

  # Get this help
  node emergency-auth-killer.js --help

INTEGRATION WITH AUTH SERVICE:
  # Add to package.json scripts:
  "emergency": "node emergency-auth-killer.js",
  "emergency:force": "node emergency-auth-killer.js --force",
  "emergency:nuclear": "node emergency-auth-killer.js --nuclear --force",

  # Use with other auth service scripts:
  npm run emergency              # Preview
  npm run emergency:force        # Kill auth jobs
  npm run kill-jobs:force        # Alternative cleanup
  npm run diagnose-jobs          # Check what's running

SAFETY FEATURES:
  - Always shows what will be killed before doing it
  - Requires --force flag to actually kill anything
  - Protects important system processes
  - Auth service specific pattern matching
  - Post-cleanup verification

TROUBLESHOOTING:
  - Permission errors: Run as Administrator (Windows) or with sudo (Unix)
  - Port still in use: Check with 'npm run diagnose-jobs'
  - If nothing works: Use system commands directly
    Windows: taskkill /F /IM node.exe
    Unix:    pkill -f node

RECOVERY:
  - If you accidentally kill too much: restart your development environment
  - Check running processes: npm run diagnose-jobs
  - Restart auth service: npm run dev
`);
  process.exit(0);
}

// Run the emergency auth service killer
findAndKillAllAuthJobs();
