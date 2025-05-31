// cleanup-all-auth.js - Comprehensive cleanup script for auth service

const { exec, execSync } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

const isWindows = process.platform === "win32";
const args = process.argv.slice(2);
const isForce = args.includes("--force");
const isVerbose = args.includes("--verbose") || args.includes("-v");

class AuthServiceCleanup {
  constructor() {
    this.results = {
      portsKilled: 0,
      jobsKilled: 0,
      processesKilled: 0,
      errors: [],
    };
  }

  log(message, force = false) {
    if (isVerbose || force) {
      console.log(message);
    }
  }

  async cleanupPorts() {
    this.log("🌐 Cleaning up auth service ports...", true);

    const ports = [3000, 3001, 3002, 3003]; // Common auth service ports

    for (const port of ports) {
      try {
        let command;
        if (isWindows) {
          command = `netstat -ano | findstr :${port}`;
        } else {
          command = `lsof -t -i:${port}`;
        }

        const { stdout } = await execAsync(command);

        if (stdout.trim()) {
          this.log(`Found process on port ${port}`);

          if (isForce) {
            if (isWindows) {
              // Extract PID from netstat output and kill
              const lines = stdout.trim().split("\n");
              for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && /^\d+$/.test(pid)) {
                  try {
                    execSync(`taskkill /F /PID ${pid}`, { stdio: "pipe" });
                    this.results.portsKilled++;
                    this.log(`✅ Killed process ${pid} on port ${port}`);
                  } catch (error) {
                    this.results.errors.push(
                      `Failed to kill PID ${pid}: ${error.message}`
                    );
                  }
                }
              }
            } else {
              const pids = stdout.trim().split("\n");
              for (const pid of pids) {
                if (pid && /^\d+$/.test(pid.trim())) {
                  try {
                    execSync(`kill -9 ${pid.trim()}`, { stdio: "pipe" });
                    this.results.portsKilled++;
                    this.log(`✅ Killed process ${pid} on port ${port}`);
                  } catch (error) {
                    this.results.errors.push(
                      `Failed to kill PID ${pid}: ${error.message}`
                    );
                  }
                }
              }
            }
          } else {
            this.log(`⚠️  Process found on port ${port} (use --force to kill)`);
          }
        }
      } catch (error) {
        this.log(`No processes found on port ${port}`);
      }
    }
  }

  async cleanupJobs() {
    this.log("🔄 Cleaning up auth service jobs...", true);

    const jobPatterns = [
      "incomplete-profile",
      "token-expiration",
      "active-status-job",
      "preferences-log",
      "preferences-update",
      "profile-picture-update",
      "role-init",
      "user-activities",
      "auth-service.*job",
      "mailer.*job",
    ];

    try {
      let command;
      if (isWindows) {
        // Windows: Get all node.exe processes and filter
        command =
          "wmic process where \"name='node.exe'\" get ProcessId,CommandLine /format:csv";
      } else {
        // Unix: Get all node processes
        command = "ps aux | grep node | grep -v grep";
      }

      const { stdout } = await execAsync(command);

      if (stdout.trim()) {
        const processes = this.parseProcesses(stdout);
        const relevantProcesses = processes.filter((proc) =>
          jobPatterns.some((pattern) =>
            proc.commandLine
              .toLowerCase()
              .match(new RegExp(pattern.toLowerCase()))
          )
        );

        this.log(
          `Found ${relevantProcesses.length} auth service job processes`
        );

        if (relevantProcesses.length > 0 && isForce) {
          for (const proc of relevantProcesses) {
            try {
              if (isWindows) {
                execSync(`taskkill /F /PID ${proc.pid}`, { stdio: "pipe" });
              } else {
                execSync(`kill -9 ${proc.pid}`, { stdio: "pipe" });
              }
              this.results.jobsKilled++;
              this.log(`✅ Killed job process ${proc.pid}`);
            } catch (error) {
              this.results.errors.push(
                `Failed to kill job PID ${proc.pid}: ${error.message}`
              );
            }
          }
        } else if (relevantProcesses.length > 0) {
          this.log(
            "⚠️  Auth service job processes found (use --force to kill)"
          );
          relevantProcesses.forEach((proc, index) => {
            this.log(
              `  ${index + 1}. PID: ${proc.pid} - ${proc.commandLine.substring(
                0,
                60
              )}...`
            );
          });
        }
      }
    } catch (error) {
      this.results.errors.push(
        `Error scanning for job processes: ${error.message}`
      );
    }
  }

  parseProcesses(stdout) {
    if (isWindows) {
      return stdout
        .split("\n")
        .filter((line) => line.trim() && line.includes("node"))
        .map((line) => {
          const parts = line.split(",");
          const pid = parts[parts.length - 1]?.trim();
          const commandLine = parts.slice(1, -1).join(",");
          return {
            pid: pid,
            commandLine: commandLine || "Unknown Command",
          };
        })
        .filter((proc) => proc.pid && /^\d+$/.test(proc.pid));
    } else {
      return stdout
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          return {
            pid: parts[1],
            commandLine: parts.slice(10).join(" "),
          };
        })
        .filter((proc) => proc.pid && /^\d+$/.test(proc.pid));
    }
  }

  async cleanupGeneralProcesses() {
    this.log("🧹 Cleaning up general auth service processes...", true);

    const generalPatterns = [
      "auth-service",
      "authentication",
      "./bin.*auth",
      "nodemon.*auth",
    ];

    try {
      let command = isWindows
        ? "wmic process where \"name='node.exe'\" get ProcessId,CommandLine /format:csv"
        : "ps aux | grep node | grep -v grep";

      const { stdout } = await execAsync(command);

      if (stdout.trim()) {
        const processes = this.parseProcesses(stdout);
        const relevantProcesses = processes.filter((proc) =>
          generalPatterns.some((pattern) =>
            proc.commandLine
              .toLowerCase()
              .match(new RegExp(pattern.toLowerCase()))
          )
        );

        if (relevantProcesses.length > 0 && isForce) {
          for (const proc of relevantProcesses) {
            try {
              if (isWindows) {
                execSync(`taskkill /F /PID ${proc.pid}`, { stdio: "pipe" });
              } else {
                execSync(`kill -9 ${proc.pid}`, { stdio: "pipe" });
              }
              this.results.processesKilled++;
              this.log(`✅ Killed general process ${proc.pid}`);
            } catch (error) {
              this.results.errors.push(
                `Failed to kill PID ${proc.pid}: ${error.message}`
              );
            }
          }
        } else if (relevantProcesses.length > 0) {
          this.log(
            "⚠️  General auth service processes found (use --force to kill)"
          );
        }
      }
    } catch (error) {
      this.results.errors.push(
        `Error scanning for general processes: ${error.message}`
      );
    }
  }

  async verifyCleanup() {
    this.log("🔍 Verifying cleanup...", true);

    setTimeout(async () => {
      try {
        // Check remaining node processes
        const command = isWindows
          ? 'tasklist /FI "IMAGENAME eq node.exe"'
          : "ps aux | grep node | grep -v grep";

        const { stdout } = await execAsync(command);
        const remainingCount = stdout
          .split("\n")
          .filter(
            (line) =>
              line.trim() &&
              (isWindows ? line.includes("node.exe") : line.includes("node"))
          ).length;

        if (remainingCount === 0) {
          this.log("✅ No Node.js processes remaining");
        } else {
          this.log(`⚠️  ${remainingCount} Node.js processes still running`);
        }

        // Check port 3000 specifically
        const portCommand = isWindows
          ? "netstat -ano | findstr :3000"
          : "lsof -i :3000";

        try {
          const { stdout: portStdout } = await execAsync(portCommand);
          if (portStdout.trim()) {
            this.log("⚠️  Port 3000 still in use");
          } else {
            this.log("✅ Port 3000 is free");
          }
        } catch {
          this.log("✅ Port 3000 is free");
        }
      } catch (error) {
        this.log("⚠️  Could not verify cleanup results");
      }
    }, 2000);
  }

  showResults() {
    console.log(`
📊 AUTH SERVICE CLEANUP RESULTS:
   Mode: ${isForce ? "FORCE" : "PREVIEW"}
   Ports cleaned: ${this.results.portsKilled}
   Jobs killed: ${this.results.jobsKilled}  
   Processes killed: ${this.results.processesKilled}
   Errors: ${this.results.errors.length}
`);

    if (this.results.errors.length > 0) {
      console.log("❌ Errors encountered:");
      this.results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (!isForce) {
      console.log(`
⚠️  PREVIEW MODE - Nothing was actually killed.
   To perform cleanup: node cleanup-all-auth.js --force
   
🛠️  Other options:
   node cleanup-all-auth.js --force --verbose    # Detailed output
   npm run emergency:force                       # Alternative emergency cleanup
   npm run diagnose-jobs                         # Check what's running
`);
    } else {
      console.log(`
✅ Cleanup completed!

🔄 Next steps:
   1. Wait a few seconds for processes to fully terminate
   2. Run: npm run diagnose-jobs (to verify)
   3. Start auth service: npm run dev
`);
    }
  }

  async run() {
    console.log("🚨 Auth Service Comprehensive Cleanup");
    console.log(`Mode: ${isForce ? "💥 FORCE" : "👁️  PREVIEW"}\n`);

    await this.cleanupPorts();
    await this.cleanupJobs();
    await this.cleanupGeneralProcesses();

    if (isForce) {
      await this.verifyCleanup();
    }

    this.showResults();
  }
}

// Help system
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
🧹 Auth Service Comprehensive Cleanup

Cleans up all auth service related processes, jobs, and ports.

USAGE:
  node cleanup-all-auth.js [options]

OPTIONS:
  --force    Actually kill processes (default is preview mode)
  --verbose  Show detailed output
  --help     Show this help

WHAT IT CLEANS:
  🌐 Ports: 3000, 3001, 3002, 3003
  🔄 Jobs: incomplete-profile, token-expiration, preferences, etc.
  ⚙️  Processes: auth-service, authentication related

EXAMPLES:
  node cleanup-all-auth.js                    # Preview what would be cleaned
  node cleanup-all-auth.js --force            # Actually perform cleanup
  node cleanup-all-auth.js --force --verbose  # Detailed cleanup

INTEGRATION:
  npm run cleanup:all          # Preview
  npm run cleanup:all:force    # Perform cleanup
`);
  process.exit(0);
}

// Run the cleanup
const cleanup = new AuthServiceCleanup();
cleanup.run().catch((error) => {
  console.error("❌ Cleanup failed:", error.message);
  process.exit(1);
});
