// diagnose-auth-jobs.js - Create this file in auth service root directory

const { exec } = require("child_process");

const AUTH_SERVICE_PATTERNS = [
  "incomplete-profile",
  "token-expiration",
  "active-status-job",
  "preferences-log",
  "preferences-update",
  "profile-picture-update",
  "role-init",
  "user-activities",
  "auth-service",
  "mailer",
];

const diagnoseAuthJobs = () => {
  console.log("🔍 Diagnosing Auth Service job processes...\n");

  // Check for running auth service related processes
  const authPattern = AUTH_SERVICE_PATTERNS.join("|");
  exec(
    `ps aux | grep -E '${authPattern}' | grep -v grep`,
    (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        console.log("✅ No auth service job-related processes found");
      } else {
        console.log("📋 Running auth service job-related processes:");
        console.log(stdout);
      }
    }
  );

  // Check for general node processes
  exec("ps aux | grep node | grep -v grep", (error, stdout, stderr) => {
    if (error) {
      console.log("Could not check node processes");
    } else {
      console.log("\n🟦 All Node.js processes:");
      if (stdout.trim()) {
        const nodeProcesses = stdout.split("\n").filter((line) => line.trim());
        console.log(`Found ${nodeProcesses.length} Node.js processes:`);
        nodeProcesses.forEach((process, index) => {
          console.log(`${index + 1}. ${process}`);
        });
      } else {
        console.log("No Node.js processes found");
      }
    }
  });

  // Check for auth service specific ports (typically 3000, 3001, etc.)
  exec(
    "netstat -tulpn 2>/dev/null | grep :300 || lsof -i :3000-3010 2>/dev/null",
    (error, stdout, stderr) => {
      if (error) {
        console.log("\nCould not check listening ports");
      } else {
        console.log("\n🌐 Auth Service ports (3000-3010 range):");
        if (stdout.trim()) {
          console.log(stdout);
        } else {
          console.log("No auth service ports found listening");
        }
      }
    }
  );

  // Check for cron jobs in system
  exec(
    "crontab -l 2>/dev/null || echo 'No user crontab'",
    (error, stdout, stderr) => {
      console.log("\n⏰ System cron jobs:");
      if (stdout.includes("No user crontab") || !stdout.trim()) {
        console.log("No user cron jobs found");
      } else {
        console.log(stdout);
      }
    }
  );

  // Check memory usage
  exec("free -h 2>/dev/null || vm_stat", (error, stdout, stderr) => {
    if (!error && stdout) {
      console.log("\n💾 Memory usage:");
      console.log(stdout);
    }
  });

  // Check for auth service specific log files
  exec(
    "find . -name '*.log' -type f -exec ls -la {} \\; 2>/dev/null | head -10",
    (error, stdout, stderr) => {
      if (!error && stdout.trim()) {
        console.log("\n📄 Recent log files:");
        console.log(stdout);
      }
    }
  );

  // Check for zombie processes
  exec(
    "ps aux | awk '$8 ~ /^Z/ { print }' | grep -v 'awk'",
    (error, stdout, stderr) => {
      if (!error && stdout.trim()) {
        console.log("\n🧟 Zombie processes found:");
        console.log(stdout);
      } else {
        console.log("\n✅ No zombie processes found");
      }
    }
  );

  // Show help information
  setTimeout(() => {
    console.log(`
📚 DIAGNOSTIC COMPLETE

🛠️  AVAILABLE COMMANDS:
  npm run emergency              # Preview what would be killed
  npm run emergency:force        # Kill auth service jobs only  
  npm run emergency:nuclear      # Kill ALL Node.js processes
  npm run kill-jobs:force        # Alternative job cleanup
  npm run kill-port:force        # Kill processes on auth service port
  npm run cleanup                # Full cleanup (ports + jobs)

🔧 MANUAL COMMANDS:
  # Check specific auth service processes:
  ps aux | grep -E 'incomplete-profile|token-expiration|auth-service'
  
  # Kill specific process:
  kill -9 [PID]
  
  # Force kill all node processes:
  pkill -f node
  
  # Check what's using port 3000:
  lsof -i :3000
  
  # Kill process on port 3000:
  kill -9 $(lsof -t -i:3000)

🚨 IF PORTS STILL BUSY:
  1. Run: npm run emergency:force
  2. Or: npm run cleanup
  3. Or manually: kill -9 $(lsof -t -i:3000)
  4. Last resort: sudo pkill -f node
`);
  }, 3000);
};

diagnoseAuthJobs();
