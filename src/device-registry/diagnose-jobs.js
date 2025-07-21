// ====================================
// JOB DIAGNOSTIC SCRIPT
// ====================================
// This script helps identify which jobs need to be enhanced

console.log("🔍 CRON JOB DIAGNOSTIC REPORT");
console.log("===============================\n");

// Check if global.cronJobs exists
if (!global.cronJobs) {
  console.log(
    "❌ No global.cronJobs found - jobs may not be properly registered"
  );
  process.exit(1);
}

const jobNames = Object.keys(global.cronJobs);
console.log(`📊 Found ${jobNames.length} registered cron jobs:\n`);

let enhancedJobs = [];
let legacyJobs = [];
let brokenJobs = [];

// Analyze each job
jobNames.forEach((jobName, index) => {
  const jobObj = global.cronJobs[jobName];
  console.log(`${index + 1}. 📋 JOB: ${jobName}`);

  // Check job structure
  if (!jobObj) {
    console.log("   ❌ Job object is null/undefined");
    brokenJobs.push(jobName);
    return;
  }

  // Check if it has enhanced stop method
  if (jobObj.stop && typeof jobObj.stop === "function") {
    console.log("   ✅ Has async stop() method (ENHANCED)");

    // Check if it has the job instance
    if (jobObj.job) {
      console.log("   ✅ Has job instance");

      // Check destroy method availability
      if (typeof jobObj.job.destroy === "function") {
        console.log("   ✅ Has destroy() method");
      } else {
        console.log("   ⚠️  No destroy() method (older node-cron version)");
      }
    } else {
      console.log("   ⚠️  No job instance stored");
    }

    enhancedJobs.push(jobName);
  }
  // Check if it has basic job instance
  else if (jobObj.job) {
    console.log("   ⚠️  No async stop() method (LEGACY)");

    if (typeof jobObj.job.stop === "function") {
      console.log("   ✅ Has job.stop() method");
    } else {
      console.log("   ❌ No job.stop() method");
    }

    if (typeof jobObj.job.destroy === "function") {
      console.log("   ✅ Has job.destroy() method");
    } else {
      console.log("   ❌ No job.destroy() method");
    }

    legacyJobs.push(jobName);
  }
  // Completely broken
  else {
    console.log("   ❌ No job instance or stop method (BROKEN)");
    brokenJobs.push(jobName);
  }

  console.log(""); // Empty line
});

// Summary
console.log("📊 SUMMARY:");
console.log("===========");
console.log(`✅ Enhanced jobs: ${enhancedJobs.length}`);
if (enhancedJobs.length > 0) {
  console.log(`   ${enhancedJobs.join(", ")}`);
}

console.log(`⚠️  Legacy jobs: ${legacyJobs.length}`);
if (legacyJobs.length > 0) {
  console.log(`   ${legacyJobs.join(", ")}`);
}

console.log(`❌ Broken jobs: ${brokenJobs.length}`);
if (brokenJobs.length > 0) {
  console.log(`   ${brokenJobs.join(", ")}`);
}

console.log("\n🎯 RECOMMENDATIONS:");
console.log("===================");

if (legacyJobs.length > 0) {
  console.log("⚠️  LEGACY JOBS NEED UPDATING:");
  legacyJobs.forEach((jobName) => {
    console.log(`   • ${jobName} - Apply enhanced pattern`);
  });
  console.log(
    "\n   These jobs need to be refactored with the enhanced pattern"
  );
  console.log("   to have proper async stop() methods and cleanup handling.");
}

if (brokenJobs.length > 0) {
  console.log("\n❌ BROKEN JOBS NEED FIXING:");
  brokenJobs.forEach((jobName) => {
    console.log(`   • ${jobName} - Completely broken registration`);
  });
  console.log(
    "\n   These jobs are not properly registered and need to be fixed."
  );
}

if (enhancedJobs.length === jobNames.length) {
  console.log("🎉 All jobs are using the enhanced pattern! ✨");
  console.log("   Your cron job management is properly set up.");
}

console.log("\n💡 NEXT STEPS:");
console.log("===============");
console.log(
  "1. Update server.js with the enhanced version (handles legacy jobs better)"
);
console.log("2. Apply the enhanced pattern to legacy jobs:");
console.log("   - Add JOB_NAME constant");
console.log("   - Store cronJobInstance in variable");
console.log("   - Register with async stop() method");
console.log("3. Test shutdown behavior: npm run dev -> Ctrl+C");
console.log("4. Verify no orphaned processes: npm run emergency");

module.exports = {
  enhancedJobs,
  legacyJobs,
  brokenJobs,
};
