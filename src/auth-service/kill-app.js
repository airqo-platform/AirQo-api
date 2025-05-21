const { execSync } = require("child_process");

try {
  // Find processes using port 3000
  const result = execSync("lsof -i :3000 -t").toString().trim();

  if (result) {
    const pids = result.split("\n");
    console.log(`Found ${pids.length} process(es) using port 3000`);

    pids.forEach((pid) => {
      console.log(`Killing process ${pid}...`);
      execSync(`kill -9 ${pid}`);
    });

    console.log("All processes terminated.");
  } else {
    console.log("No processes found using port 3000.");
  }
} catch (error) {
  if (error.status === 1) {
    console.log("No processes found using port 3000.");
  } else {
    console.error("Error:", error.message);
  }
}
