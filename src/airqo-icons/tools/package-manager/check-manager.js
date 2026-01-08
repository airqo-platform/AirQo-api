#!/usr/bin/env node
const { detectPackageManager } = require('./detect-manager');

const detectedManager = detectPackageManager();
const currentManager = process.env.npm_config_user_agent
  ? process.env.npm_config_user_agent.split('/')[0]
  : 'unknown';

console.log(`📦 Detected package manager: ${detectedManager}`);
console.log(`🔧 Current package manager: ${currentManager}`);

if (currentManager !== 'unknown' && currentManager !== detectedManager) {
  console.warn(
    `⚠️  Warning: Using ${currentManager} but ${detectedManager} is recommended for this project`,
  );
  console.warn(`   Consider using: ${detectedManager} install`);
}
