#!/usr/bin/env node
const { execSync } = require('child_process');
const { detectPackageManager } = require('./package-manager/detect-manager');

const manager = detectPackageManager();
const cmd = {
  npm: 'npm run build --workspaces',
  yarn: 'yarn workspaces foreach run build',
  pnpm: 'pnpm -r build',
}[manager];

console.log(`🚀 Building all packages via ${manager}`);
execSync(cmd, { stdio: 'inherit' });
