# 🛠️ Process Management Guide

This comprehensive guide covers all the process management scripts available in your Device Registry application for safely terminating ports, cron jobs, and emergency cleanup of any Node.js processes.

## 📋 Table of Contents

- [Quick Reference](#-quick-reference)
- [Port Management Scripts](#-port-management-scripts)
- [Cron Job Management Scripts](#-cron-job-management-scripts)
- [Standard Cleanup Scripts](#-standard-cleanup-scripts)
- [Emergency Scripts](#-emergency-scripts)
- [One-Time Comprehensive Cleanup](#-one-time-comprehensive-cleanup)
- [Emergency Scenarios](#-emergency-scenarios)
- [Troubleshooting](#-troubleshooting)
- [Best Practices](#-best-practices)

## 🚀 Quick Reference

| Script                      | Purpose               | Safety Level      | Target                         |
| --------------------------- | --------------------- | ----------------- | ------------------------------ |
| `npm run kill`              | Check port processes  | ✅ Safe Preview   | Default port (3000)            |
| `npm run kill:force`        | Kill port processes   | ⚠️ Targeted Kill  | Default port (3000)            |
| `npm run kill-jobs`         | Check cron jobs       | ✅ Safe Preview   | App-specific cron jobs         |
| `npm run kill-jobs:force`   | Kill cron jobs        | ⚠️ Targeted Kill  | App-specific cron jobs         |
| `npm run cleanup`           | Kill both             | ⚠️ Targeted Kill  | Ports + cron jobs              |
| `npm run cleanup:preview`   | Check both            | ✅ Safe Preview   | Ports + cron jobs              |
| `npm run emergency`         | Check ANY cron jobs   | ✅ Safe Preview   | ALL cron/background jobs       |
| `npm run emergency:force`   | Kill ANY cron jobs    | ⚠️ Targeted Kill  | ALL cron/background jobs       |
| `npm run emergency:nuclear` | Kill ALL Node.js      | ☢️ Nuclear Option | ALL Node.js processes          |
| `npm run cleanup:all`       | Comprehensive check   | ✅ Safe Preview   | System-wide orphaned processes |
| `npm run cleanup:all:force` | Comprehensive cleanup | ⚠️ Destructive    | System-wide orphaned processes |

## 🔌 Port Management Scripts

### `npm run kill`

**Safe preview mode** - Shows which processes are using the default port (3000) without killing them.

```bash
npm run kill
```

**Example Output:**

```
🔍 Detected platform: Unix/Linux
🔍 Finding processes using port 3000...
🎯 Found 2 process(es) using port 3000:
   PIDs: 12345, 67890

Process details:
  PID  PPID USER     COMMAND
  12345 1234 user     node ./bin
  67890 1234 user     node --max-old-space-size=4096 ./bin

⚠️  To kill these processes, run with --force flag
   Example: npm run kill:force
```

### `npm run kill:force`

**Destructive action** - Actually terminates processes using the default port.

```bash
npm run kill:force
```

**Example Output:**

```
🚀 --force flag detected. Proceeding with termination...

[1/2] Processing PID 12345:
Attempting to kill process 12345 gracefully...
✅ Process 12345 terminated gracefully.

[2/2] Processing PID 67890:
Attempting to kill process 67890 gracefully...
✅ Process 67890 terminated gracefully.

🎉 All 2 processes have been terminated successfully.
```

### `npm run kill:help`

Shows comprehensive help and usage examples.

```bash
npm run kill:help
```

### `npm run kill:port`

Same as `npm run kill` - preview mode for port checking.

### Custom Port Usage

You can specify a different port:

```bash
# Preview processes on port 8080
npm run kill -- 8080

# Kill processes on port 8080
npm run kill -- 8080 --force
```

## 🕐 Cron Job Management Scripts

### `npm run kill-jobs`

**Safe preview mode** - Shows cron job processes that would be terminated.

```bash
npm run kill-jobs
```

**Example Output:**

```
🔍 Scanning Unix/Linux processes...
Found the following processes that will be terminated:
PID: 15432 - node /path/to/device-registry/bin/jobs/store-signals-job
PID: 15433 - node /path/to/device-registry/bin/jobs/v2.1-store-readings-job
PID: 15434 - node /path/to/device-registry/bin/jobs/check-network-status-job

Run with --force to proceed with termination
Example: npm run kill-jobs:force
```

### `npm run kill-jobs:force`

**Destructive action** - Actually terminates cron job processes.

```bash
npm run kill-jobs:force
```

**Example Output:**

```
🔍 Scanning Unix/Linux processes...
Found 3 device-registry cron process(es) - terminating due to --force flag:

Processing PID: 15432
Command: node /path/to/device-registry/bin/jobs/store-signals-job
Attempting graceful termination of process 15432...
✅ Process 15432 terminated gracefully.

🎉 Process termination complete.
```

## 🧹 Standard Cleanup Scripts

### `npm run cleanup:preview`

**Safe preview mode** - Shows what both port and cron job cleanup would do without actually doing it.

```bash
npm run cleanup:preview
```

This runs both `npm run kill` and `npm run kill-jobs` in sequence to show you exactly what processes would be terminated.

### `npm run cleanup`

**Destructive action** - Performs complete cleanup of both port processes and cron jobs.

```bash
npm run cleanup
```

This is equivalent to running:

```bash
npm run kill:force && npm run kill-jobs:force
```

**⚠️ Warning:** This immediately terminates all relevant processes without confirmation.

## 🚨 Emergency Scripts

When regular cleanup scripts aren't enough, use these emergency options to handle ANY running cron jobs or Node.js processes.

### `npm run emergency`

**Safe preview mode** - Shows ALL cron jobs and background processes that could be terminated.

```bash
npm run emergency
```

**Example Output:**

```
🚨 EMERGENCY: Searching for ALL cron jobs and related Node.js processes...
🔍 Scanning Unix/Linux processes...
📊 Found 5 total Node.js processes
🎯 Filtering relevant processes...

🎯 Found 3 cron job/related process(es):
1. PID: 12345
   User: user
   Command: node ./bin/jobs/store-signals-job

2. PID: 12346
   User: user
   Command: node ./bin/jobs/health-tip-checker-job

3. PID: 12347
   User: user
   Command: node-cron scheduler process

🤔 Also found 2 other Node.js processes:
1. PID: 12348 - node ./server.js
2. PID: 12349 - nodemon --watch src
   (Use --nuclear to kill these too)

⚠️  TARGETED MODE: To kill these processes, use --force flag:
node emergency-job-killer.js --force
  (Kills only cron jobs and related processes)
```

### `npm run emergency:force`

**Targeted destruction** - Kills ALL cron jobs and background processes (not just app-specific ones).

```bash
npm run emergency:force
```

**What it targets:**

- ✅ Any process containing: `cron`, `job`, `schedule`, `node-cron`
- ✅ Your specific jobs: `store-signals`, `store-readings`, `check-network-status`, etc.
- ✅ App processes: `device-registry`, `auth-service`, `nodemon`, `./bin`
- ✅ Background workers and schedulers

**What it protects:**

- 🛡️ System processes (`/usr/bin`, `/usr/local/bin`)
- 🛡️ Code editors (`vscode`, `code`, `electron`)
- 🛡️ Package managers (`npm install`, `package-lock`)

### `npm run emergency:nuclear`

**☢️ Nuclear option** - Kills ALL Node.js processes except protected system processes.

```bash
npm run emergency:nuclear
```

**⚠️ EXTREME CAUTION:** This will kill:

- Your development servers
- Any Node.js applications running
- Code editors (except protected ones)
- Background tasks
- Pretty much everything Node.js related

**Use only when:**

- Everything else has failed
- You have runaway processes consuming resources
- You need a complete "clean slate"
- Normal scripts can't find/kill problematic processes

### `npm run emergency:help`

Shows comprehensive help for all emergency options.

```bash
npm run emergency:help
```

## 🆘 One-Time Comprehensive Cleanup

For cleaning up orphaned processes that existed before you set up these management scripts.

### `npm run cleanup:all`

**Safe system-wide preview** - Scans your entire system for orphaned Node.js processes.

```bash
npm run cleanup:all
```

**What it finds:**

- All Node.js processes related to your applications
- Processes using common development ports (3000, 3001, 8000, 8080, etc.)
- Orphaned cron jobs and background tasks
- Abandoned `nodemon` processes

### `npm run cleanup:all:force`

**System-wide cleanup** - Actually terminates all found orphaned processes.

```bash
npm run cleanup:all:force
```

**Example Output:**

```
🧹 Starting comprehensive cleanup...
📱 Platform: Unix/Linux

📊 STEP 1: Finding all Node.js processes...
   Found 8 Node.js processes total

🎯 STEP 2: Filtering relevant processes...
   Found 4 potentially relevant processes:
   1. PID: 15432 - node /old/project/bin/jobs/store-signals-job
   2. PID: 15433 - nodemon --watch src/
   3. PID: 15434 - node ./bin server.js
   4. PID: 15435 - node background-worker.js

🔌 STEP 3: Checking common ports...
   Found processes on these ports:
   Port 3000: PIDs 15434
   Port 8080: PIDs 15436

🚀 STEP 4: Terminating processes...
   [1/5] Killing PID 15432...
   ✅ Successfully terminated PID 15432

📋 CLEANUP SUMMARY:
   Attempted: 5 processes
   Successful: 5 processes
   Failed: 0 processes
🎉 All processes cleaned up successfully!
```

## 🔥 Emergency Scenarios

### **Scenario 1: Stuck Cron Job (Unknown Name)**

```bash
# When you don't know the exact job name
npm run emergency              # Find ANY cron jobs
npm run emergency:force        # Kill them all
```

### **Scenario 2: System Slowdown from Node.js Processes**

```bash
# Check what's consuming resources
npm run emergency              # See all Node.js processes
npm run emergency:nuclear      # Nuclear option if needed
```

### **Scenario 3: Port Already in Use (Unknown Process)**

```bash
# Standard approach first
npm run kill                   # Check default port
npm run kill -- 8080           # Check specific port

# If that doesn't work
npm run emergency              # Find any process that might be using it
npm run emergency:force        # Kill background processes
```

### **Scenario 4: Complete Development Environment Reset**

```bash
# Step 1: System-wide cleanup
npm run cleanup:all:force      # Clean orphaned processes

# Step 2: Kill any remaining jobs
npm run emergency:force        # Kill current cron jobs

# Step 3: Nuclear option if needed
npm run emergency:nuclear      # Kill everything Node.js

# Step 4: Verify clean state
npm run emergency              # Should show no processes
```

### **Scenario 5: Unknown Background Processes**

```bash
# Safe investigation
npm run emergency              # Shows "other Node.js processes" section
npm run cleanup:all            # Check for system-wide orphans

# Based on what you see, choose:
npm run emergency:force        # Targeted approach
npm run emergency:nuclear      # Nuclear approach
```

## 🔧 Advanced Usage Examples

### **Port-Specific Emergency**

```bash
# Check specific port first
npm run kill -- 8080

# If regular kill doesn't work, try emergency
npm run emergency              # See if any background job is using it
npm run emergency:force        # Kill background processes
```

### **Multi-Port Cleanup**

```bash
# Check multiple ports
npm run kill -- 3000
npm run kill -- 3001
npm run kill -- 8080

# Or use emergency for comprehensive check
npm run emergency              # Shows all processes at once
```

### **Development Workflow Reset**

```bash
# Daily reset routine
npm run cleanup:preview        # See what needs cleaning
npm run cleanup                # Clean current app processes
npm run emergency              # Check for other issues
npm run dev                    # Start fresh
```

### **CI/CD Pipeline Cleanup**

```bash
# In deployment scripts
npm run cleanup                # Clean current app
npm run emergency:force        # Ensure no background jobs remain
npm run start                  # Start production
```

## 🐛 Troubleshooting

### Permission Errors

**Windows:**

```bash
# Run Command Prompt as Administrator, then:
npm run kill:force
npm run emergency:force
npm run emergency:nuclear    # If needed
```

**Unix/Linux/macOS:**

```bash
sudo npm run kill:force
sudo npm run emergency:force
sudo npm run emergency:nuclear    # If needed
```

### No Processes Found

```bash
npm run kill
# Output: ✅ No processes found using port 3000.

npm run emergency
# Output: ✅ No cron jobs or related processes found!
```

This is normal - it means no cleanup is needed.

### Processes Won't Die

**Escalating approach:**

```bash
# Step 1: Try targeted approach
npm run kill:force
npm run kill-jobs:force

# Step 2: Try emergency targeted
npm run emergency:force

# Step 3: Nuclear option
npm run emergency:nuclear

# Step 4: Manual system commands (last resort)
# Windows:
taskkill /F /IM node.exe

# Unix/Linux/macOS:
pkill -f node
```

### Script Not Found Errors

Make sure you're in the project directory and files exist:

```bash
cd /path/to/your/device-registry
ls -la emergency-job-killer.js    # Should exist
ls -la cleanup-all.js             # Should exist
npm run emergency:help
```

### Port Still In Use After Cleanup

```bash
# Wait a few seconds, then check again
npm run kill

# Or check manually what's using the port
# Windows
netstat -ano | findstr :3000

# Unix/Linux/macOS
lsof -i :3000

# If something else is using it, try emergency
npm run emergency:force
```

### Emergency Scripts Show No Processes But Problems Persist

This might indicate:

1. **Non-Node.js processes** using your resources
2. **System-level issues** not related to your app
3. **Database connections** that aren't properly closed

**Investigation steps:**

```bash
# Check all processes on your ports
# Windows
netstat -ano | findstr :3000

# Unix/Linux/macOS
lsof -i :3000

# Check system resource usage
# Windows
taskmgr

# Unix/Linux/macOS
top
htop    # If available
```

### Emergency Nuclear Mode Precautions

Before using `npm run emergency:nuclear`:

1. **Save your work** in all editors
2. **Close development tools** that you want to keep running
3. **Check what will be killed:**
   ```bash
   npm run emergency    # Review the "other processes" section
   ```
4. **Consider if you really need nuclear option:**
   ```bash
   npm run emergency:force    # Try targeted first
   ```

### Recovery After Nuclear Mode

If you accidentally killed important processes:

```bash
# Restart your development environment
npm run dev

# Restart your database (if it was killed)
# MongoDB
mongod

# Redis
redis-server

# Restart your editor
code .    # VS Code
```

## ✅ Best Practices

### 1. Always Preview First

```bash
# Good workflow:
npm run cleanup:preview        # Check current app
npm run emergency              # Check system-wide
npm run cleanup:all            # Check orphaned processes

# Then decide what to kill:
npm run cleanup                # Current app
npm run emergency:force        # All cron jobs
npm run emergency:nuclear      # Everything (last resort)
```

### 2. Use Appropriate Tools for the Job

```bash
# For specific port issues:
npm run kill:force

# For app-specific cron jobs:
npm run kill-jobs:force

# For ANY cron jobs (from any app):
npm run emergency:force

# For complete system reset:
npm run emergency:nuclear
```

### 3. Check Results After Cleanup

```bash
# Verify cleanup worked
npm run kill                   # Should show no processes
npm run kill-jobs              # Should show no jobs
npm run emergency              # Should show clean system

# Test that your app can start
npm run dev                    # Should start without port conflicts
```

### 4. Development Workflow Integration

#### **Starting Development:**

```bash
# Option A: Quick check
npm run cleanup:preview
npm run dev

# Option B: Comprehensive check
npm run emergency              # Check for any issues
npm run cleanup:all            # Clean orphaned processes
npm run dev                    # Start clean
```

#### **Stopping Development:**

```bash
Ctrl+C                         # Stop the server
npm run cleanup                # Clean up app processes
npm run emergency              # Verify no jobs remain
```

#### **Switching Between Projects:**

```bash
# Stop current project
Ctrl+C
npm run cleanup

# Switch to new project
cd /path/to/new/project
npm run cleanup:preview        # Check new project state
npm run dev                    # Start new project
```

### 5. Production/Staging Deployment

#### **Before Deployment:**

```bash
npm run emergency              # Check system state
npm run cleanup:all:force      # Clean orphaned processes
npm run start                  # Start production server
```

#### **During Maintenance:**

```bash
npm run kill:force             # Stop main app
# Deploy new version
npm run start                  # Start updated app
```

#### **Emergency Production Fixes:**

```bash
# If production is behaving strangely
npm run emergency              # Investigate background processes
npm run emergency:force        # Clean up if needed
# Restart your application
```

### 6. Team Development Best Practices

#### **Onboarding New Developers:**

```bash
# Give them this guide and these commands:
npm run emergency:help         # Learn emergency options
npm run cleanup:all            # Clean their system first
npm run dev                    # Start development
```

#### **Daily Standup Checklist:**

```bash
npm run cleanup:preview        # Check for leftover processes
npm run emergency              # Check system health
```

#### **End of Sprint Cleanup:**

```bash
npm run cleanup:all:force      # System-wide cleanup
npm run emergency:nuclear      # Nuclear reset if needed
```

### 7. Monitoring and Prevention

#### **Regular Health Checks:**

```bash
# Weekly system check
npm run emergency              # Look for unknown processes
npm run cleanup:all            # Check for orphans

# Monthly deep clean
npm run emergency:nuclear      # Complete reset
```

#### **Preventing Orphaned Processes:**

1. **Always use Ctrl+C** to stop development servers
2. **Use the enhanced job scripts** with proper cleanup handlers
3. **Run cleanup scripts** when switching branches/projects
4. **Monitor system resources** regularly

### 8. Emergency Response Plan

#### **Level 1: Standard Issues**

```bash
npm run cleanup                # App-specific cleanup
```

#### **Level 2: Persistent Problems**

```bash
npm run emergency:force        # System-wide cron cleanup
```

#### **Level 3: System Crisis**

```bash
npm run emergency:nuclear      # Nuclear option
```

#### **Level 4: Manual Intervention**

```bash
# Windows
taskkill /F /IM node.exe

# Unix/Linux/macOS
pkill -f node
```

## 📞 Emergency Support Commands

If all else fails, here are the manual system commands:

### **Windows Emergency Commands:**

```cmd
:: See all Node.js processes
tasklist | findstr node

:: Kill specific process
taskkill /F /PID [PID_NUMBER]

:: Nuclear option - kill ALL Node.js
taskkill /F /IM node.exe

:: Check ports
netstat -ano | findstr :[PORT]
```

### **Unix/Linux/macOS Emergency Commands:**

```bash
# See all Node.js processes
ps aux | grep node

# Kill specific process
kill -9 [PID_NUMBER]

# Nuclear option - kill ALL Node.js
pkill -f node

# Check ports
lsof -i :[PORT]

# System resource check
top
htop
```

---

💡 **Pro Tip**: Save this guide as a bookmark and establish a team protocol for which scripts to use in different scenarios. The emergency scripts are powerful tools - use them wisely!
